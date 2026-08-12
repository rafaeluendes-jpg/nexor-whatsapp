/* ==========================================================
   NEXOR — CAMADA DE CANAL

   Existem dois robôs, e eles não usam o mesmo caminho:

   · A ATENDENTE (Carla) fala com o cliente. É um número por loja,
     no celular da sorveteria, conectado por QR. Baileys.

   · A ASSISTENTE fala com o gestor. É UM número só para toda a
     plataforma Nexor, atendendo todas as redes. Baileys não serve:
     é uso não oficial, e um número disparando cobrança para dezenas
     de gestores é o perfil que o WhatsApp bane. Vai pela Cloud API
     da Meta.

   Este arquivo esconde essa diferença do resto do robô. Quem envia
   chama enviarPara() e não sabe por onde saiu. Quando o número da
   Meta estiver aprovado, basta preencher as variáveis de ambiente:
   nenhuma outra linha do sistema muda.
   ========================================================== */

const META_TOKEN   = process.env.META_TOKEN || '';
const META_NUMERO  = process.env.META_PHONE_NUMBER_ID || '';
const META_VERIFY  = process.env.META_VERIFY_TOKEN || 'nexor';
const META_VERSAO  = process.env.META_VERSAO || 'v21.0';

/* a Meta só entra em campo quando as duas coisas existirem */
function metaPronta() { return !!(META_TOKEN && META_NUMERO); }

function soDigito(t) { return String(t || '').replace(/\D/g, ''); }

/* O Brasil tem o problema do nono dígito: o WhatsApp guarda números
   antigos sem ele. Mandar para o número errado é mensagem que some. */
function variacoesBR(tel) {
  const d = soDigito(tel);
  const fora = [d];
  if (d.startsWith('55') && d.length === 13) fora.push('55' + d.slice(2, 4) + d.slice(5));
  if (d.startsWith('55') && d.length === 12) fora.push('55' + d.slice(2, 4) + '9' + d.slice(4));
  if (!d.startsWith('55')) fora.push('55' + d);
  return [...new Set(fora)];
}

/* ---------- envio pela Meta ---------- */
async function enviarPelaMeta(telefone, texto) {
  const r = await fetch(`https://graph.facebook.com/${META_VERSAO}/${META_NUMERO}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${META_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: soDigito(telefone),
      type: 'text',
      text: { preview_url: false, body: texto },
    }),
  });
  if (!r.ok) {
    const d = await r.text();
    throw new Error(`Meta recusou (${r.status}): ${d.slice(0, 200)}`);
  }
  return r.json();
}

async function enviarDocumentoPelaMeta(telefone, urlArquivo, nomeArquivo, legenda) {
  const r = await fetch(`https://graph.facebook.com/${META_VERSAO}/${META_NUMERO}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${META_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: soDigito(telefone),
      type: 'document',
      document: { link: urlArquivo, filename: nomeArquivo, caption: legenda || '' },
    }),
  });
  if (!r.ok) throw new Error(`Meta recusou o documento (${r.status})`);
  return r.json();
}

/* ---------- botões de verdade (só pela Meta) ----------
   Pergunta de sim/não sem botão obriga o gestor a digitar, e ele responde
   "ja fiz", "fiz sim", "ainda nao" — cada um de um jeito. Com botão, a
   resposta chega padronizada e o registro fica limpo. */
