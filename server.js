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
    'https://www.nexor.com.br',
    /* o sistema mudou de dominio: joiagest.com.br. Fica aqui tambem, para
       nao depender de ninguem lembrar da variavel no Render. */
    'https://joiagest.com.br',
    'https://www.joiagest.com.br'
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
/* ==========================================================
   AUDITORIA — CORPO BRUTO PARA CONFERIR A ASSINATURA DA META
   A Meta assina cada webhook com HMAC-SHA256 sobre o corpo EXATO da
   requisicao. Depois que o express interpreta o JSON, o texto original se
   perde e a conferencia fica impossivel. Por isso guardamos o bruto aqui.
   ========================================================== */
app.use(express.json({
  limit: '2mb',
  verify: (req, _res, buf) => { req.corpoBruto = buf; }
}));

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
      .select('id, nome, cargo, loja_id, sucursal_ref').eq('id', u.id).maybeSingle();
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
  /* ==========================================================
     AUDITORIA — SEM CHAVE NAO SE ABRE A PORTA
     Antes, se CHAVE_API nao estivesse definida no Render, esta linha
     devolvia TRUE e todas as rotas ficavam abertas para a internet:
     conectar, desconectar e ENVIAR MENSAGEM em nome de qualquer loja.
     Uma variavel de ambiente esquecida virava porta escancarada.
     Agora, sem chave configurada, o robo recusa — e diz por que.
     ========================================================== */
  if (!EXIGE_CHAVE) {
    console.error('RECUSADO: CHAVE_API não está definida. Defina nas variáveis do Render.');
    return false;
  }
  const c = req.headers['x-chave'] || req.query.chave;
  return !!CHAVE && c === CHAVE;
}

/* ==========================================================
   AUDITORIA — LIMITE DE REQUISICOES
   Nao havia limite nenhum: um laco disparando /enviar sairia mandando
   mensagem em nome da loja ate a Meta bloquear o numero, ou gastaria a
   cota da IA. Aqui e uma janela deslizante simples, por origem — sem
   dependencia nova, que o robo roda em plano pequeno.
   ========================================================== */
const _janelas = new Map();
function dentroDoLimite(chave, teto, janelaMs) {
  const agora = Date.now();
  const j = _janelas.get(chave) || { ini: agora, n: 0 };
  if (agora - j.ini > janelaMs) { j.ini = agora; j.n = 0; }
  j.n++;
  _janelas.set(chave, j);
  if (_janelas.size > 5000) {                    /* nao cresce sem fim */
    for (const [k, v] of _janelas) if (agora - v.ini > janelaMs) _janelas.delete(k);
  }
  return j.n <= teto;
}
function limita(teto, janelaMs) {
  return function (req, res, next) {
    const quem = (req.perfil && req.perfil.loja_id)
      || req.headers['x-chave'] || req.ip || 'anon';
    if (!dentroDoLimite(req.path + '|' + quem, teto, janelaMs))
      return res.status(429).json({ erro: 'muitas tentativas — aguarde um instante' });
    next();
  };
}

/* ==========================================================
   AUDITORIA — RASTRO DAS OPERACOES SENSIVEIS
   Enviar mensagem, conectar e desconectar uma loja nao deixavam registro.
   Agora ficam em audit_log, com quem, qual loja e quando. Nunca grava
   chave, token nem o conteudo da mensagem.
   ========================================================== */
