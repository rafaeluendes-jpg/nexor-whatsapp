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
const CANAL = require('./canal');
const LANC  = require('./lancamento');
const REL   = require('./relatorio');
const {
  default: makeWASocket,
  downloadMediaMessage,
  useMultiFileAuthState,
  initAuthCreds,
  BufferJSON,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

const app = express();

/* ---------- de quais endereços o navegador pode chamar ----------
   Sem isso, uma página de qualquer site conseguiria chamar o robô
   pelo navegador de quem estivesse logado no Nexor.
   Acrescente domínios em ORIGENS_LIBERADAS (separados por vírgula). */
const ORIGENS = String(process.env.ORIGENS_LIBERADAS || '')
  .split(',').map(x => x.trim()).filter(Boolean)
  .concat([
    'https://radiant-stardust-71e592.netlify.app',
    'https://rafaeluendes-jpg.github.io',
    'https://nexor.com.br',
    'https://www.nexor.com.br'
  ]);
app.use(cors({
  origin(origem, ok) {
    /* sem origem = chamada fora do navegador (o próprio robô, teste manual) */
    if (!origem) return ok(null, true);
    if (ORIGENS.indexOf(origem) >= 0) return ok(null, true);
    if (/^http:\/\/localhost(:\d+)?$/.test(origem)) return ok(null, true);
    return ok(new Error('origem não liberada'));
  }
}));
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
/* Se existe chave configurada, ela é exigida. Só fica aberto quem
   não configurou chave nenhuma — e isso agora aparece no log. */
const EXIGE_CHAVE = CHAVE
  ? String(process.env.EXIGIR_CHAVE || 'sim') !== 'nao'
  : false;
const SB_URL = varAmbiente('SUPABASE_URL', 'SUPA_URL', 'SB_URL')
            || acharPorConteudo(v => /^https:\/\/[a-z0-9]+\.supabase\.co/.test(v));
/* A chave do banco: a SECRETA tem preferência.
   O robô escreve em tabelas que o navegador não pode tocar (sessões do
   WhatsApp, conversas de cliente). Com a chave pública ele só consegue
   isso enquanto essas tabelas estiverem abertas para qualquer um — que
   é exatamente o que não pode continuar. Com a secreta, ele passa por
   cima do RLS e as tabelas ficam fechadas para o resto do mundo. */
const SB_KEY_SECRETA = varAmbiente('SUPABASE_SERVICE_KEY','SUPABASE_SECRET','SB_SECRET')
            || acharPorConteudo(v => /^sb_secret_/.test(v))
            || acharPorConteudo(v => /^eyJ/.test(v) && /"role"\s*:\s*"service_role"/.test(
                 (() => { try { return Buffer.from(v.split('.')[1] || '', 'base64').toString(); }
                          catch (e) { return ''; } })()));
const SB_KEY_PUBLICA = varAmbiente('SUPABASE_KEY', 'SUPA_KEY', 'SB_KEY')
            || acharPorConteudo(v => /^(sb_publishable_|eyJ)/.test(v));
const SB_KEY = SB_KEY_SECRETA || SB_KEY_PUBLICA;
const CHAVE_E_SECRETA = !!SB_KEY_SECRETA;
/* chaves de IA — encontradas pelo formato, o nome não importa */
const GROQ_KEY   = varAmbiente('GROQ_KEY','GROQ_API_KEY') || acharPorConteudo(v => /^gsk_/.test(v));
const GEMINI_KEY = varAmbiente('GEMINI_KEY','GOOGLE_KEY') || acharPorConteudo(v => /^AIza/.test(v));
console.log('banco:', SB_URL ? 'encontrado' : 'faltando',
            '| chave do banco:', SB_KEY
              ? (CHAVE_E_SECRETA ? 'SECRETA (correta)' : 'PÚBLICA — troque pela secreta')
              : 'faltando');
if (SB_KEY && !CHAVE_E_SECRETA) {
  console.log('ATENÇÃO — o robô está com a chave pública do banco.');
  console.log('  Ele só grava sessões e mensagens enquanto essas tabelas');
  console.log('  estiverem abertas para qualquer um. Troque o valor de');
  console.log('  CHAVE_BANCO pela chave secreta (service_role) do Supabase.');
}
console.log('IA — Groq:', GROQ_KEY ? 'ok' : 'faltando',
            '| Gemini:', GEMINI_KEY ? 'ok' : 'faltando');
console.log(EXIGE_CHAVE
  ? 'acesso: protegido por chave'
  : 'ATENÇÃO — acesso ABERTO: defina CHAVE_API nas variáveis do Render');
const PASTA   = process.env.PASTA_SESSOES || './sessoes';

const sb = (SB_URL && SB_KEY) ? createClient(SB_URL, SB_KEY) : null;
const log = pino({ level: 'warn' });
const sessoes = {};   /* lojaId -> { sock, qr, estado, numero } */

if (!fs.existsSync(PASTA)) fs.mkdirSync(PASTA, { recursive: true });

/* ---------- autenticação ----------
   Duas portas, nesta ordem:

   1) A SESSÃO DO NEXOR. O sistema manda o token de quem está logado.
      O robô pergunta ao Supabase de quem é aquele token e lê o perfil
      dessa pessoa. Não existe chave para distribuir a cliente nenhum,
      e o comando fica preso à loja de quem mandou — quem é de Jales
      não desconecta o WhatsApp de São Paulo.

   2) A CHAVE FIXA. Continua valendo, para chamada de máquina (um
      script, um agendador) que não tem sessão de gente.            */

const _cacheToken = new Map();          /* token -> { perfil, ate } */
const VIDA_CACHE = 60 * 1000;

async function perfilDoToken(token) {
  if (!token || !SB_URL) return null;
  const agora = Date.now();
  const guardado = _cacheToken.get(token);
  if (guardado && guardado.ate > agora) return guardado.perfil;

  try {
    /* de quem é este token? quem responde é o Supabase, não o robô */
    const r = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u?.id) return null;

    if (!sb) return null;
    const { data } = await sb.from('perfis')
      .select('id, nome, cargo, loja_id').eq('id', u.id).maybeSingle();
    if (!data) return null;

    _cacheToken.set(token, { perfil: data, ate: agora + VIDA_CACHE });
    if (_cacheToken.size > 500) {
      for (const [k, v] of _cacheToken) if (v.ate <= agora) _cacheToken.delete(k);
    }
    return data;
  } catch (e) { return null; }
}

