/* ==========================================================
   NEXOR — Robô de WhatsApp
   Uma sessão por loja. Conecta por QR, responde sozinho e
   envia os avisos de cada fase do pedido.
   ========================================================== */
const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const { createClient } = require('@supabase/supabase-js');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  initAuthCreds,
  BufferJSON,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORTA = process.env.PORT || 3000;
/* aceita variações de nome, para não travar por erro de digitação */
function varAmbiente(...nomes) {
  for (const n of nomes) {
    const v = process.env[n];
    if (v && String(v).trim()) return String(v).trim();
  }
  /* procura qualquer variável parecida */
  const alvo = nomes[0].replace(/[^A-Z]/g, '');
  for (const k of Object.keys(process.env)) {
    if (k.replace(/[^A-Z]/g, '') === alvo && process.env[k]) return process.env[k].trim();
  }
  return '';
}
/* acha a variável pelo CONTEÚDO, não pelo nome — imune a erro de digitação */
function acharPorConteudo(teste) {
  for (const k of Object.keys(process.env)) {
    const v = String(process.env[k] || '').trim();
    if (v && teste(v)) return v;
  }
  return '';
}
const CHAVE = varAmbiente('CHAVE_API', 'CHAVEAPI', 'API_KEY') || '';
const EXIGE_CHAVE = String(process.env.EXIGIR_CHAVE || '') === 'sim';
const SB_URL = varAmbiente('SUPABASE_URL', 'SUPA_URL', 'SB_URL')
            || acharPorConteudo(v => /^https:\/\/[a-z0-9]+\.supabase\.co/.test(v));
const SB_KEY = varAmbiente('SUPABASE_KEY', 'SUPA_KEY', 'SB_KEY')
            || acharPorConteudo(v => /^(sb_publishable_|eyJ)/.test(v));
/* chaves de IA — encontradas pelo formato, o nome não importa */
const GROQ_KEY   = varAmbiente('GROQ_KEY','GROQ_API_KEY') || acharPorConteudo(v => /^gsk_/.test(v));
const GEMINI_KEY = varAmbiente('GEMINI_KEY','GOOGLE_KEY') || acharPorConteudo(v => /^AIza/.test(v));
console.log('banco:', SB_URL ? 'encontrado' : 'faltando',
            '| chave do banco:', SB_KEY ? 'encontrada' : 'faltando');
console.log('IA — Groq:', GROQ_KEY ? 'ok' : 'faltando',
            '| Gemini:', GEMINI_KEY ? 'ok' : 'faltando');
const PASTA   = process.env.PASTA_SESSOES || './sessoes';

const sb = (SB_URL && SB_KEY) ? createClient(SB_URL, SB_KEY) : null;
const log = pino({ level: 'warn' });
const sessoes = {};   /* lojaId -> { sock, qr, estado, numero } */

if (!fs.existsSync(PASTA)) fs.mkdirSync(PASTA, { recursive: true });

/* ---------- autenticação simples ---------- */
function autorizado(req) {
  if (!EXIGE_CHAVE) return true;        /* liberado até você ligar a exigência */
  const c = req.headers['x-chave'] || req.query.chave;
  return c === CHAVE;
}
function protege(req, res, next) {
  if (!autorizado(req)) return res.status(401).json({ erro: 'chave inválida' });
  next();
}

