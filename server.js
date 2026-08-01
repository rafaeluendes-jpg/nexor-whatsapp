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
console.log('banco:', SB_URL ? 'encontrado' : 'faltando',
            '| chave do banco:', SB_KEY ? 'encontrada' : 'faltando');
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

  const { state, saveCreds } = await useMultiFileAuthState(dir);
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

/* ---------- respostas automáticas ---------- */
const memoria = {};   /* telefone -> ultimo atendimento */

async function montarResposta(lojaId, tel, texto) {
  const cfg = await buscarCfg(lojaId);
  if (cfg?.robo_ativo === false) return null;

  const t = texto.toLowerCase();
  const agora = Date.now();
  const ultima = memoria[tel] || 0;
  const primeiraVez = (agora - ultima) > 3 * 60 * 60 * 1000;   /* 3 horas */
  memoria[tel] = agora;

  const link = cfg?.link_cardapio || 'https://rafaeluendes-jpg.github.io/delivery/';
  const nome = cfg?.nome_loja || 'nossa loja';

  /* palavras-chave configuradas pela loja */
  for (const r of (cfg?.respostas || [])) {
    const chaves = String(r.chaves || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    if (chaves.some(c => t.includes(c))) {
      return String(r.resposta || '').replace('{link}', link).replace('{loja}', nome);
    }
  }
  /* respostas de fábrica */
  if (/(card[aá]pio|menu|pedir|pedido|comprar|link)/.test(t))
    return `Claro! Faça seu pedido por aqui:\n${link}\n\nÉ só escolher os sabores e enviar. O pedido cai direto no nosso sistema.`;
  if (/(hor[aá]rio|aberto|fecha|funciona)/.test(t))
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
  if (/(taxa|entrega|frete|entregam)/.test(t))
    return cfg?.texto_entrega || `A taxa varia pelo bairro. Ao montar o pedido em ${link} você escolhe sua região e vê o valor exato.`;
  if (/(pix|pagamento|pagar|cart[aã]o|dinheiro)/.test(t))
    return cfg?.texto_pagamento || 'Aceitamos dinheiro, Pix, débito e crédito. O pagamento é feito na entrega.';
  if (/(onde|endere[cç]o|fica|localiza)/.test(t))
    return cfg?.texto_endereco || 'Estamos esperando você! Nosso endereço está no cardápio.';
  if (/(ol[aá]|oi|bom dia|boa tarde|boa noite|tudo bem)/.test(t) || primeiraVez)
    return cfg?.saudacao ||
      `Olá! 👋 Bem-vindo a ${nome}.\n\nFaça seu pedido por aqui:\n${link}\n\nSe precisar, é só chamar.`;
  return null;
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
  const t = semAcento(texto);
  const zonas = await carregarZonas();
  /* casa pelo nome mais longo primeiro, para "jardim america" ganhar de "jardim" */
  const ordenadas = zonas.slice().sort((a, b) => String(b.nome).length - String(a.nome).length);
  for (const z of ordenadas) {
    const n = semAcento(z.nome);
    if (n.length < 4) continue;
    if (t.includes(n)) return z;
  }
  /* palavras genéricas de zona rural */
  if (/(sitio|chacara|rancho|fazenda|estrada|zona rural)/.test(t)) {
    const rural = zonas.find(z => z.tipo === 'rural');
    if (rural) return rural;
  }
  return null;
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
  delete sessoes[req.params.loja];
  res.json({ ok: true });
});

/* envia uma mensagem */
app.post('/enviar', protege, async (req, res) => {
  const { loja, telefone, texto } = req.body || {};
  if (!loja || !telefone || !texto)
    return res.status(400).json({ erro: 'informe loja, telefone e texto' });
  const s = sessoes[loja];
  if (!s?.sock || s.estado !== 'conectado')
    return res.status(409).json({ erro: 'loja não conectada', estado: s?.estado || 'desligado' });
  try {
    const num = String(telefone).replace(/\D/g, '');
    const jid = (num.startsWith('55') ? num : '55' + num) + '@s.whatsapp.net';
    await s.sock.sendMessage(jid, { text: texto });
    if (sb) sb.from('whatsapp_mensagens').insert([{
      sucursal_id: loja, telefone: num, direcao: 'enviada', texto
    }]).then(() => {}, () => {});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

/* reconecta as sessões salvas ao subir */
async function retomar() {
  try {
    for (const d of fs.readdirSync(PASTA)) {
      if (fs.existsSync(path.join(PASTA, d, 'creds.json'))) {
        console.log('retomando loja', d);
        conectar(d).catch(() => {});
      }
    }
  } catch (e) {}
}

app.listen(PORTA, () => {
  console.log('Nexor WhatsApp no ar na porta', PORTA);
  retomar();
});