async function autorizado(req) {
  const cab = String(req.headers['authorization'] || '');
  if (cab.startsWith('Bearer ')) {
    const perfil = await perfilDoToken(cab.slice(7).trim());
    if (perfil) { req.perfil = perfil; return true; }
  }
  if (!EXIGE_CHAVE) return true;        /* nenhuma chave configurada */
  const c = req.headers['x-chave'] || req.query.chave;
  return !!CHAVE && c === CHAVE;
}

async function protege(req, res, next) {
  if (!(await autorizado(req)))
    return res.status(401).json({ erro: 'sessão ou chave inválida' });
  next();
}

/* A loja pedida tem de ser a de quem mandou. Sem isso, qualquer pessoa
   logada em qualquer rede comandaria o WhatsApp de qualquer loja.
   Quem entrou pela chave fixa não tem perfil, e passa — é chamada de
   máquina, já autenticada pela chave. */
function daMinhaLoja(req, res, next) {
  const p = req.perfil;
  if (!p) return next();
  const pedida = String(req.params.loja || req.body?.loja || '').trim();
  if (!pedida) return next();
  if (String(p.loja_id) !== pedida && p.cargo !== 'plataforma')
    return res.status(403).json({ erro: 'esta loja não é sua' });
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
                     msg.message?.extendedTextMessage?.text ||
                     msg.message?.imageMessage?.caption || '').trim();

      /* foto da nota: sem isso o gestor manda a nota e o robô fica mudo */
      let imagem = null;
      if (msg.message?.imageMessage) {
        try {
          const buf = await downloadMediaMessage(msg, 'buffer', {},
            { logger: log, reuploadRequest: sock.updateMediaMessage });
          if (buf && buf.length < 5 * 1024 * 1024) {
            imagem = { base64: buf.toString('base64'),
                       tipo: msg.message.imageMessage.mimetype || 'image/jpeg' };
          }
        } catch (e) { console.error('foto:', e && e.message); }
      }
      if (!texto && !imagem) return;

      const tel = de.split('@')[0];
      const resposta = await montarResposta(lojaId, tel, texto, imagem);
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

/* =====================================================================
   ASSISTENTE DE GESTÃO DO NEXOR
   Não é a atendente que fala com cliente. Esta responde ao GESTOR da loja,
   lendo o MESMO banco que o sistema lê — por isso o número nunca diverge
   do que aparece na tela do Nexor.
   Só atende o número cadastrado como gestor daquela loja.
   ===================================================================== */
const soDigito = (v) => String(v || '').replace(/\D/g, '');

function ehGestor(cfg, tel) {
  const g = soDigito(cfg && cfg.gestor_zap);
  if (!g) return false;
  const t = soDigito(tel);
  return t.endsWith(g.slice(-8)) && g.length >= 8;
}

function hojeSP() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

/* ---- faturamento do dia ---- */
async function respFaturamento(lojaLoja) {
  const hoje = hojeSP();
  const { data } = await sb.from('pedidos')
    .select('total,tipo,fase').eq('loja_id', lojaLoja).eq('data_venda', hoje);
  const ps = (data || []).filter(p => p.fase !== 'cancelado');
  const tot = ps.reduce((a, p) => a + (Number(p.total) || 0), 0);
  if (!ps.length) return 'Ainda não há venda registrada hoje.';
  const tm = tot / ps.length;
  return `📊 *Faturamento de hoje*\n\n` +
    `Total: *R$ ${dinheiro(tot)}*\n` +
    `Pedidos: ${ps.length}\n` +
    `Ticket médio: R$ ${dinheiro(tm)}`;
}

/* ---- saldo de um insumo ---- */
async function respEstoque(lojaLoja, termo) {
  const busca = limpar(termo).trim();
  if (busca.length < 3) return 'Me diga o nome do item com pelo menos 3 letras.';
  const { data } = await sb.from('insumos')
    .select('nome,estoque_atual,estoque_min,unidade,custo')
    .eq('loja_id', lojaLoja).ilike('nome', '%' + busca + '%').limit(6);
  if (!data || !data.length) return `Não achei nenhum item com "${termo}".`;
  if (data.length === 1) {
    const i = data[0];
    const baixo = Number(i.estoque_atual) <= Number(i.estoque_min);
    return `📦 *${i.nome}*\n\nSaldo: *${dinheiro(i.estoque_atual)} ${i.unidade || ''}*\n` +
      `Mínimo: ${dinheiro(i.estoque_min)} ${i.unidade || ''}` +
      (baixo ? '\n\n⚠️ Está abaixo do mínimo.' : '');
  }
  return `Achei ${data.length} itens:\n\n` + data.map(i =>
    `• ${i.nome} — ${dinheiro(i.estoque_atual)} ${i.unidade || ''}`).join('\n') +
    '\n\nMe diga qual deles.';
}