/* ---------- conexão de uma loja ---------- */
async function conectar(lojaId, forcar) {
  if (sessoes[lojaId]?.estado === 'conectado' && sessoes[lojaId]?.sock)
    return sessoes[lojaId];
  /* sessão pendurada sem QR: derruba e começa de novo */
  if (forcar && sessoes[lojaId]) {
    try { sessoes[lojaId].sock?.end?.(); } catch (e) {}
    delete sessoes[lojaId];
  }
  if (sessoes[lojaId]?.sock && sessoes[lojaId]?.qr) return sessoes[lojaId];

  const dir = path.join(PASTA, String(lojaId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const { state, saveCreds } = sb
    ? await authNoBanco(lojaId)
    : await useMultiFileAuthState(dir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: log,
    printQRInTerminal: false,
    browser: ['Nexor', 'Chrome', '1.0.0'],
    markOnlineOnConnect: false,
    syncFullHistory: false
  });

  sessoes[lojaId] = sessoes[lojaId] || {};
  sessoes[lojaId].sock = sock;
  sessoes[lojaId].estado = 'conectando';

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (u.connection) console.log('[' + lojaId + '] conexao:', u.connection);
    if (qr) {
      console.log('[' + lojaId + '] QR gerado');
      sessoes[lojaId].qr = await QRCode.toDataURL(qr);
      sessoes[lojaId].estado = 'aguardando_qr';
    }
    if (connection === 'open') {
      sessoes[lojaId].estado = 'conectado';
      sessoes[lojaId].qr = null;
      sessoes[lojaId].numero = sock.user?.id?.split(':')[0] || '';
      console.log(`[${lojaId}] conectado como ${sessoes[lojaId].numero}`);
    }
    if (connection === 'close') {
      const motivo = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const deslogado = motivo === DisconnectReason.loggedOut;
      sessoes[lojaId].estado = deslogado ? 'desconectado' : 'reconectando';
      sessoes[lojaId].sock = null;
      console.log(`[${lojaId}] caiu (${motivo}) — ${deslogado ? 'precisa ler o QR de novo' : 'reconectando'}`);
      if (deslogado) {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
        limparSessaoBanco(lojaId);
      } else {
        setTimeout(() => conectar(lojaId).catch(() => {}), 4000);
      }
    }
  });

  /* mensagens que chegam */
  sock.ev.on('messages.upsert', async (m) => {
    try {
      const msg = m.messages?.[0];
      if (!msg || msg.key.fromMe || m.type !== 'notify') return;
      const de = msg.key.remoteJid;
      if (!de || de.endsWith('@g.us') || de === 'status@broadcast') return;

      const texto = (msg.message?.conversation ||
                     msg.message?.extendedTextMessage?.text || '').trim();
      if (!texto) return;

      const tel = de.split('@')[0];
      const resposta = await montarResposta(lojaId, tel, texto);
      if (resposta) {
        await sock.sendPresenceUpdate('composing', de);
        await new Promise(r => setTimeout(r, 900));
        await sock.sendMessage(de, { text: resposta });
      }
      if (sb) {
        await sb.from('whatsapp_mensagens').insert([{
          sucursal_id: lojaId, telefone: tel, direcao: 'recebida',
          texto, resposta: resposta || null
        }]).then(() => {}, () => {});
      }
    } catch (e) { console.error('erro ao responder:', e.message); }
  });

  return sessoes[lojaId];
}

/* ==========================================================
   Sessão guardada no banco — sobrevive a reinícios do servidor
   ========================================================== */
async function authNoBanco(lojaId) {
  async function ler(chave) {
    try {
      const { data } = await sb.from('whatsapp_sessoes')
        .select('dados').eq('loja_id', lojaId).eq('chave', chave).maybeSingle();
      return data ? JSON.parse(data.dados, BufferJSON.reviver) : null;
    } catch (e) { return null; }
  }
  async function gravar(chave, valor) {
    try {
      await sb.from('whatsapp_sessoes').upsert({
        loja_id: lojaId, chave,
        dados: JSON.stringify(valor, BufferJSON.replacer),
        quando: new Date().toISOString()
      }, { onConflict: 'loja_id,chave' });
    } catch (e) { console.error('erro ao gravar sessao:', e.message); }
  }
  async function apagar(chave) {
    try { await sb.from('whatsapp_sessoes').delete()
      .eq('loja_id', lojaId).eq('chave', chave); } catch (e) {}
  }

  const creds = (await ler('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (tipo, ids) => {
          const r = {};
          await Promise.all(ids.map(async id => {
            let v = await ler(tipo + '-' + id);
            if (tipo === 'app-state-sync-key' && v) {
              const { proto } = require('@whiskeysockets/baileys');
              v = proto.Message.AppStateSyncKeyData.fromObject(v);
            }
            if (v) r[id] = v;
          }));
          return r;
        },
        set: async (dados) => {
          const tarefas = [];
          for (const tipo in dados) {
            for (const id in dados[tipo]) {
              const v = dados[tipo][id];
              tarefas.push(v ? gravar(tipo + '-' + id, v) : apagar(tipo + '-' + id));
            }
          }
          await Promise.all(tarefas);
        }
      }
    },
    saveCreds: () => gravar('creds', creds)
  };
}
async function limparSessaoBanco(lojaId) {
  if (!sb) return;
  try { await sb.from('whatsapp_sessoes').delete().eq('loja_id', lojaId); } catch (e) {}
}