async function enviarBotoesPelaMeta(telefone, texto, botoes) {
  const r = await fetch(`https://graph.facebook.com/${META_VERSAO}/${META_NUMERO}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${META_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: soDigito(telefone),
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: texto.slice(0, 1024) },
        action: {
          buttons: botoes.slice(0, 3).map((b, i) => ({
            type: 'reply', reply: { id: b.id || ('b' + i), title: b.titulo.slice(0, 20) }
          }))
        }
      }
    })
  });
  if (!r.ok) {
    const d = await r.text();
    throw new Error(`Meta recusou os botões (${r.status}): ${d.slice(0, 200)}`);
  }
  return r.json();
}

/* Manda com botão quando dá; sem a Meta, cai no texto com a instrução. */
async function enviarPergunta({ sessoes, lojaId, telefone, texto, botoes }) {
  if (metaPronta() && botoes && botoes.length) {
    try { await enviarBotoesPelaMeta(telefone, texto, botoes); return { por: 'meta-botao' }; }
    catch (e) { console.error('botao falhou, indo por texto:', e.message); }
  }
  const dica = botoes && botoes.length
    ? '\n\n' + botoes.map(b => '*' + b.titulo + '*').join('  ou  ')
    : '';
  return enviarPara({ canal: 'assistente', sessoes, lojaId, telefone, texto: texto + dica });
}

/* ---------- envio pelo Baileys ---------- */
async function enviarPeloBaileys(sessoes, lojaId, telefone, texto) {
  const s = sessoes[lojaId];
  if (!s || !s.sock || s.estado !== 'conectado')
    throw new Error('A loja não está conectada ao WhatsApp.');
  for (const num of variacoesBR(telefone)) {
    try {
      await s.sock.sendMessage(num + '@s.whatsapp.net', { text: texto });
      return { por: 'baileys', numero: num };
    } catch (e) { /* tenta a próxima variação */ }
  }
  throw new Error('Não consegui entregar a mensagem.');
}

/* ==========================================================
   A PORTA ÚNICA
   canal: 'assistente' vai pela Meta quando ela existir;
          'atendente'  vai sempre pelo Baileys da loja.
   Enquanto a Meta não estiver configurada, a assistente cai
   no Baileys — assim dá para testar tudo antes do número sair.
   ========================================================== */
async function enviarPara({ canal, sessoes, lojaId, telefone, texto }) {
  if (canal === 'assistente' && metaPronta()) {
    await enviarPelaMeta(telefone, texto);
    return { por: 'meta' };
  }
  return enviarPeloBaileys(sessoes, lojaId, telefone, texto);
}

/* ==========================================================
   RECEBIMENTO PELA META (webhook)
   A Meta não mantém sessão aberta: ela bate na nossa porta a
   cada mensagem. Normalizamos para o mesmo formato que o
   Baileys entrega, então o miolo do robô não distingue.
   ========================================================== */
/* ==========================================================
   AUDITORIA — ASSINATURA DO WEBHOOK DA META
   O webhook nao conferia quem estava batendo na porta. Como o endereco e
   publico e o Assistente descobre a loja pelo telefone de quem escreveu,
   qualquer pessoa que soubesse a URL podia enviar um JSON forjado com o
   numero do gerente e comandar o Assistente daquela loja: pedir relatorio,
   lancar despesa, consultar faturamento.
   A Meta assina cada envio com HMAC-SHA256 do corpo, usando o App Secret,
   no cabecalho X-Hub-Signature-256. Agora conferimos antes de processar.
   Comparacao em tempo constante, para nao vazar a chave pelo tempo de
   resposta.
   ========================================================== */
const crypto = require('crypto');
const META_SEGREDO = process.env.META_APP_SECRET || '';

function assinaturaConfere(req) {
  if (!META_SEGREDO) {
    console.error('WEBHOOK RECUSADO: META_APP_SECRET não definido no Render.');
    return false;
  }
  const veio = String(req.headers['x-hub-signature-256'] || '');
  if (!veio.startsWith('sha256=')) return false;
  const bruto = req.corpoBruto || Buffer.from(JSON.stringify(req.body || {}));
  const nosso = 'sha256=' + crypto.createHmac('sha256', META_SEGREDO)
    .update(bruto).digest('hex');
  const a = Buffer.from(veio), b = Buffer.from(nosso);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function rotasMeta(app, aoReceber) {
  /* a Meta confere a URL uma vez, antes de mandar qualquer coisa */
  app.get('/meta/webhook', (req, res) => {
    const modo = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const desafio = req.query['hub.challenge'];
    if (modo === 'subscribe' && token === META_VERIFY) return res.status(200).send(desafio);
    return res.sendStatus(403);
  });

  app.post('/meta/webhook', async (req, res) => {
    /* quem nao assina nao entra */
    if (!assinaturaConfere(req)) {
      console.error('webhook meta: assinatura inválida — descartado');
      return res.sendStatus(403);
    }
    /* responder rápido é obrigação: a Meta repete o que demora */
    res.sendStatus(200);
    try {
      const entradas = req.body?.entry || [];
      for (const e of entradas) {
        for (const mud of (e.changes || [])) {
          for (const msg of (mud.value?.messages || [])) {
            const tel = soDigito(msg.from);
            let texto = '';
            let imagem = null;
            if (msg.type === 'text') texto = msg.text?.body || '';
            else if (msg.type === 'image') {
              texto = msg.image?.caption || '';
              imagem = await baixarMidiaMeta(msg.image?.id);
            } else if (msg.type === 'document') {
              texto = msg.document?.caption || '';
            } else if (msg.type === 'interactive') {
              texto = msg.interactive?.button_reply?.title
                   || msg.interactive?.list_reply?.title || '';
            }
            if (!texto && !imagem) continue;
            await aoReceber({ canal: 'meta', telefone: tel, texto, imagem });
          }
        }
      }
    } catch (err) { console.error('webhook meta:', err && err.message); }
  });
}

/* a Meta manda o identificador da mídia; o conteúdo se busca em dois passos */
async function baixarMidiaMeta(id) {
  if (!id || !META_TOKEN) return null;
  try {
    const r1 = await fetch(`https://graph.facebook.com/${META_VERSAO}/${id}`, {
      headers: { Authorization: `Bearer ${META_TOKEN}` },
    });
    const d = await r1.json();
    if (!d?.url) return null;
    const r2 = await fetch(d.url, { headers: { Authorization: `Bearer ${META_TOKEN}` } });
    const buf = Buffer.from(await r2.arrayBuffer());
    return { base64: buf.toString('base64'), tipo: d.mime_type || 'image/jpeg' };
  } catch (e) { return null; }
}

module.exports = {
  metaPronta, enviarPara, enviarPergunta, rotasMeta, variacoesBR, soDigito,
  enviarDocumentoPelaMeta,
};