/* ---- o que precisa comprar ---- */
async function respComprar(lojaLoja) {
  const { data } = await sb.from('insumos')
    .select('nome,estoque_atual,estoque_min,unidade')
    .eq('loja_id', lojaLoja).eq('controla_estoque', true).limit(400);
  const faltam = (data || []).filter(i =>
    Number(i.estoque_min) > 0 && Number(i.estoque_atual) <= Number(i.estoque_min));
  if (!faltam.length) return '✅ Nenhum item abaixo do mínimo. Estoque em dia.';
  return `🛒 *Precisa comprar* (${faltam.length} itens)\n\n` +
    faltam.slice(0, 25).map(i =>
      `• ${i.nome} — tem ${dinheiro(i.estoque_atual)}, mínimo ${dinheiro(i.estoque_min)} ${i.unidade || ''}`
    ).join('\n') + (faltam.length > 25 ? `\n\n…e mais ${faltam.length - 25}.` : '');
}

/* ---- boletos a pagar ---- */
async function respBoletos(lojaLoja) {
  const hoje = hojeSP();
  const { data } = await sb.from('lancamentos_financeiros')
    .select('descricao,valor,vencimento,fornecedor_nome')
    .eq('loja_id', lojaLoja).eq('tipo', 'despesa').eq('pago', false)
    .lte('vencimento', hoje).order('vencimento');
  if (!data || !data.length) return '✅ Nenhum boleto vencido ou vencendo hoje.';
  const tot = data.reduce((a, l) => a + (Number(l.valor) || 0), 0);
  return `💰 *A pagar até hoje* (${data.length})\n\n` + data.slice(0, 15).map(l =>
    `• ${l.descricao} — R$ ${dinheiro(l.valor)} (venc. ${(l.vencimento || '').split('-').reverse().join('/')})`
  ).join('\n') + `\n\nTotal: *R$ ${dinheiro(tot)}*`;
}

/* ---- checklist: grava a resposta ---- */
async function respChecklist(lojaLoja, tel, texto) {
  const hoje = hojeSP();
  const { data: abertas } = await sb.from('assistente_conversas')
    .select('id,rotina_nome,pergunta').eq('loja_id', lojaLoja).eq('data', hoje)
    .is('respondida_em', null).limit(1);
  if (!abertas || !abertas.length) return null;
  const t = limpar(texto);
  const sim = /\b(sim|ja fiz|feito|fiz|ok|pronto|concluido)\b/.test(t);
  const nao = /\b(nao|ainda nao|negativo|nao fiz)\b/.test(t);
  if (!sim && !nao) return null;
  await sb.from('assistente_conversas').update({
    respondida_em: new Date().toISOString(),
    resposta: texto, feito: sim, telefone: tel
  }).eq('id', abertas[0].id);
  return sim
    ? `✅ Anotado: *${abertas[0].rotina_nome}* feito hoje. Obrigada!`
    : `📝 Anotado que o *${abertas[0].rotina_nome}* ainda não foi feito. Vou lembrar mais tarde.`;
}

/* ---- agendador: cobra as rotinas no horário ----
   Roda de 10 em 10 minutos. Para cada loja com assistente ligada, procura as
   rotinas do dia que ainda não foram enviadas e manda a pergunta ao gestor.
   O registro nasce aqui; a resposta preenche o resto. */
async function cobrarRotinas() {
  if (!sb) return;
  try {
    const { data: cfgs } = await sb.from('whatsapp_config')
      .select('sucursal_id,loja_id,gestor_zap,assistente_ativa')
      .eq('assistente_ativa', true);
    if (!cfgs || !cfgs.length) return;

    const hoje = hojeSP();
    const agora = new Date(Date.now() - 3 * 3600 * 1000);
    const hm = String(agora.getUTCHours()).padStart(2, '0') + ':' +
               String(agora.getUTCMinutes()).padStart(2, '0');
    const diaSem = agora.getUTCDay() === 0 ? 7 : agora.getUTCDay();

    for (const cfg of cfgs) {
      if (!soDigito(cfg.gestor_zap)) continue;
      const ses = sessoes[cfg.sucursal_id];
      if (!ses || ses.estado !== 'conectado' || !ses.sock) continue;
      const sock = ses.sock;

      const { data: rots } = await sb.from('assistente_rotinas')
        .select('*').eq('loja_id', cfg.loja_id).eq('ativa', true).order('ordem');
      for (const r of (rots || [])) {
        const dias = Array.isArray(r.dias) ? r.dias : [1,2,3,4,5,6];
        if (dias.indexOf(diaSem) < 0) continue;
        if (hm < (r.hora || '10:00')) continue;          /* ainda não deu a hora */

        const ref = 'cv_' + r.id + '_' + hoje;
        const { data: ja } = await sb.from('assistente_conversas')
          .select('id').eq('ref_local', ref).maybeSingle();
        if (ja) continue;                                 /* já cobrou hoje */

        await sb.from('assistente_conversas').insert({
          loja_id: cfg.loja_id, ref_local: ref, rotina_id: r.id,
          rotina_nome: r.nome, data: hoje, pergunta: r.pergunta,
          telefone: soDigito(cfg.gestor_zap)
        });
        const jid = soDigito(cfg.gestor_zap).replace(/^0+/, '');
        const num = jid.startsWith('55') ? jid : '55' + jid;
        await sock.sendMessage(num + '@s.whatsapp.net', { text: r.pergunta });
        console.log('rotina cobrada:', r.nome, cfg.sucursal_id);
      }
    }
  } catch (e) { console.error('cobrarRotinas', e && e.message); }
}
setInterval(cobrarRotinas, 10 * 60 * 1000);
setTimeout(cobrarRotinas, 60 * 1000);