/* ---------- respostas automáticas ---------- */
const memoria = {};   /* telefone -> ultimo atendimento */

/* tira acento, pontuação e espaço extra — o cliente escreve como quer */
function limpar(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[?!.,;:()\[\]{}'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
/* aceita erro de uma letra em palavras de 5+ caracteres */
function pareceCom(palavra, alvo) {
  if (palavra === alvo) return true;
  if (alvo.length < 5) return false;
  if (Math.abs(palavra.length - alvo.length) > 1) return false;
  let i = 0, j = 0, erros = 0;
  while (i < palavra.length && j < alvo.length) {
    if (palavra[i] === alvo[j]) { i++; j++; continue; }
    if (++erros > 1) return false;
    if (palavra.length > alvo.length) i++;
    else if (palavra.length < alvo.length) j++;
    else { i++; j++; }
  }
  return true;
}
function contem(texto, termos) {
  const palavras = texto.split(' ');
  return termos.some(termo => {
    const t = limpar(termo);
    if (!t) return false;
    if (t.includes(' ')) return texto.includes(t);          /* expressão */
    if (texto.includes(t)) return true;                     /* pedaço */
    return palavras.some(p => pareceCom(p, t));             /* erro de digitação */
  });
}
async function montarResposta(lojaId, tel, texto) {
  const cfg = await buscarCfg(lojaId);
  if (cfg?.robo_ativo === false) return null;

  const t = limpar(texto);
  const agora = Date.now();
  const ultima = memoria[tel] || 0;
  const primeiraVez = (agora - ultima) > 3 * 60 * 60 * 1000;   /* 3 horas */
  memoria[tel] = agora;

  const link = cfg?.link_cardapio || 'https://rafaeluendes-jpg.github.io/delivery/';
  const nome = cfg?.nome_loja || 'nossa loja';

  /* palavras-chave configuradas pela loja */
  for (const r of (cfg?.respostas || [])) {
    const chaves = String(r.chaves || '').split(',').map(x => x.trim()).filter(Boolean);
    if (contem(t, chaves)) {
      return String(r.resposta || '')
        .replace(/\{link\}/g, link).replace(/\{loja\}/g, nome);
    }
  }
  /* respostas de fábrica */
  if (contem(t, ['cardapio','menu','pedir','pedido','comprar','link','quero','fazer pedido',
      'como peco','como faco','site','delivery']))
    return `Claro! Faça seu pedido por aqui:\n${link}\n\nÉ só escolher os sabores e enviar. O pedido cai direto no nosso sistema.`;
  /* sabores: zero açúcar, lançamentos ou todos */
  if (contem(t, ['sabor','sabores','qual tem','que tem','tem hoje','disponivel','disponiveis',
      'zero','diet','sem acucar','diabetico','diabetes','light','lancamento','novidade',
      'novo sabor','cardapio de sabores','tem de que'])) {
    const resp = await responderSabores(t, link);
    if (resp) return resp;
  }
  if (contem(t, ['horario','aberto','abre','fecha','fechado','funciona','funcionamento',
      'que horas','ta aberto','esta aberto','atende']))
    return cfg?.texto_horario || 'Estamos abertos de terça a domingo, das 14h às 22h30. Segunda é nosso dia de folga.';
  /* o cliente citou um bairro ou cidade? responde com a taxa real */
  const zona = await acharZona(t);
  if (zona) {
    return `Entrega em *${zona.nome}* 🛵\n\n` +
      `Taxa: *R$ ${dinheiro(zona.taxa)}*` +
      (zona.tempo ? `\nTempo médio: ${zona.tempo} minutos` : '') +
      (zona.obs ? `\n_${zona.obs}_` : '') +
      `\n\nMonte seu pedido aqui:\n${link}`;
  }
  if (contem(t, ['taxa','entrega','frete','entregam','entregar','delivery','leva',
      'quanto fica a entrega','cobra quanto']))
    return cfg?.texto_entrega || `A taxa varia pelo bairro. Ao montar o pedido em ${link} você escolhe sua região e vê o valor exato.`;
  if (contem(t, ['pix','pagamento','pagar','cartao','dinheiro','debito','credito',
      'forma de pagamento','aceita cartao','maquininha']))
    return cfg?.texto_pagamento || 'Aceitamos dinheiro, Pix, débito e crédito. O pagamento é feito na entrega.';
  if (contem(t, ['onde','endereco','fica','localiza','local','rua','como chego','fica aonde']))
    return cfg?.texto_endereco || 'Estamos esperando você! Nosso endereço está no cardápio.';
  if (contem(t, ['ola','oi','opa','eai','bom dia','boa tarde','boa noite','tudo bem',
      'boa','alo','bom']) || primeiraVez)
    return cfg?.saudacao ||
      `Olá! 👋 Bem-vindo a ${nome}.\n\nFaça seu pedido por aqui:\n${link}\n\nSe precisar, é só chamar.`;

  /* nada das respostas prontas serviu: pergunta para a IA */
  if (cfg?.ia_ativa !== false && (GROQ_KEY || GEMINI_KEY)) {
    const r = await responderComIA(texto, tel, cfg, link, nome);
    if (r) return r;
  }
  return null;
}

/* ==========================================================
   IA — responde o que as respostas prontas não cobrem
   ========================================================== */
const historico = {};   /* telefone -> últimas mensagens */

async function montarContexto(cfg, link, nome) {
  const sabores = await carregarSabores();
  const zonas   = await carregarZonas();
  const zonaTxt = zonas.filter(z => z.tipo !== 'padrao')
    .map(z => `${z.nome} (${z.cidade}): R$ ${dinheiro(z.taxa)}`).join('; ');
  const norm  = sabores.filter(s => !s.zero_acucar && !s.lancamento).map(s => s.nome);
  const zero  = sabores.filter(s => s.zero_acucar).map(s => s.nome);
  const novos = sabores.filter(s => s.lancamento).map(s => s.nome);

  return `Você é o atendente virtual da ${nome}, uma gelateria artesanal.

INFORMAÇÕES REAIS DE HOJE (use apenas estas, nunca invente):
- Link do cardápio: ${link}
- Horário: ${(cfg?.texto_horario || 'todos os dias das 12h às 23h').replace(/\n/g, ' ')}
- Endereço: ${(cfg?.texto_endereco || 'informar pelo cardápio').replace(/\n/g, ' ')}
- Pagamento: dinheiro, Pix, débito e crédito, pagos na entrega
- Sabores tradicionais: ${norm.join(', ') || 'consultar no cardápio'}
- Zero açúcar: ${zero.join(', ') || 'nenhum hoje'}
- Lançamentos: ${novos.join(', ') || 'nenhum'}
- Taxas de entrega: ${zonaTxt || 'variam por bairro, informar no cardápio'}

COMO RESPONDER:
- Português do Brasil, tom acolhedor e direto, como um atendente de loja de bairro
- No máximo 3 frases curtas. Nada de textão.
- Pode usar um emoji, no máximo dois
- Quando fizer sentido, mande o link do cardápio
- Se perguntarem algo que não está acima, diga com sinceridade que vai confirmar
  com a equipe e peça um instante. NUNCA invente sabor, preço, taxa ou promoção.
- Se o cliente quiser cancelar ou reclamar de um pedido, peça o número do pedido
  e avise que a equipe vai verificar.
- Não fale de assuntos fora da gelateria.`;
}

async function responderComIA(mensagem, tel, cfg, link, nome) {
  const sistema = await montarContexto(cfg, link, nome);
  historico[tel] = (historico[tel] || []).slice(-6);
  const msgs = [...historico[tel], { role: 'user', content: mensagem }];

  let resposta = null;
  if (GROQ_KEY)   resposta = await chamarGroq(sistema, msgs);
  if (!resposta && GEMINI_KEY) resposta = await chamarGemini(sistema, msgs);
  if (!resposta) return null;

  historico[tel] = [...msgs, { role: 'assistant', content: resposta }].slice(-6);
  return resposta;
}

async function chamarGroq(sistema, msgs) {
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: sistema }, ...msgs],
        temperature: 0.5, max_tokens: 300
      })
    });
    if (!r.ok) { console.log('groq falhou:', r.status); return null; }
    const d = await r.json();
    return d.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) { console.log('groq erro:', e.message); return null; }
}

