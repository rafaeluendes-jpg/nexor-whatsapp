/* ==========================================================
   NEXOR — RELATÓRIO DO CHECKLIST

   As respostas do gestor viram documento e chegam sozinhas no
   WhatsApp da franqueadora, a cada tantos dias.

   O PDF não é o registro — o registro é a tabela
   assistente_conversas, que ninguém reescreve (há trava no
   banco) e só o dono do Nexor apaga. O PDF é a forma de
   entregar, e o próprio WhatsApp o guarda.

   Sem dependência de biblioteca: o PDF é escrito à mão. Uma
   tabela de texto não justifica arrastar 2 MB de pacote para
   dentro do robô, e menos dependência é menos coisa para
   quebrar num serviço que roda sozinho.
   ========================================================== */

/* ---------- PDF cru ---------- */
function escapar(t) {
  return String(t == null ? '' : t)
    .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/* O PDF base usa WinAnsi; acento fora dessa tabela vira lixo na tela.
   Trocar por equivalente sem acento é mais honesto que mostrar caractere
   quebrado num documento que vai para o franqueador. */
function semAcento(t) {
  return String(t == null ? '' : t)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '');
}

function montarPDF(linhas) {
  const A = { L: 595.28, A: 841.89 };
  const margem = 48;
  const paginas = [];
  let atual = [];
  let y = A.A - margem;

  for (const l of linhas) {
    const alt = l.tamanho >= 14 ? 24 : 15;
    if (y - alt < margem + 28) { paginas.push(atual); atual = []; y = A.A - margem; }
    atual.push({ ...l, y: y });
    y -= alt + (l.espaco || 0);
  }
  paginas.push(atual);

  const objetos = [];
  const add = (s) => { objetos.push(s); return objetos.length; };

  const nPag = paginas.length;
  const idFonteN = 3 + nPag * 2;          /* reservado abaixo */
  const idFonteB = idFonteN + 1;

  /* 1: catálogo · 2: páginas */
  add('<< /Type /Catalog /Pages 2 0 R >>');
  const idsPag = paginas.map((_, k) => 3 + k * 2);
  add(`<< /Type /Pages /Kids [${idsPag.map(i => i + ' 0 R').join(' ')}] /Count ${nPag} >>`);

  paginas.forEach((pag, k) => {
    const idP = 3 + k * 2;
    const idC = idP + 1;
    let fluxo = '';
    for (const l of pag) {
      const fonte = l.negrito ? '/FB' : '/FN';
      const tam = l.tamanho || 10;
      const cinza = l.cinza ? '0.45 0.45 0.45 rg' : '0 0 0 rg';
      fluxo += `BT ${fonte} ${tam} Tf ${cinza} ${margem + (l.x || 0)} ${l.y} Td ` +
               `(${escapar(semAcento(l.texto))}) Tj ET\n`;
      if (l.linha) {
        fluxo += `0.8 0.8 0.8 RG 0.5 w ${margem} ${l.y - 5} m ${A.L - margem} ${l.y - 5} l S\n`;
      }
    }
    fluxo += `BT /FN 8 Tf 0.5 0.5 0.5 rg ${margem} ${margem} Td ` +
             `(Nexor - pagina ${k + 1} de ${nPag}) Tj ET\n`;

    objetos[idP - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A.L} ${A.A}] ` +
      `/Resources << /Font << /FN ${idFonteN} 0 R /FB ${idFonteB} 0 R >> >> ` +
      `/Contents ${idC} 0 R >>`;
    objetos[idC - 1] = `<< /Length ${Buffer.byteLength(fluxo)} >>\nstream\n${fluxo}endstream`;
    while (objetos.length < idC) objetos.push('');
  });

  objetos[idFonteN - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objetos[idFonteB - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

  let pdf = '%PDF-1.4\n';
  const posicoes = [];
  objetos.forEach((o, i) => {
    posicoes.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const inicioXref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const p of posicoes) pdf += String(p).padStart(10, '0') + ' 00000 n \n';
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`;
  return Buffer.from(pdf, 'binary');
}

/* ---------- o conteúdo ---------- */
function dataBR(d) {
  if (!d) return '';
  const p = String(d).slice(0, 10).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(d);
}

function montarRelatorio({ rede, de, ate, porSucursal }) {
  const L = [];
  L.push({ texto: 'Relatorio de Checklist', tamanho: 18, negrito: true });
  L.push({ texto: `${rede} · ${dataBR(de)} a ${dataBR(ate)}`, tamanho: 10, cinza: true, espaco: 10, linha: true });

  let totalSim = 0, totalNao = 0, totalSem = 0;

  for (const suc of porSucursal) {
    L.push({ texto: suc.nome, tamanho: 13, negrito: true, espaco: 4 });
    if (!suc.linhas.length) {
      L.push({ texto: 'Sem registro no periodo.', tamanho: 9, cinza: true, x: 10, espaco: 10 });
      continue;
    }
    L.push({ texto: 'Data        Rotina                                Resposta',
             tamanho: 9, cinza: true, x: 10, espaco: 2 });
    for (const l of suc.linhas) {
      const r = (l.resposta || '').toLowerCase();
      const marca = !l.respondida_em ? 'SEM RESPOSTA'
        : /^(s|sim|ok|feito|1)/.test(r) ? 'SIM' : /^(n|nao)/.test(r) ? 'NAO' : (l.resposta || '');
      if (marca === 'SIM') totalSim++; else if (marca === 'NAO') totalNao++; else totalSem++;
      const rot = String(l.rotina_nome || '').slice(0, 34).padEnd(34, ' ');
      L.push({ texto: `${dataBR(l.data).padEnd(12)}${rot}${marca}`, tamanho: 9, x: 10 });
    }
    L.push({ texto: '', tamanho: 9, espaco: 8 });
  }

  L.push({ texto: 'Resumo do periodo', tamanho: 12, negrito: true, espaco: 4, linha: true });
  L.push({ texto: `Feito: ${totalSim}    Nao feito: ${totalNao}    Sem resposta: ${totalSem}`,
           tamanho: 10, x: 10, espaco: 8 });
  L.push({ texto: 'Este documento e uma copia. O registro original fica no Nexor,', tamanho: 8, cinza: true });
  L.push({ texto: 'com data e hora de cada resposta, e nao pode ser alterado.', tamanho: 8, cinza: true });
  return montarPDF(L);
}

/* ---------- buscar e enviar ---------- */
async function gerarParaLoja(sb, lojaId, dias) {
  const ate = new Date();
  const de = new Date(Date.now() - (dias || 7) * 864e5);
  const fmt = (d) => d.toISOString().slice(0, 10);

  const { data: sucs } = await sb.from('sucursais')
    .select('id, nome, ref_local').eq('loja_id', lojaId);
  const { data: conv } = await sb.from('assistente_conversas')
    .select('rotina_nome, data, resposta, respondida_em, ref_local')
    .eq('loja_id', lojaId).gte('data', fmt(de)).lte('data', fmt(ate))
    .order('data', { ascending: true });

  const porSucursal = (sucs || []).map(s => ({
    nome: s.nome,
    linhas: (conv || []).filter(c => c.ref_local === s.id || c.ref_local === s.ref_local),
  }));
  /* o que não casou com sucursal nenhuma não pode sumir do relatório */
  const soltas = (conv || []).filter(c =>
    !(sucs || []).some(s => c.ref_local === s.id || c.ref_local === s.ref_local));
  if (soltas.length) porSucursal.push({ nome: 'Sem unidade identificada', linhas: soltas });

  const { data: cli } = await sb.from('clientes_nexor')
    .select('rede').eq('loja_id', lojaId).limit(1);
  const rede = cli?.[0]?.rede || 'Rede';

  return {
    pdf: montarRelatorio({ rede, de: fmt(de), ate: fmt(ate), porSucursal }),
    nome: `checklist-${fmt(de)}-a-${fmt(ate)}.pdf`,
    vazio: !(conv || []).length,
  };
}

/* Roda uma vez por dia. Cada loja tem a sua frequência; só dispara
   quando o número de dias desde o último envio a alcança. */
const ultimoEnvio = new Map();

async function enviarRelatorios({ sb, sessoes, enviarPara, enviarDocumento }) {
  if (!sb) return;
  const { data: cfgs } = await sb.from('whatsapp_config')
    .select('loja_id, sucursal_id, relatorio_zap, relatorio_freq, assistente_ativa')
    .not('relatorio_zap', 'is', null);

  const vistas = new Set();
  for (const c of (cfgs || [])) {
    if (c.assistente_ativa === false) continue;
    if (!c.relatorio_zap) continue;
    if (vistas.has(c.loja_id)) continue;     /* um relatório por rede, não por unidade */
    vistas.add(c.loja_id);

    const dias = Math.max(1, Number(c.relatorio_freq) || 7);
    const ultimo = ultimoEnvio.get(c.loja_id) || 0;
    if (Date.now() - ultimo < dias * 864e5) continue;

    try {
      const r = await gerarParaLoja(sb, c.loja_id, dias);
      if (r.vazio) { ultimoEnvio.set(c.loja_id, Date.now()); continue; }

      const legenda = `📋 Relatorio de checklist dos ultimos ${dias} dias.`;
      if (enviarDocumento) {
        await enviarDocumento(c.relatorio_zap, r.pdf, r.nome, legenda);
      } else {
        await enviarPara({ canal: 'assistente', sessoes, lojaId: c.sucursal_id,
          telefone: c.relatorio_zap, texto: legenda + '\n(o documento vai a seguir)' });
      }
      ultimoEnvio.set(c.loja_id, Date.now());
      console.log('[relatorio] enviado para', c.relatorio_zap);
    } catch (e) {
      console.error('[relatorio] falhou:', e && e.message);
    }
  }
}

module.exports = { montarRelatorio, gerarParaLoja, enviarRelatorios, montarPDF };