/* ---- roteador da assistente de gestão ---- */
/* "comprei 10kg de acucar por 45" — a intencao de lancar tem cara propria.
   Sem isso, "comprei" cairia na atendente e ele receberia oferta de gelato. */
function pareceLancamento(t) {
  return /\b(comprei|compramos|lancar|lançar|lanca|nota fiscal|nota de|entrada de|chegou|recebi)\b/.test(t)
      && /[\d]/.test(t);
}

async function respostaGestao(lojaLoja, cfg, tel, texto, imagemRecebida) {
  if (!sb) return null;
  if (cfg.assistente_ativa === false) return null;
  if (!ehGestor(cfg, tel)) return null;

  /* Conversa de lançamento em andamento vem ANTES de tudo: enquanto ele
     está conferindo item a item, "sim" é resposta de item, não de checklist. */
  if (LANC.temConversaAberta(tel)) {
    const r = await LANC.responder({
      sb, telefone: tel, texto,
      gravar: (sessao) => LANC.gravarPendente(sb, sessao)
    });
    if (r) return r;
  }

  /* resposta de checklist tem prioridade: pode ser só "sim" */
  const ck = await respChecklist(lojaLoja, tel, texto);
  if (ck) return ck;

  const t = limpar(texto);

  /* foto da nota, ou ele descrevendo a compra */
  if (imagemRecebida || pareceLancamento(t)) {
    const r = await LANC.iniciar({
      sb, lojaId: lojaLoja, sucursalId: cfg.sucursal_id, telefone: tel,
      texto, imagem: imagemRecebida, chamarIA: chamarIAExtrair
    });
    if (r) return r;
  }

  if (contem(t, ['faturamento', 'quanto vendi', 'quanto vendeu', 'venda de hoje',
                 'vendas de hoje', 'quanto foi hoje', 'total do dia']))
    return respFaturamento(lojaLoja);

  if (contem(t, ['precisa comprar', 'lista de compra', 'o que comprar',
                 'abaixo do minimo', 'estoque baixo', 'falta o que']))
    return respComprar(lojaLoja);

  if (contem(t, ['boleto', 'a pagar', 'contas a pagar', 'vencendo', 'vencido']))
    return respBoletos(lojaLoja);

  const mEst = t.match(/(?:quanto tem de|estoque de|saldo de|quanto de)\s+(.+)/);
  if (mEst) return respEstoque(lojaLoja, mEst[1]);

  if (contem(t, ['menu', 'o que voce faz', 'ajuda', 'comandos']))
    return '🤖 *Assistente Nexor*\n\nPode me perguntar:\n' +
      '• _qual o faturamento de hoje_\n' +
      '• _quanto tem de açúcar_\n' +
      '• _o que precisa comprar_\n' +
      '• _tem boleto para pagar_\n\n' +
      'E eu te cobro o checklist todo dia.';
  return null;
}

async function montarResposta(lojaId, tel, texto, imagem) {
  const cfg = await buscarCfg(lojaId);
  if (cfg?.robo_ativo === false) return null;

  /* o gestor da loja fala com a assistente de gestão, não com a atendente */
  try {
    const g = await respostaGestao(cfg.loja_id || lojaId, cfg, tel, texto, imagem);
    if (g) return g;
  } catch (e) { console.error('gestao', e && e.message); }

  const t = limpar(texto);
  const agora = Date.now();
  const ultima = memoria[tel] || 0;
  const primeiraVez = (agora - ultima) > 3 * 60 * 60 * 1000;   /* 3 horas */
  memoria[tel] = agora;

  const link = cfg?.link_cardapio || 'https://rafaeluendes-jpg.github.io/delivery/';
  const nome = cfg?.nome_loja || 'nossa loja';

  /* Um OU outro, nunca os dois — era isso que dava conflito.
     Atendente ligada: só ela responde. Desligada: só as respostas prontas. */
  const querIA = cfg?.ia_ativa !== false;

  if (querIA) {
    if (GROQ_KEY || GEMINI_KEY) {
      const r = await responderComIA(texto, tel, cfg, link, nome, primeiraVez);
      if (r) return r;
      /* a IA não soube responder: ela mesma pede desculpa, sem passar a bola
         para a resposta pronta e sair com outro tom no meio da conversa */
      return `Não entendi bem 😅 Pode me explicar de outro jeito?\n\n` +
             `Se preferir, o cardápio está aqui: ${link}`;
    }
    /* sem chave de IA configurada: as respostas prontas seguram, senão fica mudo */
    return respostaPronta(t, cfg, link, nome, primeiraVez);
  }

  return respostaPronta(t, cfg, link, nome, primeiraVez);
}