async function registrarNoBanco(acao, req, extra) {
  if (!sb) return;
  try {
    const p = req.perfil || {};
    await sb.from('audit_log').insert({
      loja_id: p.loja_id || (extra && extra.loja) || null,
      usuario: p.id || null,
      usuario_email: p.email || null,
      cargo: p.cargo || 'robo',
      tabela: 'whatsapp',
      operacao: acao,
      depois: { rota: req.path, ...(extra || {}) }
    });
  } catch (e) { /* registro nao pode derrubar a operacao */ }
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
/* ==========================================================
   O QUE CHEGA AQUI E A UNIDADE, NAO A EMPRESA

   Esta conferencia comparava req.params.loja com perfil.loja_id. So que
   loja_id e o uuid da EMPRESA, e o sistema manda a referencia da
   UNIDADE — 'suc_mt1unhbx2xrb'. Nunca sao iguais: a resposta era sempre
   403, e a tela mostrava "nao consegui falar com o robo" como se o
   servidor estivesse fora do ar. O QR nunca chegava a ser gerado.

   Agora vale qualquer um dos tres, e a unidade e conferida contra a
   empresa de quem mandou — ninguem comanda o WhatsApp de outra rede:
     1. veio o uuid da empresa (chamada antiga, continua valendo);
     2. veio a unidade fixa do perfil;
     3. veio uma unidade que pertence a empresa do perfil.
   ========================================================== */
const _cacheSuc = new Map();
async function unidadeEhDaEmpresa(ref, lojaId) {
  if (!sb || !ref || !lojaId) return false;
  const chave = ref + '|' + lojaId;
  const guardado = _cacheSuc.get(chave);
  if (guardado && guardado.ate > Date.now()) return guardado.ok;
  try {
    const { data } = await sb.from('sucursais')
      .select('id').eq('ref_local', ref).eq('loja_id', lojaId).maybeSingle();
    const ok = !!data;
    _cacheSuc.set(chave, { ok, ate: Date.now() + 60000 });
    return ok;
  } catch (e) { return false; }
}
async function daMinhaLoja(req, res, next) {
  const p = req.perfil;
  if (!p) return next();
  const pedida = String(req.params.loja || req.body?.loja || '').trim();
  if (!pedida) return next();
  if (p.cargo === 'plataforma') return next();
  if (String(p.loja_id) === pedida) return next();
  if (p.sucursal_ref && String(p.sucursal_ref) === pedida) return next();
  if (await unidadeEhDaEmpresa(pedida, p.loja_id)) return next();
  return res.status(403).json({ erro: 'esta loja não é sua' });
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

const FUSO_PADRAO = 'America/Sao_Paulo';

function hojeSP() {
  /* mesma razao do horario da Carla: fuso por nome, nao subtracao na mao */
  try{
    return new Intl.DateTimeFormat('en-CA',{timeZone:FUSO_PADRAO,
      year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  }catch(e){
    return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  }
}

/* ---- faturamento do dia ---- */
async function respFaturamento(lojaLoja) {
  const hoje = hojeSP();
  const { data } = await sb.from('pedidos')
    .select('total,tipo,fase').eq('loja_id', lojaLoja).eq('data_venda', hoje);
  const ps = (data || []).filter(p => p.fase !== 'cancelado');
  const tot = ps.reduce((a, p) => a + (Number(p.total) || 0), 0);

  /* "Ainda não há venda" sozinho é ambíguo: pode ser dia fraco ou caixa
     que ninguém abriu. São coisas muito diferentes para o dono saber. */
  let caixa = null;
  try {
    const { data: cx } = await sb.from('caixas')
      .select('operador,aberto_em,fechado_em').eq('loja_id', lojaLoja)
      .order('aberto_em', { ascending: false }).limit(1);
    caixa = cx && cx[0] ? cx[0] : null;
  } catch (e) { /* segue sem o caixa */ }

  const abertoHoje = caixa && !caixa.fechado_em &&
    String(caixa.aberto_em || '').slice(0, 10) === hoje;

  if (!ps.length) {
    if (abertoHoje)
      return `Nenhuma venda ainda hoje.\n\nO caixa está *aberto*` +
             (caixa.operador ? ` com ${caixa.operador}` : '') + '.';
    return 'Nenhuma venda hoje — e o *caixa ainda não foi aberto*.';
  }

  const tm = tot / ps.length;
  return `📊 *Vendas de hoje*\n\n` +
    `Total: *R$ ${dinheiro(tot)}*\n` +
    `Pedidos: ${ps.length}\n` +
    `Ticket médio: R$ ${dinheiro(tm)}\n\n` +
    (abertoHoje
      ? `Caixa *aberto*${caixa.operador ? ' com ' + caixa.operador : ''}.`
      : `Caixa *fechado*.`);
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

/* ---- boletos a pagar ----
   O codigo de barras vai em LINHA PROPRIA, sem negrito e sem pontuacao
   colada: no WhatsApp, tocar e segurar copia a linha inteira. Se ele
   viesse no meio do texto, o gerente teria que selecionar na mao. */
function soNum(t) { return String(t || '').replace(/\D/g, ''); }
async function respBoletos(lojaLoja) {
  const hoje = hojeSP();
  const { data } = await sb.from('lancamentos_financeiros')
    .select('descricao,valor,vencimento,fornecedor_nome,codigo_barras')
    .eq('loja_id', lojaLoja).eq('tipo', 'despesa').eq('pago', false)
    .lte('vencimento', hoje).order('vencimento');
  if (!data || !data.length) return '✅ Nenhum boleto vencido ou vencendo hoje.';
  const tot = data.reduce((a, l) => a + (Number(l.valor) || 0), 0);
  const comCB = data.filter(l => soNum(l.codigo_barras).length >= 44).length;
  const linhas = data.slice(0, 15).map(l => {
    const venc = (l.vencimento || '').split('-').reverse().join('/');
    let t = `• ${l.descricao} — R$ ${dinheiro(l.valor)} (venc. ${venc})`;
    const cb = soNum(l.codigo_barras);
    if (cb.length >= 44) t += `\n${cb}`;
    return t;
  });
  let msg = `💰 *A pagar até hoje* (${data.length})\n\n` + linhas.join('\n\n') +
            `\n\nTotal: *R$ ${dinheiro(tot)}*`;
  if (comCB) msg += `\n\n_Toque e segure no número para copiar._`;
  return msg;
}

/* ---- checklist: grava a resposta ---- */
/* quem respondeu "não" e ainda deve o motivo, por telefone */
const esperandoMotivo = new Map();

async function respChecklist(lojaLoja, tel, texto) {
  const hoje = hojeSP();

  /* Primeiro: ele respondeu "não" agora há pouco e isto é o motivo.
     O motivo vale mais que o "não" — sem ele o relatório diz que
     falhou, mas não diz por quê, e a franqueadora não tem o que fazer
     com a informação. */
  const pend = esperandoMotivo.get(tel);
  if (pend && Date.now() - pend.quando < 30 * 60 * 1000) {
    const t0 = limpar(texto);
    if (t0.length < 3) return 'Me conte em poucas palavras o que atrapalhou.';
    esperandoMotivo.delete(tel);
    try {
      await sb.from('assistente_conversas').update({
        motivo: texto.trim(), motivo_em: new Date().toISOString()
      }).eq('id', pend.id);
    } catch (e) { console.error('motivo:', e && e.message); }
    return `📝 Anotado: _"${texto.trim()}"_\n\n` +
      `Isso vai junto no relatório da franqueadora. Obrigada!`;
  }

  const { data: abertas } = await sb.from('assistente_conversas')
    .select('id,rotina_nome,pergunta').eq('loja_id', lojaLoja).eq('data', hoje)
    .is('respondida_em', null).limit(1);
  if (!abertas || !abertas.length) return null;
  const t = limpar(texto);
  /* "Sim, já fiz" e "Ainda não" são os títulos dos botões da Meta; o resto
     cobre quem digita à mão, que escreve de todo jeito. */
  const nao = /\b(nao|ainda nao|negativo|nao fiz|nao consegui|n)\b/.test(t);
  const sim = !nao && /\b(sim|ja fiz|feito|fiz|ok|pronto|concluido|conclui|s)\b/.test(t);
  if (!sim && !nao) return null;
  await sb.from('assistente_conversas').update({
    respondida_em: new Date().toISOString(),
    resposta: texto, feito: sim, telefone: tel
  }).eq('id', abertas[0].id);

  if (sim) return `✅ Anotado: *${abertas[0].rotina_nome}* feito hoje. Obrigada!`;

  esperandoMotivo.set(tel, { id: abertas[0].id, quando: Date.now() });
  return `📝 Anotado que o *${abertas[0].rotina_nome}* ainda não foi feito.\n\n` +
    `O que atrapalhou? Me conte em poucas palavras — fica registrado junto.`;
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
    const _ag = agoraNaUnidade();
    const hm = String(_ag.hh).padStart(2, '0') + ':' + String(_ag.mm).padStart(2, '0');
    const diaSem = _ag.dia === 0 ? 7 : _ag.dia;

    /* Duas lojas com o MESMO gestor recebiam a mesma pergunta duas vezes.
       A cobrança é para a pessoa, não para a loja: quem já foi avisado
       daquela rotina hoje não é avisado de novo. */
    const jaAvisado = new Set();

    for (const cfg of cfgs) {
      if (!soDigito(cfg.gestor_zap)) continue;

      /* A cobrança saía SÓ pelo Baileys: exigia sessão de QR conectada.
         A Assistente Nexor vai pela Meta e não tem sessão — então nunca
         disparava. Agora vai pela camada de canal, que escolhe sozinha. */
      const temBaileys = sessoes[cfg.sucursal_id] &&
        sessoes[cfg.sucursal_id].estado === 'conectado';
      if (!CANAL.metaPronta() && !temBaileys) continue;   /* sem caminho de saída */

      const { data: rots } = await sb.from('assistente_rotinas')
        .select('*').eq('loja_id', cfg.loja_id).eq('ativa', true).order('ordem');
      for (const r of (rots || [])) {
        const dias = Array.isArray(r.dias) ? r.dias : [1,2,3,4,5,6];
        if (dias.indexOf(diaSem) < 0) continue;

        /* "18:14" < "18:14:00" é verdadeiro comparando texto — a rotina
           nunca achava que tinha dado a hora. Compara em minutos. */
        const hh = String(r.hora || '10:00').slice(0, 5);
        const min = (x) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3, 5));
        if (min(hm) < min(hh)) continue;

        /* a matriz escolheu quais unidades recebem; vazio = todas */
        const alvo = Array.isArray(r.sucursais) ? r.sucursais : [];
        if (alvo.length && alvo.indexOf(cfg.sucursal_id) < 0) continue;

        const marca = r.id + '|' + soDigito(cfg.gestor_zap);
        if (jaAvisado.has(marca)) continue;

        /* A trava incluía só a rotina e o dia. Mudar o horário de uma rotina
           já cobrada não fazia efeito no mesmo dia — o que atrapalha na hora
           de ajustar e testar. Com a hora na marca, editar o horário libera
           uma nova cobrança; deixar como está continua cobrando uma vez. */
        const ref = 'cv_' + r.id + '_' + cfg.sucursal_id + '_' + hoje + '_' + hh.replace(':', '');

        /* Mudar o formato da marca fez o robô esquecer o que já tinha cobrado
           e mandar tudo de novo. A trava passa a olhar a ROTINA e o DIA, não
           o texto da marca — assim o formato pode mudar sem repetir mensagem. */
        const { data: ja } = await sb.from('assistente_conversas')
          .select('id').eq('rotina_id', r.id).eq('data', hoje)
          .eq('sucursal_id', cfg.sucursal_id).limit(1);
        if (ja && ja.length) continue;                    /* já cobrou hoje */

        try {
          await CANAL.enviarPergunta({
            sessoes, lojaId: cfg.sucursal_id,
            telefone: soDigito(cfg.gestor_zap), texto: r.pergunta,
            botoes: r.tipo_resposta === 'texto' ? null
              : [{ id: 'sim', titulo: 'Sim, já fiz' },
                 { id: 'nao', titulo: 'Ainda não' }]
          });
        } catch (e) {
          console.error('rotina não saiu:', r.nome, e && e.message);
          continue;   /* não grava o que não foi enviado */
        }

        await sb.from('assistente_conversas').insert({
          loja_id: cfg.loja_id, ref_local: ref, rotina_id: r.id,
          sucursal_id: cfg.sucursal_id,
          rotina_nome: r.nome, data: hoje, pergunta: r.pergunta,
          telefone: soDigito(cfg.gestor_zap)
        });
        jaAvisado.add(marca);
        console.log('rotina cobrada:', r.nome, cfg.sucursal_id);
      }
    }
  } catch (e) { console.error('cobrarRotinas', e && e.message); }
}
/* De 2 em 2 minutos: com 10, uma rotina marcada para 18:26 podia sair
   às 18:36 — e horário marcado que atrasa dez minutos não é horário. */
setInterval(cobrarRotinas, 2 * 60 * 1000);
setTimeout(cobrarRotinas, 20 * 1000);

/* ---- roteador da assistente de gestão ---- */
/* "comprei 10kg de acucar por 45" — a intencao de lancar tem cara propria.
   Sem isso, "comprei" cairia na atendente e ele receberia oferta de gelato. */
/* Antes isto era uma lista de verbos: "comprei", "lançar", "chegou".
   "Registrar compra de 4 kg de farinha" não estava nela e o gestor recebia
   o menu de ajuda. O que define um lançamento não é o verbo — é a forma:
   um item, uma quantidade e um valor. */
function pareceLancamento(t) {
  if (!/\d/.test(t)) return false;
  const verbo = /\b(comprei|compramos|compra|comprar|lancar|lanca|lançar|lança|registrar|registra|nota|entrada|chegou|recebi|recebemos|paguei|adquiri)\b/.test(t);
  /* "4 kg de farinha", "10 un de copo", "2,5 l de leite" */
  const medida = /\d+[.,]?\d*\s*(kg|kilo|quilos?|g|gramas?|l|litros?|ml|un|unid|unidades?|cx|caixas?|pct|pacotes?|sc|sacos?)\b/.test(t);
  /* "por 45", "a 2 reais", "R$ 8,00" */
  const dinheiro = /(r\$|reais?|\bpor\b|\bcusto\b|\bvalor\b)\s*\d|\d+[.,]?\d*\s*(reais?|r\$)/.test(t);
  return verbo || (medida && dinheiro);
}

async function respostaGestao(lojaLoja, cfg, tel, texto, imagemRecebida, soAssistente) {
  if (!sb) return null;
  if (cfg.assistente_ativa === false) return null;
  if (!ehGestor(cfg, tel)) {
    /* No número da plataforma, número desconhecido merece resposta clara.
       Devolver null aqui fazia a Carla atender — e o gestor cujo WhatsApp
       ainda não foi cadastrado recebia oferta de gelato. */
    if (soAssistente) {
      return 'Não reconheci este número 🤔\n\n' +
        'Para falar comigo, seu WhatsApp precisa estar cadastrado no Nexor, ' +
        'em Canais de Venda e Integração › Assistente Nexor › WhatsApp do dono ' +
        'da loja.\n\nFale com quem administra a sua rede.';
    }
    return null;
  }

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

  /* Antes isto era uma lista de frases exatas, e "valor de venda hj" não
     estava nela — o gestor perguntava do jeito dele e não era entendido.
     Agora vale a INTENÇÃO: uma palavra de dinheiro/venda basta. */
  if (/\b(faturamento|faturou|fatura|vendi|vendemos|vendeu|venda|vendas|caixa|receita|entrou|arrecad)/.test(t)
      && !/\b(cancel|estorn|devolv)/.test(t))
    return respFaturamento(lojaLoja);

  if (/\b(boleto|pagar|vencendo|vencido|vencimento|conta a pagar|despesa)/.test(t))
    return respBoletos(lojaLoja);

  /* Pergunta sobre UM item vem antes da lista geral: "estoque de açúcar" tem
     item e é consulta; "estoque baixo" não tem e é a lista de compras. */
  const mEst = t.match(/(?:quanto tem de|quanto tem|estoque d[eoa]|estoque|saldo d[eoa]|saldo|quanto de|tem)\s+(.{3,})/);
  const itemPedido = mEst && !/^(baixo|acabando|minimo|em falta|no minimo)/.test(mEst[1].trim());
  if (itemPedido) return respEstoque(lojaLoja, mEst[1]);

  if (/\b(comprar|compra|lista|abaixo do minimo|acabando|falta|repor|repos|estoque baixo)/.test(t))
    return respComprar(lojaLoja);

  /* Nada casou pelas regras. Em vez de despejar o menu — que é o robô
     empurrando o trabalho de volta para o gestor — a IA lê a frase e diz
     qual é a intenção. Ela só classifica; quem responde é o código de
     sempre, com dado do banco. */
  if (!contem(t, ['menu', 'o que voce faz', 'ajuda', 'comandos'])) {
    const alvo = await classificarPergunta(texto);
    if (alvo === 'faturamento') return respFaturamento(lojaLoja);
    if (alvo === 'comprar')     return respComprar(lojaLoja);
    if (alvo === 'boletos')     return respBoletos(lojaLoja);
    if (alvo && alvo.indexOf('estoque:') === 0)
      return respEstoque(lojaLoja, alvo.slice(8));
    if (alvo === 'lancamento') {
      const r = await LANC.iniciar({
        sb, lojaId: lojaLoja, sucursalId: cfg.sucursal_id, telefone: tel,
        texto, imagem: null, chamarIA: chamarIAExtrair
      });
      if (r) return r;
    }
  }

  if (contem(t, ['menu', 'o que voce faz', 'ajuda', 'comandos']))
    return '🤖 *Assistente Nexor*\n\nPode me perguntar:\n' +
      '• _qual o faturamento de hoje_\n' +
      '• _quanto tem de açúcar_\n' +
      '• _o que precisa comprar_\n' +
      '• _tem boleto para pagar_\n\n' +
      'E eu te cobro o checklist todo dia.';
  return null;
}

async function montarResposta(lojaId, tel, texto, imagem, soAssistente) {
  const cfg = await buscarCfg(lojaId);
  if (cfg?.robo_ativo === false && !soAssistente) return null;

  /* o gestor da loja fala com a assistente de gestão, não com a atendente */
  try {
    const g = await respostaGestao(cfg.loja_id || lojaId, cfg, tel, texto, imagem, soAssistente);
    if (g) return g;
  } catch (e) { console.error('gestao', e && e.message); }

  /* ---------------------------------------------------------------
     O NÚMERO DA ASSISTENTE NUNCA VIRA ATENDENTE.

     Ele é um só para toda a plataforma Nexor e fala com gestor: não
     vende gelato, não tem cardápio, não conhece sabor. Antes, quando
     a assistente não sabia responder, a resposta caía na Carla — e o
     gestor perguntava quanto tem de açúcar e recebia oferta de sabores.

     Na caixa da loja (Baileys) a queda para a Carla continua certa:
     lá cliente e gestor dividem o mesmo número.
     --------------------------------------------------------------- */
  if (soAssistente) {
    const quem = cfg?.assistente_nome || 'a assistente do Nexor';
    return `Não entendi o que você precisa 🤔\n\n` +
      `Sou ${quem} e cuido da gestão da sua loja. Posso responder sobre:\n\n` +
      `• *faturamento* de hoje ou do mês\n` +
      `• *estoque* de um item — ex.: _quanto tem de açúcar_\n` +
      `• o que está *abaixo do mínimo*\n` +
      `• *boletos* a vencer\n` +
      `• *lançar nota* — mande a foto ou escreva o que comprou\n\n` +
      `Escreva do seu jeito que eu entendo.`;
  }

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
/* ==========================================================
   O SABOR QUE ELA OFERECE E O QUE ESTA NO CARDAPIO

   Antes vinha de fichas_tecnicas com `disponivel_hoje`. Duas coisas
   davam errado: as 139 fichas estavam todas marcadas como disponiveis,
   entao BASE CHOCOLATE virava sabor oferecido ao cliente; e a marca
   `zero_acucar` nunca foi preenchida, entao ela nao sabia quais eram os
   zero.

   Agora a fonte e o grupo de sabores do cardapio — o mesmo que o
   cliente ve ao montar o pote. Se a loja ainda nao montou esse grupo,
   cai na ficha tecnica como antes, para nao ficar sem resposta.
   Zero acucar sai do proprio nome: no cadastro da Jolo todo sabor sem
   acucar tem "ZERO" no nome.
   ========================================================== */
function ehZero(nome) { return /\bzero\b/i.test(String(nome || '')); }

/* ==========================================================
   GLUTEN E LACTOSE SAIEM DA FICHA, SEGUINDO ATE A BASE

   O cliente pergunta "quais gelatos tem gluten". A resposta esta na
   ficha, mas nao no primeiro nivel: a ficha do sabor lista agua e a
   BASE; o que tem gluten mora dentro da ficha DA BASE — e no caso do
   JOLO VANILLA, dentro do cascao, que e um terceiro nivel.

   Aqui a corrente e percorrida ate tres niveis e o resultado vira uma
   linha pronta no contexto da Carla. Nao e chute: e o que esta escrito
   na ficha. Onde a ficha nao disser, a regra manda ela confirmar com a
   equipe em vez de arriscar.
   ========================================================== */
const GLUTEN = /(bis|bolacha|brownie|casca|farinha|bolo |chocotone|kitkat|oreo|gateau|champanhe|crocante|kinder|matilda|waffle|biscoit)/i;
const LEITE  = /(leite|creme|nata|cream cheese|queijo|iogurte|ninho|chantil|manteiga|margarina|doce de leite|trufa)/i;
let _alergCache = { quando: 0, texto: '' };

async function alergenosTexto() {
  if (Date.now() - _alergCache.quando < 10 * 60 * 1000) return _alergCache.texto;
  if (!sb) return '';
  try {
    const { data: fichas } = await sb.from('fichas_tecnicas')
      .select('id,nome,subgrupo_id');
    const { data: itens } = await sb.from('ficha_itens').select('ficha_id,insumo_id');
    const { data: insumos } = await sb.from('insumos').select('id,nome');
    if (!fichas || !itens || !insumos) return '';

    const nomeIns = {}; insumos.forEach(i => { nomeIns[i.id] = i.nome || ''; });
    const porFicha = {};
    itens.forEach(it => {
      (porFicha[it.ficha_id] = porFicha[it.ficha_id] || []).push(nomeIns[it.insumo_id] || '');
    });
    const fichaPorNome = {};
    fichas.forEach(f => { fichaPorNome[String(f.nome || '').trim().toLowerCase()] = f; });

    function ingredientes(fid, nivel, vistos) {
      if (nivel > 3 || !fid || vistos.has(fid)) return [];
      vistos.add(fid);
      let r = [];
      for (const nome of (porFicha[fid] || [])) {
        r.push(nome);
        const sub = fichaPorNome[String(nome).trim().toLowerCase()];
        if (sub) r = r.concat(ingredientes(sub.id, nivel + 1, vistos));
      }
      return r;
    }

    const sabores = fichas.filter(f =>
      ['fs_artesanal', 'fs_sorbet', 'fs_zero_acucar'].indexOf(f.subgrupo_id) >= 0);
    const comGluten = [], semLeite = [];
    for (const f of sabores) {
      const ings = ingredientes(f.id, 1, new Set());
      if (ings.some(x => GLUTEN.test(x))) comGluten.push(f.nome);
      else if (!ings.some(x => LEITE.test(x))) semLeite.push(f.nome);
    }
    const partes = [];
    if (comGluten.length)
      partes.push('Sabores COM glúten (conferido na ficha técnica): ' + comGluten.join(', ') +
                  '. Os demais não levam ingrediente com glúten.');
    if (semLeite.length)
      partes.push('Sabores SEM leite: ' + semLeite.join(', ') + '.');
    _alergCache = { quando: Date.now(), texto: partes.join('\n') };
    return _alergCache.texto;
  } catch (e) { return ''; }
}
async function carregarSabores() {
  if (!sb) return [];
  if (Date.now() - _saboresCache.quando < 3 * 60 * 1000) return _saboresCache.lista;
  let lista = [];
  try {
    const { data: grupos } = await sb.from('grupos_opcoes')
      .select('id,nome,ativo').eq('ativo', true);
    const ids = (grupos || [])
      .filter(g => /sabor/i.test(g.nome || ''))
      .map(g => g.id);
    if (ids.length) {
      const { data } = await sb.from('opcoes')
        .select('nome,ativo,grupo_id').in('grupo_id', ids).order('ordem');
      lista = (data || [])
        .filter(o => o.ativo !== false)
        .map(o => ({ nome: o.nome, zero_acucar: ehZero(o.nome), lancamento: false }));
    }
  } catch (e) {}
  if (!lista.length) {
    try {
      const { data } = await sb.from('fichas_tecnicas')
        .select('nome, zero_acucar, disponivel_hoje, lancamento')
        .eq('disponivel_hoje', true).order('nome');
      lista = (data || [])
        .filter(f => !/massa|base|calda|cascao|cascão/i.test(f.nome || ''))
        .map(f => ({ nome: f.nome,
                     zero_acucar: f.zero_acucar || ehZero(f.nome),
                     lancamento: f.lancamento }));
    } catch (e) { lista = []; }
  }
  _saboresCache = { quando: Date.now(), lista };
  return lista;
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
/* ==========================================================
   ABERTO OU FECHADO SAI DO HORARIO DA UNIDADE

   Isto lia `config_loja.loja_aberta`, que e uma chave manual da EMPRESA
   inteira. Com ela ligada, a Carla dizia "a loja esta aberta" as nove da
   manha de um domingo. O horario de verdade e o do cardapio daquela
   unidade — o mesmo que o cliente ve na vitrine. Agora e ele que manda,
   e a chave manual so vale como desempate quando nao ha horario.

   O endereco e o horario escrito tambem passam a vir do cardapio, para
   ela parar de responder "esta no cardapio" quando perguntam onde fica.
   ========================================================== */
/* ==========================================================
   ITEM 8 — O RELOGIO DA UNIDADE, POR NOME DE FUSO

   Antes: `new Date(Date.now() - 3*3600*1000)` — tres horas fixas
   subtraidas na mao. Funciona hoje porque o Brasil nao tem mais horario
   de verao, mas e uma conta escrita no codigo: se o horario de verao
   voltar, ou se uma unidade abrir em outro fuso (Acre, Fernando de
   Noronha), a Carla passa a responder com uma hora de diferenca e
   ninguem liga uma coisa a outra.

   Agora o fuso e nomeado (America/Sao_Paulo por padrao, e cada unidade
   pode ter o seu). Quem faz a conversao e o proprio sistema, que sabe
   das regras de cada fuso.
   ========================================================== */

function agoraNaUnidade(fuso) {
  const tz = fuso || FUSO_PADRAO;
  let p;
  try {
    p = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      weekday: 'short', hour: '2-digit', minute: '2-digit'
    }).formatToParts(new Date());
  } catch (e) {
    /* fuso invalido no cadastro nao pode derrubar o atendimento */
    p = new Intl.DateTimeFormat('en-US', {
      timeZone: FUSO_PADRAO, hour12: false,
      weekday: 'short', hour: '2-digit', minute: '2-digit'
    }).formatToParts(new Date());
  }
  const get = t => (p.find(x => x.type === t) || {}).value;
  const semana = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
  const dia = semana[get('weekday')];
  let hh = parseInt(get('hour'), 10); if (hh === 24) hh = 0;   /* meia-noite */
  const mm = parseInt(get('minute'), 10);
  return { dia, min: hh * 60 + mm, hh, mm };
}

function faixaDoDia(horarios, dia) {
  return horarios.filter(h => Number(h.dia) === dia);
}

function abertaPeloHorario(horarios, fuso) {
  if (!Array.isArray(horarios) || !horarios.length) return null;
  const ag = agoraNaUnidade(fuso);
  let achou = false;

  /* 1) o dia de hoje */
  for (const h of faixaDoDia(horarios, ag.dia)) {
    achou = true;
    if (h.fechado) continue;
    const a = String(h.abre || '00:00').split(':');
    const f = String(h.fecha || '23:59').split(':');
    const ini = (+a[0]) * 60 + (+a[1]);
    let fim = (+f[0]) * 60 + (+f[1]);
    if (fim < ini) fim += 1440;               /* fecha depois da meia-noite */
    if (ag.min >= ini && ag.min <= fim) return true;
  }

  /* 2) ==========================================================
        A MADRUGADA PERTENCE AO DIA ANTERIOR

        Se a segunda vai das 12:00 as 02:00, a uma da manha de TERCA a
        loja esta aberta — mas quem esta aberto e o turno de segunda. O
        codigo antigo so olhava o dia corrente: somava 1440 ao horario
        de fechamento e nunca chegava a usar essa soma, porque as 01:00
        de terca ele consultava a faixa de terca.

        Aqui olhamos o dia anterior e perguntamos se o turno dele ainda
        alcanca esta hora.
        ========================================================== */
  const ontem = (ag.dia + 6) % 7;
  for (const h of faixaDoDia(horarios, ontem)) {
    if (h.fechado) continue;
    const a = String(h.abre || '00:00').split(':');
    const f = String(h.fecha || '23:59').split(':');
    const ini = (+a[0]) * 60 + (+a[1]);
    const fim = (+f[0]) * 60 + (+f[1]);
    if (fim >= ini) continue;                 /* nao atravessa a meia-noite */
    if (ag.min <= fim) return true;           /* ainda dentro do turno de ontem */
  }

  return achou ? false : null;
}
function horarioEmTexto(horarios) {
  if (!Array.isArray(horarios) || !horarios.length) return '';
  const nomes = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
  return horarios
    .slice().sort((x, y) => Number(x.dia) - Number(y.dia))
    .map(h => h.fechado ? `${nomes[Number(h.dia)]}: fechado`
                        : `${nomes[Number(h.dia)]}: ${h.abre} às ${h.fecha}`)
    .join(' · ');
}
async function estadoDaLoja(cfg) {
  const vazio = { aberta: null, entrega: null, retirada: null, horarioTxt: '', endereco: '' };
  if (!sb || !cfg?.loja_id) return vazio;
  const r = { ...vazio };
  /* ==========================================================
     ITEM 10 — EMPRESA CERTA, UNIDADE CERTA, SEMPRE

     A consulta filtrava so por `sucursal_id`. Se esse campo viesse
     vazio — configuracao incompleta, unidade recriada, cadastro pela
     metade — o filtro deixava de existir e a consulta devolvia a
     PRIMEIRA linha da tabela: o horario de outra unidade, possivelmente
     de outra rede. A Carla responderia com toda a confianca o horario
     da loja errada.

     Agora: sem unidade nao se consulta nada. E o filtro leva tambem a
     empresa (`loja_id`), para que nem uma coincidencia de identificador
     possa cruzar dados entre redes.
     ========================================================== */
  if (!cfg.sucursal_id) {
    console.warn('[carla] configuracao sem unidade — nao consulto horario de ninguem');
    return r;
  }
  try {
    const { data: cd } = await sb.from('cardapio_config')
      .select('horarios,endereco,tempo_entrega,tempo_retirada,ativo')
      .eq('loja_id', cfg.loja_id)
      .eq('sucursal_id', cfg.sucursal_id).maybeSingle();
    if (cd) {
      r.aberta = abertaPeloHorario(cd.horarios, cfg?.fuso);
      r.horarioTxt = horarioEmTexto(cd.horarios);
      r.endereco = cd.endereco || '';
      r.entrega = cd.tempo_entrega || null;
      r.retirada = cd.tempo_retirada || null;
    }
  } catch (e) {}
  try {
    const { data } = await sb.from('config_loja')
      .select('loja_aberta,tempo_entrega,tempo_retirada')
      .eq('loja_id', cfg.loja_id).maybeSingle();
    if (data) {
      if (r.aberta === null) r.aberta = data.loja_aberta;
      if (!r.entrega) r.entrega = data.tempo_entrega;
      if (!r.retirada) r.retirada = data.tempo_retirada;
    }
  } catch (e) {}
  return r;
}

/* hora local, para ela saber que horas são de verdade */
function agoraTexto(fuso) {
  const dias = ['domingo','segunda-feira','terça-feira','quarta-feira',
                'quinta-feira','sexta-feira','sábado'];
  const ag = agoraNaUnidade(fuso);
  return `${dias[ag.dia]}, ${String(ag.hh).padStart(2,'0')}:` +
         `${String(ag.mm).padStart(2,'0')}`;
}

async function montarContexto(cfg, link, nome, primeiraVez) {
  const est = await estadoDaLoja(cfg);
  const sabores = await carregarSabores();
  const alerg = await alergenosTexto();
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

  /* ==========================================================
     ITEM 6 — UMA FONTE SO PARA O HORARIO

     `texto_horario` e um campo livre da configuracao do robo, escrito a
     mao. Ele vinha ANTES do horario real do cardapio nas duas listas: na
     linha do horario e nas respostas prontas.

     Resultado: bastava alguem ter digitado ali "seg a sab, 14h as 22h30"
     uma vez para a Carla repetir esse texto para sempre — mesmo depois
     de o horario ser alterado no painel. Painel salvava em um lugar,
     robo respondia por outro. E exatamente a fonte dupla que nao pode
     existir.

     Agora quem manda e sempre o horario da unidade no cardapio. O texto
     manual segue disponivel para observacoes ("feriados fechamos mais
     cedo"), mas entra DEPOIS e identificado como observacao, nunca como
     o horario em si.
     ========================================================== */
  const prontas = [
    cfg?.texto_horario   ? 'Observação do lojista sobre horário (não substitui o horário acima): '
                           + cfg.texto_horario.replace(/\n/g,' ')   : '',
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
${iaNome ? 'SEU NOME É ' + iaNome + '. Se perguntarem seu nome, com quem estão falando ou quem é você, responda "' + iaNome + '" — nunca "a atendente virtual" sem o nome.' : ''}
Seu jeito de falar é ${tom}.

INFORMAÇÕES REAIS DE HOJE (use apenas estas, nunca invente):
- Agora são ${agoraTexto(cfg?.fuso)} (horário da loja).
- A loja está ${est.aberta === true ? 'ABERTA agora — pode receber pedido'
   : est.aberta === false ? 'FECHADA agora — avise com gentileza, diga o horário em que abre e ofereça o cardápio para a pessoa já ir escolhendo'
   : 'com o estado não informado — vá pelo horário abaixo'}.
${est.entrega ? `- Tempo de entrega hoje: cerca de ${est.entrega} minutos.` : ''}
${est.retirada ? `- Tempo para retirada hoje: cerca de ${est.retirada} minutos.` : ''}
- Link do cardápio: ${link}
- Horário de funcionamento (FONTE ÚNICA — é o que está configurado no cardápio da unidade): ${(est.horarioTxt || cfg?.texto_horario || 'não informado').replace(/\n/g, ' ')}
- Endereço: ${(cfg?.texto_endereco || est.endereco || 'não cadastrado — nesse caso diga que vai confirmar, não invente').replace(/\n/g, ' ')}
- Pagamento: dinheiro, Pix, débito e crédito, pagos na entrega
${alerg ? alerg + '\n' : ''}- Sabores tradicionais: ${norm.join(', ') || 'consultar no cardápio'}
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
/* ==========================================================
   MODELO DE IA ENVELHECE — E A CARLA EMUDECE JUNTO

   Em 17/06/2026 a Groq aposentou de uma vez os quatro modelos que
   estavam aqui: llama-3.3-70b-versatile, llama-3.1-8b-instant,
   llama-4-scout e gemma2-9b-it. Todos passaram a responder 404
   "model_not_found", a IA nunca respondia e a Carla caía no texto de
   emergencia — o "Nao entendi bem" que o Rafael recebeu.

   Duas mudancas: a lista abaixo passou a ser a atual, e se TODOS
   falharem o robo pergunta a propria Groq quais existem hoje e usa o
   primeiro que funcionar. Assim a proxima aposentadoria nao emudece a
   atendente — no maximo troca de modelo sozinha.
   ========================================================== */
const MODELOS_GROQ = [
  'openai/gpt-oss-120b',
  'qwen/qwen3.6-27b',
  'openai/gpt-oss-20b'
];
let _modelosVivos = null;
async function modelosDaGroq() {
  if (_modelosVivos) return _modelosVivos;
  try {
    const r = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': 'Bearer ' + GROQ_KEY }
    });
    if (!r.ok) return [];
    const d = await r.json();
    _modelosVivos = (d.data || [])
      .map(m => m.id)
      .filter(id => !/whisper|tts|guard|prompt-?guard/i.test(id));
    console.log('[IA] modelos disponiveis na Groq:', _modelosVivos.join(', '));
    return _modelosVivos;
  } catch (e) { return []; }
}
let _modeloBom = null;
let ULTIMO_ERRO_IA = null;

async function chamarGroq(sistema, msgs, segundaVolta) {
  const tentar = _modeloBom ? [_modeloBom, ...MODELOS_GROQ] : MODELOS_GROQ.slice();
  /* todos os conhecidos falharam: pergunta a Groq o que existe hoje */
  if (segundaVolta) {
    const vivos = await modelosDaGroq();
    for (const m of vivos) if (tentar.indexOf(m) < 0) tentar.push(m);
  }
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
  /* nenhum da lista serviu: uma segunda volta, agora com o que a Groq
     disser que existe. So uma vez, para nao entrar em laco. */
  if (!segundaVolta) {
    _modeloBom = null;
    return chamarGroq(sistema, msgs, true);
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

/* ----------------------------------------------------------
   A IA COMO INTÉRPRETE, NÃO COMO RESPONDENTE.
   Ela lê a frase e devolve UMA palavra dizendo o que o gestor
   quer. Não inventa número nem responde nada: os dados vêm do
   banco, como sempre. Assim o gestor escreve do jeito dele e
   não precisa decorar comando.
   ---------------------------------------------------------- */
const INTENCAO = `Você classifica pedidos do dono de uma loja ao sistema de gestão dele.
Responda com UMA palavra apenas, sem explicação, sem pontuação:

faturamento  - quanto vendeu, quanto entrou, movimento, caixa do dia
comprar      - o que falta, o que repor, lista de compras, o que está acabando
boletos      - contas a pagar, vencimentos, despesas
estoque:ITEM - saldo de um item específico. Troque ITEM pelo nome (ex: estoque:farinha)
lancamento   - registrar uma compra/nota de entrada de mercadoria
nenhum       - qualquer outra coisa

Exemplos:
"quanto vendemos hj" -> faturamento
"tem farinha ai?" -> estoque:farinha
"o que ta faltando" -> comprar
"registrar compra de 4kg de farinha" -> lancamento
"bom dia" -> nenhum`;

async function classificarPergunta(texto) {
  if (!texto || texto.length < 3) return null;
  try {
    const r = await chamarIAExtrair(INTENCAO, [{ role: 'user', content: texto }], false);
    if (!r) return null;
    const a = limpar(String(r).split('\n')[0]).trim();
    if (a === 'nenhum' || !a) return null;
    if (['faturamento', 'comprar', 'boletos', 'lancamento'].includes(a)) return a;
    if (a.indexOf('estoque:') === 0 && a.length > 11) return a;
    return null;
  } catch (e) { return null; }
}

/* teste da IA pelo navegador */
app.get('/testeia', protege, limita(10, 60000), async (req, res) => {
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

/* ==========================================================
   A CONFIGURACAO E PROCURADA PELO CODIGO DA UNIDADE

   Dentro do robo, `lojaId` e sempre a referencia da unidade —
   'suc_mt1unhbx2xrb'. Mas whatsapp_config.sucursal_id e o UUID da
   unidade, e ref_local e que guarda a referencia. A busca por
   sucursal_id nunca achava nada: a Carla respondia sem nome de loja,
   sem regras e com o link de emergencia escrito no codigo — foi o
   "Nao entendi bem 😅" com o endereco antigo do GitHub.

   Agora procura pelos dois formatos e guarda por um minuto, para nao
   consultar o banco a cada mensagem.
   ========================================================== */
const _cacheCfg = new Map();
async function buscarCfg(lojaId) {
  if (!sb || !lojaId) return {};
  const guardado = _cacheCfg.get(lojaId);
  if (guardado && guardado.ate > Date.now()) return guardado.cfg;
  let cfg = {};
  try {
    const ehUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(lojaId));
    if (ehUuid) {
      const { data } = await sb.from('whatsapp_config')
        .select('*').eq('sucursal_id', lojaId).maybeSingle();
      cfg = data || {};
    }
    if (!cfg.id) {
      /* o caminho normal: ref_local guarda 'wz_suc_...' */
      const { data } = await sb.from('whatsapp_config')
        .select('*').eq('ref_local', 'wz_' + lojaId).maybeSingle();
      cfg = data || {};
    }
    if (!cfg.id) {
      /* unidade nova: acha o uuid pela referencia e tenta de novo */
      const { data: suc } = await sb.from('sucursais')
        .select('id').eq('ref_local', lojaId).maybeSingle();
      if (suc && suc.id) {
        const { data } = await sb.from('whatsapp_config')
          .select('*').eq('sucursal_id', suc.id).maybeSingle();
        cfg = data || {};
      }
    }
  } catch (e) { cfg = {}; }
  _cacheCfg.set(lojaId, { cfg, ate: Date.now() + 60000 });
  return cfg;
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
app.post('/relatorio/:loja', protege, limita(20, 60000), daMinhaLoja, async (req, res) => {
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
    /* true no fim: veio pelo número da plataforma, então nunca cai na Carla */
    const resposta = await montarResposta(achou.sucursal_id, telefone, texto, imagem, true);
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
app.post('/conectar/:loja', protege, limita(6, 60000), daMinhaLoja, async (req, res) => {
  registrarNoBanco('conectar_whatsapp', req, { loja: req.params.loja });
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

app.post('/desconectar/:loja', protege, limita(6, 60000), daMinhaLoja, async (req, res) => {
  registrarNoBanco('desconectar_whatsapp', req, { loja: req.params.loja });
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

app.post('/enviar', protege, limita(30, 60000), daMinhaLoja, async (req, res) => {
  registrarNoBanco('enviar_mensagem', req, { loja: req.body && req.body.loja });
  /* ==========================================================
     AVISO DE CLIENTE NAO PODE SAIR PELA META

     A Meta so deixa enviar mensagem livre para quem escreveu para o
     numero nas ultimas 24 horas. O cliente do delivery faz o pedido
     pelo site e nunca escreveu — entao a Meta recusa, e o aviso de
     "em preparo" / "saiu para entrega" nunca chegava. O erro aparecia
     no PDV como "meta nao deixou enviar".

     Quem fala com CLIENTE e a Carla (Baileys), que nao tem essa
     restricao. Quem fala com GERENTE continua podendo usar a Meta,
     porque o gerente conversa com o Assistente todo dia.

     `destino` diz para quem e: 'cliente' obriga Baileys.
     ========================================================== */
  const { loja, telefone, texto, destino } = req.body || {};
  if (loja && !podeEnviar(loja)) {
    registrar({ ok: false, motivo: 'limite de envios por minuto atingido', loja });
    return res.status(429).json({ erro: 'muitos envios seguidos — tente em instantes' });
  }
  if (!loja || !telefone || !texto) {
    registrar({ ok: false, motivo: 'faltou loja, telefone ou texto',
      recebido: { loja, telefone, temTexto: !!texto } });
    return res.status(400).json({ erro: 'informe loja, telefone e texto' });
  }
  /* Antes esta rota exigia sessão de Baileys conectada. Os avisos de caixa
     — abertura, fechamento, cancelamento, sangria — passam por aqui, e com a
     Assistente na Meta não havia sessão nenhuma: o gerente fechava o caixa e
     não chegava nada. Agora sai pela camada de canal, que escolhe o caminho. */
  const temBaileys = Object.keys(sessoes)
    .some(k => sessoes[k]?.sock && sessoes[k].estado === 'conectado');
  const paraCliente = destino === 'cliente';
  if (paraCliente && !temBaileys) {
    registrar({ ok: false, motivo: 'aviso de cliente sem Carla conectada',
      pedida: loja, telefone });
    return res.status(409).json({
      erro: 'a Carla está desconectada — o cliente não recebe aviso até ler o QR de novo' });
  }
  if (!CANAL.metaPronta() && !temBaileys) {
    registrar({ ok: false, motivo: 'sem caminho de saida (nem Meta nem Baileys)',
      pedida: loja, telefone });
    return res.status(409).json({ erro: 'nenhum canal de envio disponível' });
  }
  try {
    const num = String(telefone).replace(/\D/g, '');
    await CANAL.enviarPara({
      canal: paraCliente ? 'cliente' : 'assistente',
      sessoes, lojaId: loja, telefone: num, texto
    });
    registrar({ ok: true, para: num, loja, inicio: texto.slice(0, 40) });
    if (sb) sb.from('whatsapp_mensagens').insert([{
      sucursal_id: loja, telefone: num, direcao: 'enviada', texto
    }]).then(() => {}, () => {});
    res.json({ ok: true, para: num });
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