async function chamarGemini(sistema, msgs) {
  try {
    const conteudo = msgs.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sistema }] },
          contents: conteudo,
          generationConfig: { temperature: 0.5, maxOutputTokens: 300 }
        }) });
    if (!r.ok) { console.log('gemini falhou:', r.status); return null; }
    const d = await r.json();
    return d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (e) { console.log('gemini erro:', e.message); return null; }
}

function dinheiro(v){
  return (Number(v)||0).toFixed(2).replace('.', ',');
}
function semAcento(s){
  return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
/* procura o bairro ou a cidade que o cliente citou */
let _zonasCache = { quando: 0, lista: [] };
async function carregarZonas() {
  if (!sb) return [];
  if (Date.now() - _zonasCache.quando < 5 * 60 * 1000) return _zonasCache.lista;
  try {
    const { data } = await sb.from('areas_entrega').select('*, areas_zonas(*)');
    const lista = [];
    (data || []).forEach(a => {
      lista.push({ nome: a.nome, taxa: a.taxa_padrao, tempo: a.tempo, cidade: a.nome, tipo: 'cidade' });
      (a.areas_zonas || []).forEach(z => {
        if (z.ativa === false) return;
        lista.push({ nome: z.nome, taxa: z.taxa, tempo: z.tempo, obs: z.observacao,
          cidade: a.nome, tipo: z.tipo });
      });
    });
    _zonasCache = { quando: Date.now(), lista };
    return lista;
  } catch (e) { return []; }
}
async function acharZona(texto) {
  const t = limpar(texto);
  const zonas = await carregarZonas();
  /* casa pelo nome mais longo primeiro, para "jardim america" ganhar de "jardim" */
  const ordenadas = zonas.slice().sort((a, b) => String(b.nome).length - String(a.nome).length);
  for (const z of ordenadas) {
    const n = semAcento(z.nome);
    if (n.length < 4) continue;
    if (t.includes(n)) return z;
  }
  /* palavras genéricas de zona rural */
  if (contem(t, ['sitio','chacara','rancho','fazenda','estrada','zona rural','interior','roca'])) {
    const rural = zonas.find(z => z.tipo === 'rural');
    if (rural) return rural;
  }
  return null;
}
/* sabores disponíveis, lidos das fichas técnicas */
let _saboresCache = { quando: 0, lista: [] };
async function carregarSabores() {
  if (!sb) return [];
  if (Date.now() - _saboresCache.quando < 3 * 60 * 1000) return _saboresCache.lista;
  try {
    const { data } = await sb.from('fichas_tecnicas')
      .select('nome, zero_acucar, disponivel_hoje, lancamento')
      .eq('disponivel_hoje', true)
      .order('nome');
    const lista = (data || []).filter(f => /^(?!.*(massa|base)).*$/i.test(f.nome));
    _saboresCache = { quando: Date.now(), lista };
    return lista;
  } catch (e) { return []; }
}
async function responderSabores(t, link) {
  const sabores = await carregarSabores();
  if (!sabores.length) return null;
  const zero = sabores.filter(s => s.zero_acucar);
  const normais = sabores.filter(s => !s.zero_acucar && !s.lancamento);
  const novos = sabores.filter(s => s.lancamento);
  const lista = arr => arr.map(s => '• ' + s.nome).join('\n');

  if (contem(t, ['zero','diet','sem acucar','diabetico','diabetes','light'])) {
    if (!zero.length) return 'Hoje não temos sabores zero açúcar disponíveis 😔\n\nMas amanhã pode ter! Dá uma olhada no cardápio:\n' + link;
    return 'Nossos *zero açúcar* de hoje 🍨\n\n' + lista(zero) +
      '\n\nTodos sem açúcar adicionado — bom para quem controla.\n\nPeça aqui:\n' + link;
  }
  if (contem(t, ['lancamento','novidade','novo','nova','recente'])) {
    if (!novos.length) return null;
    return 'Nossos *lançamentos* ✨\n\n' + lista(novos) +
      '\n\nVale provar! Peça aqui:\n' + link;
  }
  let r = '*Sabores de hoje* 🍨\n\n' + lista(normais);
  if (novos.length) r += '\n\n*Lançamentos* ✨\n' + lista(novos);
  if (zero.length) r += '\n\n*Zero açúcar*\n' + lista(zero);
  r += '\n\nOs sabores mudam conforme a produção do dia.\n\nPeça aqui:\n' + link;
  return r;
}
async function buscarCfg(lojaId) {
  if (!sb) return {};
  try {
    const { data } = await sb.from('whatsapp_config')
      .select('*').eq('sucursal_id', lojaId).maybeSingle();
    return data || {};
  } catch (e) { return {}; }
}

/* ---------- rotas ---------- */
app.get('/', (_, res) => res.json({
  nome: 'Nexor WhatsApp', ok: true,
  lojas: Object.keys(sessoes).map(id => ({
    loja: id, estado: sessoes[id].estado, numero: sessoes[id].numero || null
  }))
}));

/* liga uma loja e devolve o QR */
app.post('/conectar/:loja', protege, async (req, res) => {
  const loja = req.params.loja;
  try {
    console.log('[' + loja + '] pedido de conexao');
    await conectar(loja, true);
    let tentativas = 0;
    while (tentativas < 60) {
      const s = sessoes[loja];
      if (s?.qr || s?.estado === 'conectado') break;
      await new Promise(r => setTimeout(r, 500));
      tentativas++;
    }
    const s = sessoes[loja] || {};
    console.log('[' + loja + '] estado=' + s.estado + ' qr=' + (s.qr ? 'sim' : 'nao'));
    res.json({
      estado: s.estado || 'desligado',
      qr: s.qr || null,
      numero: s.numero || null,
      esperou: tentativas * 0.5 + 's'
    });
  } catch (e) {
    console.error('[' + loja + '] erro ao conectar:', e.message);
    res.status(500).json({ erro: e.message });
  }
});

/* diagnóstico: mostra o que está acontecendo em cada loja */
app.get('/diagnostico', (req, res) => {
  res.json({
    ok: true,
    banco: !!sb,
    pasta: PASTA,
    chaveExigida: EXIGE_CHAVE,
    ia: { groq: !!GROQ_KEY, gemini: !!GEMINI_KEY },
    variaveisRecebidas: Object.keys(process.env)
      .filter(k => /SUPA|CHAVE|SB_/i.test(k)),
    sessoes: Object.keys(sessoes).map(id => ({
      loja: id, estado: sessoes[id].estado,
      temQr: !!sessoes[id].qr, numero: sessoes[id].numero || null
    }))
  });
});

app.get('/estado/:loja', protege, (req, res) => {
  const s = sessoes[req.params.loja];
  res.json({ estado: s?.estado || 'desligado', qr: s?.qr || null, numero: s?.numero || null });
});

app.post('/desconectar/:loja', protege, async (req, res) => {
  const s = sessoes[req.params.loja];
  try { await s?.sock?.logout(); } catch (e) {}
  try { fs.rmSync(path.join(PASTA, String(req.params.loja)), { recursive: true, force: true }); } catch (e) {}
  await limparSessaoBanco(req.params.loja);
  delete sessoes[req.params.loja];
  res.json({ ok: true });
});

/* envia uma mensagem */
const ultimosEnvios = [];
function registrar(o) {
  ultimosEnvios.unshift({ ...o, quando: new Date().toISOString() });
  if (ultimosEnvios.length > 40) ultimosEnvios.pop();
  console.log('[envio]', JSON.stringify(o));
}
app.get('/envios', (req, res) => res.json({
  total: ultimosEnvios.length,
  sessoes: Object.keys(sessoes).map(k => ({ loja: k, estado: sessoes[k].estado })),
  envios: ultimosEnvios
}));

app.post('/enviar', protege, async (req, res) => {
  const { loja, telefone, texto } = req.body || {};
  if (!loja || !telefone || !texto) {
    registrar({ ok: false, motivo: 'faltou loja, telefone ou texto',
      recebido: { loja, telefone, temTexto: !!texto } });
    return res.status(400).json({ erro: 'informe loja, telefone e texto' });
  }
  let s = sessoes[loja];
  /* a loja pedida não tem sessão? usa a única conectada, se houver */
  if (!s?.sock || s.estado !== 'conectado') {
    const conectadas = Object.keys(sessoes)
      .filter(k => sessoes[k]?.sock && sessoes[k].estado === 'conectado');
    if (conectadas.length === 1) {
      console.log('loja ' + loja + ' sem sessao — usando ' + conectadas[0]);
      s = sessoes[conectadas[0]];
    } else {
      registrar({ ok: false, motivo: 'nenhuma loja conectada',
        pedida: loja, conectadas, telefone });
      return res.status(409).json({
        erro: 'nenhuma loja conectada', pedida: loja, conectadas
      });
    }
  }
  try {
    const num = String(telefone).replace(/\D/g, '');
    const jid = (num.startsWith('55') ? num : '55' + num) + '@s.whatsapp.net';
    await s.sock.sendMessage(jid, { text: texto });
    registrar({ ok: true, para: jid, loja, inicio: texto.slice(0, 40) });
    if (sb) sb.from('whatsapp_mensagens').insert([{
      sucursal_id: loja, telefone: num, direcao: 'enviada', texto
    }]).then(() => {}, () => {});
    res.json({ ok: true, para: jid });
  } catch (e) {
    registrar({ ok: false, motivo: 'erro ao enviar: ' + e.message, loja, telefone });
    res.status(500).json({ erro: e.message });
  }
});

/* reconecta as sessões salvas ao subir */
async function retomar() {
  /* sessões guardadas no banco */
  if (sb) {
    try {
      const { data } = await sb.from('whatsapp_sessoes')
        .select('loja_id').eq('chave', 'creds');
      for (const r of (data || [])) {
        console.log('retomando loja', r.loja_id, '(do banco)');
        conectar(r.loja_id).catch(() => {});
      }
      if ((data || []).length) return;
    } catch (e) { console.error('erro ao retomar do banco:', e.message); }
  }
  /* sessões em arquivo, se houver */
  try {
    for (const d of fs.readdirSync(PASTA)) {
      if (fs.existsSync(path.join(PASTA, d, 'creds.json'))) {
        console.log('retomando loja', d, '(do disco)');
        conectar(d).catch(() => {});
      }
    }
  } catch (e) {}
}

app.listen(PORTA, () => {
  console.log('Nexor WhatsApp no ar na porta', PORTA);
  retomar();
});