/* respostas fixas — apoio quando a IA não responde */
async function respostaPronta(t, cfg, link, nome, primeiraVez) {
  for (const r of (cfg?.respostas || [])) {
    const chaves = String(r.chaves || '').split(',').map(x => x.trim()).filter(Boolean);
    if (contem(t, chaves)) {
      return String(r.resposta || '')
        .replace(/\{link\}/g, link).replace(/\{loja\}/g, nome);
    }
  }
  if (contem(t, ['sabor','sabores','qual tem','que tem','tem hoje','disponivel','disponiveis',
      'zero','diet','sem acucar','diabetico','diabetes','light','lancamento','novidade',
      'novo sabor','cardapio de sabores','tem de que'])) {
    const resp = await responderSabores(t, link);
    if (resp) return resp;
  }
  const zona = await acharZona(t);
  if (zona) {
    return `Entrega em *${zona.nome}* 🛵\n\n` +
      `Taxa: *R$ ${dinheiro(zona.taxa)}*` +
      (zona.tempo ? `\nTempo médio: ${zona.tempo} minutos` : '') +
      (zona.obs ? `\n_${zona.obs}_` : '') +
      `\n\nMonte seu pedido aqui:\n${link}`;
  }
  if (contem(t, ['cardapio','menu','pedir','pedido','comprar','link','quero','fazer pedido',
      'como peco','como faco','site','delivery']))
    return `Claro! Faça seu pedido por aqui:\n${link}\n\nÉ só escolher os sabores e enviar. O pedido cai direto no nosso sistema.`;
  if (contem(t, ['horario','aberto','abre','fecha','fechado','funciona','funcionamento',
      'que horas','ta aberto','esta aberto','atende']))
    return cfg?.texto_horario || 'Estamos abertos todos os dias, das 12h às 23h.';
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
  return null;
}


/* zonas de entrega, lidas do sistema */
let _zonasCache = { quando: 0, lista: [] };
async function carregarZonas() {
  if (!sb) return [];
  if (Date.now() - _zonasCache.quando < 5 * 60 * 1000) return _zonasCache.lista;
  try {
    const { data } = await sb.from('areas_entrega').select('*, areas_zonas(*)');
    const lista = [];
    (data || []).forEach(a => {
      lista.push({ nome: a.nome, taxa: a.taxa_padrao, tempo: a.tempo,
        cidade: a.nome, tipo: 'cidade' });
      (a.areas_zonas || []).forEach(z => {
        if (z.ativa === false) return;
        lista.push({ nome: z.nome, taxa: z.taxa, tempo: z.tempo,
          obs: z.observacao, cidade: a.nome, tipo: z.tipo });
      });
    });
    _zonasCache = { quando: Date.now(), lista };
    return lista;
  } catch (e) { return []; }
}
async function acharZona(texto) {
  const t = limpar(texto);
  const zonas = await carregarZonas();
  const ordenadas = zonas.slice().sort((a, b) => String(b.nome).length - String(a.nome).length);
  for (const z of ordenadas) {
    const n = limpar(z.nome);
    if (n.length < 4) continue;
    if (t.includes(n)) return z;
  }
  if (contem(t, ['sitio','chacara','rancho','fazenda','estrada','zona rural','interior','roca'])) {
    const rural = zonas.find(z => z.tipo === 'rural');
    if (rural) return rural;
  }
  return null;
}
function dinheiro(v) { return (Number(v) || 0).toFixed(2).replace('.', ','); }

/* ==========================================================
   IA — a atendente virtual
   ========================================================== */
const historico = {};
const TONS = {
  acolhedor: 'acolhedor e caloroso, como um atendente simpático de loja de bairro',
  direto:    'direto e objetivo, sem rodeios, resolvendo rápido',
  animado:   'animado e descontraído, com energia, mas sem exagero',
  formal:    'cordial e respeitoso, um pouco mais formal'
};

/* sabores disponíveis, lidos das fichas técnicas */
let _saboresCache = { quando: 0, lista: [] };
async function carregarSabores() {
  if (!sb) return [];
  if (Date.now() - _saboresCache.quando < 3 * 60 * 1000) return _saboresCache.lista;
  try {
    const { data } = await sb.from('fichas_tecnicas')
      .select('nome, zero_acucar, disponivel_hoje, lancamento')
      .eq('disponivel_hoje', true).order('nome');
    const lista = (data || []).filter(f => !/massa|base/i.test(f.nome || ''));
    _saboresCache = { quando: Date.now(), lista };
    return lista;
  } catch (e) { return []; }
}
async function responderSabores(t, link) {
  const sabores = await carregarSabores();
  if (!sabores.length) return null;
  const zero   = sabores.filter(s => s.zero_acucar);
  const normais= sabores.filter(s => !s.zero_acucar && !s.lancamento);
  const novos  = sabores.filter(s => s.lancamento);
  const lista  = arr => arr.map(s => '• ' + s.nome).join('\n');

  if (contem(t, ['zero','diet','sem acucar','diabetico','diabetes','light'])) {
    if (!zero.length) return 'Hoje não temos sabores zero açúcar 😔\n\nVeja o cardápio:\n' + link;
    return 'Nossos *zero açúcar* de hoje 🍨\n\n' + lista(zero) +
      '\n\nPeça aqui:\n' + link;
  }
  if (contem(t, ['lancamento','novidade','novo','nova','recente'])) {
    if (!novos.length) return null;
    return 'Nossos *lançamentos* ✨\n\n' + lista(novos) + '\n\nPeça aqui:\n' + link;
  }
  let r = '*Sabores de hoje* 🍨\n\n' + lista(normais);
  if (novos.length) r += '\n\n*Lançamentos* ✨\n' + lista(novos);
  if (zero.length)  r += '\n\n*Zero açúcar*\n' + lista(zero);
  return r + '\n\nOs sabores mudam conforme a produção do dia.\n\nPeça aqui:\n' + link;
}

/* Se a loja está aberta AGORA é estado, não é o horário escrito no cadastro.
   Sem isso a atendente dizia "estamos abertos" num feriado em que a loja fechou. */
async function estadoDaLoja(cfg) {
  const vazio = { aberta: null, entrega: null, retirada: null };
  if (!sb || !cfg?.loja_id) return vazio;
  try {
    const { data } = await sb.from('config_loja')
      .select('loja_aberta,tempo_entrega,tempo_retirada')
      .eq('loja_id', cfg.loja_id).maybeSingle();
    if (!data) return vazio;
    return {
      aberta: data.loja_aberta,
      entrega: data.tempo_entrega,
      retirada: data.tempo_retirada
    };
  } catch (e) { return vazio; }
}

/* hora local, para ela saber que horas são de verdade */
function agoraTexto() {
  const d = new Date(Date.now() - 3 * 3600 * 1000);
  const dias = ['domingo','segunda-feira','terça-feira','quarta-feira',
                'quinta-feira','sexta-feira','sábado'];
  return `${dias[d.getUTCDay()]}, ${String(d.getUTCHours()).padStart(2,'0')}:` +
         `${String(d.getUTCMinutes()).padStart(2,'0')}`;
}

async function montarContexto(cfg, link, nome, primeiraVez) {
  const est = await estadoDaLoja(cfg);
  const sabores = await carregarSabores();
  const zonas   = await carregarZonas();
  const zonaTxt = zonas.filter(z => z.tipo !== 'padrao')
    .map(z => `${z.nome} (${z.cidade}): R$ ${dinheiro(z.taxa)}`).join('; ');
  const norm  = sabores.filter(s => !s.zero_acucar && !s.lancamento).map(s => s.nome);
  const zero  = sabores.filter(s => s.zero_acucar).map(s => s.nome);
  const novos = sabores.filter(s => s.lancamento).map(s => s.nome);

  const iaNome = (cfg?.ia_nome || '').trim();
  const tom = TONS[cfg?.ia_tom] || TONS.acolhedor;
  const regras = (cfg?.ia_regras || '').trim();
  const apresenta = cfg?.ia_apresenta !== false;

  const prontas = [
    cfg?.texto_horario   ? 'Horário: '   + cfg.texto_horario.replace(/\n/g,' ')   : '',
    cfg?.texto_entrega   ? 'Entrega: '   + cfg.texto_entrega.replace(/\n/g,' ')   : '',
    cfg?.texto_pagamento ? 'Pagamento: ' + cfg.texto_pagamento.replace(/\n/g,' ') : '',
    cfg?.texto_endereco  ? 'Endereço: '  + cfg.texto_endereco.replace(/\n/g,' ')  : '',
    ...(cfg?.respostas || []).map(r => r.chaves
      ? `Sobre "${r.chaves}": ${String(r.resposta||'').replace(/\n/g,' ')}` : '')
  ].filter(Boolean).join('\n');

  return `Você é ${iaNome ? iaNome + ', a atendente virtual' : 'o atendente virtual'} da ${nome}, uma gelateria artesanal.
${iaNome && apresenta && primeiraVez
  ? `ESTA É A PRIMEIRA MENSAGEM da conversa: comece se apresentando, algo como "Oi! Aqui é a ${iaNome}, da ${nome}" — e só depois responda o que a pessoa perguntou.`
  : (iaNome && apresenta ? 'A conversa já começou; não se apresente de novo.' : '')}
Seu jeito de falar é ${tom}.

INFORMAÇÕES REAIS DE HOJE (use apenas estas, nunca invente):
- Agora são ${agoraTexto()} (horário de Brasília).
- A loja está ${est.aberta === true ? 'ABERTA agora — pode receber pedido'
   : est.aberta === false ? 'FECHADA agora — avise com gentileza e diga que anota para depois'
   : 'com o estado não informado — vá pelo horário abaixo'}.
${est.entrega ? `- Tempo de entrega hoje: cerca de ${est.entrega} minutos.` : ''}
${est.retirada ? `- Tempo para retirada hoje: cerca de ${est.retirada} minutos.` : ''}
- Link do cardápio: ${link}
- Horário: ${(cfg?.texto_horario || 'todos os dias das 12h às 23h').replace(/\n/g, ' ')}
- Endereço: ${(cfg?.texto_endereco || 'informar pelo cardápio').replace(/\n/g, ' ')}
- Pagamento: dinheiro, Pix, débito e crédito, pagos na entrega
- Sabores tradicionais: ${norm.join(', ') || 'consultar no cardápio'}
- Zero açúcar: ${zero.join(', ') || 'nenhum hoje'}
- Lançamentos: ${novos.join(', ') || 'nenhum'}
- Taxas de entrega: ${zonaTxt || 'variam por bairro'}
${prontas ? `\nRESPOSTAS QUE A LOJA DEIXOU PRONTAS (use o conteúdo, com suas palavras):\n${prontas}` : ''}
${regras ? `\nREGRAS DA LOJA (siga sempre):\n${regras}\n` : ''}
COMO RESPONDER:
- Português do Brasil, no máximo 3 frases curtas. Nada de textão.
- Um emoji, no máximo dois.
- Quando fizer sentido, mande o link do cardápio.
- NUNCA invente sabor, preço, taxa ou promoção. Se não souber, diga que vai
  confirmar com a equipe e peça um instante.
- Se perguntarem se está aberto, responda pelo ESTADO ACIMA, não pelo horário do
  cadastro. O estado é o que vale: a loja pode ter fechado mais cedo hoje.
- Se a loja estiver fechada, não prometa entrega agora.
- Para cancelamento ou reclamação, peça o número do pedido e avise que a equipe verifica.

CONVERSA NATURAL:
- Pode conversar de forma leve sobre o que a pessoa trouxer: o calor, o fim de
  semana, um agradecimento, uma brincadeira. Responda como uma pessoa responderia.
- Depois, puxe de volta para a loja sem forçar. Ex.: "Aqui também tá um calor
  danado! Dia perfeito pra um gelato 🍨"
- Evite política, religião, futebol de time e saúde de alguém: desconverse com
  leveza e volte para o pedido.
- Nunca dê conselho médico, jurídico ou financeiro.`;
}

async function responderComIA(mensagem, tel, cfg, link, nome, primeiraVez) {
  const sistema = await montarContexto(cfg, link, nome, primeiraVez);
  historico[tel] = (historico[tel] || []).slice(-6);
  const msgs = [...historico[tel], { role: 'user', content: mensagem }];

  let resposta = null;
  if (GROQ_KEY) resposta = await chamarGroq(sistema, msgs);
  if (!resposta && GEMINI_KEY) resposta = await chamarGemini(sistema, msgs);
  if (!resposta) { console.log('IA nao respondeu — usando respostas prontas'); return null; }

  historico[tel] = [...msgs, { role: 'assistant', content: resposta }].slice(-6);
  return resposta;
}
const MODELOS_GROQ = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'gemma2-9b-it'
];
let _modeloBom = null;
let ULTIMO_ERRO_IA = null;

async function chamarGroq(sistema, msgs) {
  const tentar = _modeloBom ? [_modeloBom, ...MODELOS_GROQ] : MODELOS_GROQ;
  for (const modelo of tentar) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelo,
          messages: [{ role: 'system', content: sistema }, ...msgs],
          temperature: 0.6, max_tokens: 300 })
      });
      const txt = await r.text();
      if (!r.ok) {
        ULTIMO_ERRO_IA = modelo + ' -> ' + r.status + ' ' + txt.slice(0, 200);
        console.log('[IA] groq falhou:', ULTIMO_ERRO_IA);
        continue;
      }
      const d = JSON.parse(txt);
      const resp = d.choices?.[0]?.message?.content?.trim();
      if (resp) {
        if (_modeloBom !== modelo) { _modeloBom = modelo; console.log('[IA] usando modelo', modelo); }
        ULTIMO_ERRO_IA = null;
        return resp;
      }
      ULTIMO_ERRO_IA = modelo + ' -> resposta vazia';
    } catch (e) {
      ULTIMO_ERRO_IA = modelo + ' -> ' + e.message;
      console.log('[IA] groq erro:', e.message);
    }
  }
  return null;
}

/* ----------------------------------------------------------
   IA PARA EXTRAIR DADOS — outra coisa da IA que conversa.
   Aqui não se quer simpatia: quer-se JSON. Temperatura no chão
   para ela não improvisar, e modelo com visão quando há foto.
   ---------------------------------------------------------- */
const MODELO_VISAO = 'meta-llama/llama-4-scout-17b-16e-instruct';
async function chamarIAExtrair(sistema, msgs, comFoto) {
  if (!GROQ_KEY) return null;
  const modelos = comFoto ? [MODELO_VISAO]
                          : [MODELO_VISAO, 'llama-3.3-70b-versatile'];
  for (const modelo of modelos) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelo,
          messages: [{ role: 'system', content: sistema }, ...msgs],
          temperature: 0, max_tokens: 1200 })
      });
      if (!r.ok) { console.log('[extrair] ' + modelo + ' -> ' + r.status); continue; }
      const d = await r.json();
      const resp = d.choices?.[0]?.message?.content?.trim();
      if (resp) return resp;
    } catch (e) { console.log('[extrair] erro:', e.message); }
  }
  return null;
}

/* teste da IA pelo navegador */
app.get('/testeia', protege, async (req, res) => {
  const pergunta = req.query.q || 'oi';
  const loja = req.query.loja || Object.keys(sessoes)[0] || 'suc_sfs';
  try {
    const cfg = await buscarCfg(loja);
    const link = cfg?.link_cardapio || 'https://rafaeluendes-jpg.github.io/delivery/';
    const nome = cfg?.nome_loja || 'a loja';
    const inicio = Date.now();
    const r = await responderComIA(pergunta, '__teste__', cfg, link, nome, true);
    res.json({
      pergunta,
      loja,
      configuracao: {
        ia_ativa: cfg?.ia_ativa !== false,
        nome_assistente: cfg?.ia_nome || '(sem nome)',
        tem_regras: !!(cfg?.ia_regras || '').trim()
      },
      chaves: { groq: !!GROQ_KEY, gemini: !!GEMINI_KEY },
      modelo: _modeloBom || '(nenhum funcionou)',
      resposta: r || null,
      erro: r ? null : (ULTIMO_ERRO_IA || 'sem detalhe'),
      levou: (Date.now() - inicio) + 'ms'
    });
  } catch (e) { res.json({ erro: e.message }); }
});
async function chamarGemini(sistema, msgs) {
  try {
    const conteudo = msgs.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }] }));
    const r = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: sistema }] },
          contents: conteudo,
          generationConfig: { temperature: 0.6, maxOutputTokens: 300 } }) });
    if (!r.ok) { console.log('gemini falhou:', r.status); return null; }
    const d = await r.json();
    return d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (e) { console.log('gemini erro:', e.message); return null; }
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
/* Envia o PDF. Pela Meta exige URL publica, entao por enquanto
   o caminho de verdade e o Baileys, que aceita o arquivo direto.
   Quando o numero da Meta existir, o PDF passa a subir antes. */
async function enviarDocumentoAssistente(telefone, buffer, nome, legenda) {
  for (const lojaId of Object.keys(sessoes)) {
    const s = sessoes[lojaId];
    if (!s || !s.sock || s.estado !== 'conectado') continue;
    for (const num of CANAL.variacoesBR(telefone)) {
      try {
        await s.sock.sendMessage(num + '@s.whatsapp.net', {
          document: buffer, fileName: nome,
          mimetype: 'application/pdf', caption: legenda
        });
        return true;
      } catch (e) { /* proxima variacao */ }
    }
  }
  throw new Error('Nenhuma loja conectada para enviar o documento.');
}

/* uma vez por hora o robo confere se alguma rede ja alcancou a
   frequencia dela; o controle do intervalo esta dentro do modulo */
setInterval(() => {
  REL.enviarRelatorios({
    sb, sessoes,
    enviarPara: CANAL.enviarPara,
    enviarDocumento: enviarDocumentoAssistente
  }).catch(e => console.error('relatorios:', e && e.message));
}, 60 * 60 * 1000);

/* rota para disparar na hora, para conferir sem esperar o prazo */
app.post('/relatorio/:loja', protege, daMinhaLoja, async (req, res) => {
  try {
    const dias = Number(req.query.dias) || 7;
    const r = await REL.gerarParaLoja(sb, req.params.loja, dias);
    const para = req.body?.telefone;
    if (!para) return res.json({ erro: 'informe o telefone' });
    await enviarDocumentoAssistente(para, r.pdf, r.nome,
      `📋 Relatorio de checklist dos ultimos ${dias} dias.`);
    res.json({ ok: true, vazio: r.vazio, arquivo: r.nome });
  } catch (e) { res.status(400).json({ erro: e.message }); }
});

/* ----------------------------------------------------------
   A PORTA DA META
   Fica de pé desde já, respondendo à vistoria. Enquanto
   META_TOKEN e META_PHONE_NUMBER_ID não existirem, ninguém bate
   aqui — e a assistente segue pelo Baileys, o que permite testar
   tudo antes de o número sair da aprovação.
   ---------------------------------------------------------- */
CANAL.rotasMeta(app, async ({ telefone, texto, imagem }) => {
  try {
    /* o número da assistente é um só para a plataforma inteira, então
       a loja se descobre pelo telefone de quem escreveu */
    if (!sb) return;
    const { data } = await sb.from('whatsapp_config')
      .select('loja_id, sucursal_id, gestor_zap')
      .not('gestor_zap', 'is', null);
    const so = (t) => String(t || '').replace(/\D/g, '').slice(-11);
    const achou = (data || []).find(c => so(c.gestor_zap) === so(telefone));
    if (!achou) {
      await CANAL.enviarPara({ canal: 'assistente', sessoes, lojaId: null,
        telefone, texto: 'Não reconheci este número. Fale com o administrador da sua rede.' });
      return;
    }
    const resposta = await montarResposta(achou.sucursal_id, telefone, texto, imagem);
    if (resposta) {
      await CANAL.enviarPara({ canal: 'assistente', sessoes,
        lojaId: achou.sucursal_id, telefone, texto: resposta });
    }
  } catch (e) { console.error('assistente meta:', e && e.message); }
});

app.get('/', (_, res) => res.json({
  nome: 'Nexor WhatsApp', ok: true,
  lojas: Object.keys(sessoes).map(id => ({
    loja: id, estado: sessoes[id].estado, numero: sessoes[id].numero || null
  }))
}));

/* liga uma loja e devolve o QR */
app.post('/conectar/:loja', protege, daMinhaLoja, async (req, res) => {
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
app.get('/diagnostico', protege, (req, res) => {
  res.json({
    ok: true,
    banco: !!sb,
    pasta: PASTA,
    chaveExigida: EXIGE_CHAVE,
    ia: { groq: !!GROQ_KEY, gemini: !!GEMINI_KEY },
    sessoes: Object.keys(sessoes).map(id => ({
      loja: id, estado: sessoes[id].estado,
      temQr: !!sessoes[id].qr, numero: sessoes[id].numero || null
    }))
  });
});

app.get('/estado/:loja', protege, daMinhaLoja, (req, res) => {
  const s = sessoes[req.params.loja];
  res.json({ estado: s?.estado || 'desligado', qr: s?.qr || null, numero: s?.numero || null });
});

app.post('/desconectar/:loja', protege, daMinhaLoja, async (req, res) => {
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
app.get('/envios', protege, (req, res) => res.json({
  total: ultimosEnvios.length,
  sessoes: Object.keys(sessoes).map(k => ({ loja: k, estado: sessoes[k].estado })),
  envios: ultimosEnvios
}));

/* freio de envio: o WhatsApp bane número que dispara em rajada.
   Vale por loja, e o limite é generoso para o uso normal do pedido. */
const LIMITE_MIN = Number(process.env.LIMITE_ENVIO_MINUTO || 20);
const janela = {};
function podeEnviar(loja) {
  const agora = Date.now();
  const l = janela[loja] = (janela[loja] || []).filter(t => agora - t < 60000);
  if (l.length >= LIMITE_MIN) return false;
  l.push(agora);
  return true;
}

app.post('/enviar', protege, daMinhaLoja, async (req, res) => {
  const { loja, telefone, texto } = req.body || {};
  if (loja && !podeEnviar(loja)) {
    registrar({ ok: false, motivo: 'limite de envios por minuto atingido', loja });
    return res.status(429).json({ erro: 'muitos envios seguidos — tente em instantes' });
  }
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
