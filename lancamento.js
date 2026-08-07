/* ==========================================================
   NEXOR — LANÇAMENTO PELA ASSISTENTE

   O gestor manda a foto da nota ou escreve o que comprou. A
   assistente entende, confere item a item com ele, e no fim
   grava o lançamento.

   REGRA QUE NÃO SE QUEBRA: o robô NÃO calcula estoque.
   No Nexor o estoque é um número guardado no insumo, somado
   por aplicarMovimento() quando alguém lança pela tela. Se o
   robô também somasse, seriam duas contas em lugares
   diferentes — e é assim que nasce divergência de estoque.
   Então ele grava o lançamento já confirmado em
   whatsapp_pendentes, e o sistema aplica pelo mesmo caminho
   de uma pessoa digitando. Com o PDV aberto, isso leva
   segundos.

   A conversa inteira fica guardada junto. Se um dia alguém
   disser que o sistema lançou errado, está lá o que foi
   perguntado e o que ele respondeu, com hora.
   ========================================================== */

const ETAPAS = { LENDO: 'lendo', ITEM: 'item', TOTAL: 'total' };

/* conversa em andamento, por telefone. Vive na memória: se o robô
   reiniciar no meio, o gestor recomeça — melhor que aplicar um
   lançamento que ele não terminou de conferir. */
const emCurso = new Map();
const VALIDADE = 30 * 60 * 1000;

function limparVelhas() {
  const agora = Date.now();
  for (const [k, v] of emCurso) if (agora - v.inicio > VALIDADE) emCurso.delete(k);
}
function dinheiro(v) { return (Number(v) || 0).toFixed(2).replace('.', ','); }
function nn(v) { return Number(String(v).replace(',', '.')) || 0; }
function simples(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
}
function ehSim(t) {
  return /^(s|sim|isso|ok|confirmo|confirmar|certo|exato|pode|positivo|1)$/.test(simples(t));
}
function ehNao(t) {
  return /^(n|nao|negativo|errado|incorreto|2)$/.test(simples(t));
}
function ehCancelar(t) {
  return /^(cancelar|cancela|para|parar|esquece|desisto|sair)$/.test(simples(t));
}

/* ----------------------------------------------------------
   1. ENTENDER O QUE ELE MANDOU
   A IA só extrai; ela não decide nada e não inventa preço.
   O que ela não achar volta em branco, para ser perguntado.
   ---------------------------------------------------------- */
const INSTRUCAO = `Você extrai dados de compras de insumos para um sistema de gestão.
Devolva SOMENTE um JSON, sem texto antes ou depois, sem markdown, neste formato:

{"fornecedor":"","documento":"","data":"","itens":[{"nome":"","quantidade":0,"unidade":"","valorUnitario":0,"valorTotal":0}],"valorTotal":0}

Regras:
- Use ponto como separador decimal.
- Se um dado não estiver claro, deixe string vazia ou 0. NUNCA invente valor, quantidade ou fornecedor.
- unidade deve ser uma destas quando der para saber: kg, g, l, ml, un, cx, pct. Senão deixe vazio.
- data no formato AAAA-MM-DD. Se não houver, deixe vazio.
- Não some nem confira totais: copie o que está escrito.`;

async function entender({ texto, imagem, chamarIA }) {
  const conteudo = imagem
    ? [{ type: 'text', text: texto || 'Extraia os dados desta nota.' },
       { type: 'image_url', image_url: { url: `data:${imagem.tipo};base64,${imagem.base64}` } }]
    : texto;
  const bruto = await chamarIA(INSTRUCAO, [{ role: 'user', content: conteudo }], !!imagem);
  if (!bruto) return null;
  const limpo = String(bruto).replace(/```json|```/g, '').trim();
  const inicio = limpo.indexOf('{');
  const fim = limpo.lastIndexOf('}');
  if (inicio < 0 || fim < 0) return null;
  try { return JSON.parse(limpo.slice(inicio, fim + 1)); } catch (e) { return null; }
}

/* ----------------------------------------------------------
   2. LIGAR O QUE ELE FALOU AO CADASTRO
   "açúcar" tem de virar o insumo certo. Quando houver dúvida,
   a assistente pergunta em vez de escolher sozinha.
   ---------------------------------------------------------- */
async function acharInsumos(sb, lojaId, nome) {
  const { data } = await sb.from('insumos')
    .select('id, nome, unidade, ref_local, codigo, estoque_atual, custo')
    .eq('loja_id', lojaId);
  const alvo = simples(nome);
  if (!alvo || !data) return [];
  const exato = data.filter(i => simples(i.nome) === alvo);
  if (exato.length) return exato;
  const contem = data.filter(i => simples(i.nome).includes(alvo) || alvo.includes(simples(i.nome)));
  return contem.slice(0, 5);
}

/* ----------------------------------------------------------
   3. A CONVERSA
   ---------------------------------------------------------- */
function textoDoItem(it, n, total) {
  const q = `${it.quantidade || '?'}${it.unidade ? ' ' + it.unidade : ''}`;
  const v = it.valorTotal ? `R$ ${dinheiro(it.valorTotal)}` :
            it.valorUnitario ? `R$ ${dinheiro(it.valorUnitario)} cada` : 'valor não informado';
  return `*Item ${n} de ${total}*\n${it.nomeCadastro || it.nome}\n${q} · ${v}\n\n` +
         `Está certo? Responda *sim*, ou escreva a correção ` +
         `(ex.: _12 kg por 58,00_).`;
}

async function iniciar({ sb, lojaId, sucursalId, telefone, texto, imagem, chamarIA }) {
  limparVelhas();
  const lido = await entender({ texto, imagem, chamarIA });
  if (!lido || !Array.isArray(lido.itens) || !lido.itens.length) {
    return imagem
      ? 'Não consegui ler essa nota 😕\n\nMe diga por escrito: o item, a quantidade e o valor. ' +
        'Exemplo: _10 kg de açúcar por 45,00_.'
      : null;   /* não era um lançamento; deixa outro trecho responder */
  }

  /* casa cada item com o cadastro */
  const itens = [];
  for (const it of lido.itens) {
    const achados = await acharInsumos(sb, lojaId, it.nome);
    itens.push({
      ...it,
      quantidade: nn(it.quantidade),
      valorUnitario: nn(it.valorUnitario),
      valorTotal: nn(it.valorTotal) || (nn(it.quantidade) * nn(it.valorUnitario)),
      candidatos: achados.map(a => ({ id: a.id, ref: a.ref_local, nome: a.nome, unidade: a.unidade })),
      insumoId: achados.length === 1 ? achados[0].id : null,
      insumoRef: achados.length === 1 ? achados[0].ref_local : null,
      nomeCadastro: achados.length === 1 ? achados[0].nome : null,
    });
  }

  const sessao = {
    inicio: Date.now(), lojaId, sucursalId, telefone,
    etapa: ETAPAS.ITEM, i: 0, itens,
    cabecalho: {
      fornecedor: lido.fornecedor || '',
      documento: lido.documento || '',
      data: lido.data || new Date().toISOString().slice(0, 10),
      valorTotal: nn(lido.valorTotal),
    },
    conversa: [{ quem: 'gestor', texto: texto || '(foto da nota)', em: new Date().toISOString() }],
  };
  emCurso.set(telefone, sessao);

  const cab = sessao.cabecalho.fornecedor
    ? `Li a nota de *${sessao.cabecalho.fornecedor}*` : 'Li o que você mandou';
  const pergunta = `${cab} — ${itens.length} ${itens.length === 1 ? 'item' : 'itens'}.\n` +
    `Vou conferir um por um.\n\n` + perguntaAtual(sessao);
  sessao.conversa.push({ quem: 'assistente', texto: pergunta, em: new Date().toISOString() });
  return pergunta;
}

function perguntaAtual(s) {
  const it = s.itens[s.i];
  if (!it) return '';
  if (!it.insumoId) {
    if (it.candidatos.length > 1) {
      return `*Item ${s.i + 1} de ${s.itens.length}* — "${it.nome}"\n\n` +
        `Achei mais de um no cadastro. Qual é?\n` +
        it.candidatos.map((c, k) => `*${k + 1}* — ${c.nome}`).join('\n') +
        `\n\nResponda o número, ou *pular* para deixar este item de fora.`;
    }
    return `*Item ${s.i + 1} de ${s.itens.length}* — "${it.nome}"\n\n` +
      `Não achei esse item no cadastro do estoque. Escreva o nome como ele está ` +
      `cadastrado, ou *pular* para deixá-lo de fora.`;
  }
  return textoDoItem(it, s.i + 1, s.itens.length);
}

function avancar(s) {
  s.i++;
  if (s.i < s.itens.length) return perguntaAtual(s);
  s.etapa = ETAPAS.TOTAL;
  const validos = s.itens.filter(x => x.insumoId && !x.pulado);
  const soma = validos.reduce((a, x) => a + (x.valorTotal || 0), 0);
  s.cabecalho.valorTotal = soma;
  if (!validos.length) { emCurso.delete(s.telefone); return 'Nenhum item ficou para lançar. Cancelei.'; }
  return `*Confere o lançamento:*\n\n` +
    validos.map(x => `• ${x.nomeCadastro} — ${x.quantidade}${x.unidade ? ' ' + x.unidade : ''} · R$ ${dinheiro(x.valorTotal)}`).join('\n') +
    `\n\n*Total: R$ ${dinheiro(soma)}*` +
    (s.cabecalho.fornecedor ? `\nFornecedor: ${s.cabecalho.fornecedor}` : '') +
    `\n\nLanço isso no estoque e no financeiro? Responda *sim* ou *não*.`;
}

/* interpreta uma correção escrita: "12 kg por 58,00" */
function lerCorrecao(texto) {
  const t = simples(texto);
  const mQ = t.match(/([\d.,]+)\s*(kg|g|l|ml|un|cx|pct)?/);
  const mV = t.match(/(?:por|a|=|r\$)\s*([\d.,]+)/);
  const r = {};
  if (mQ) { r.quantidade = nn(mQ[1]); if (mQ[2]) r.unidade = mQ[2]; }
  if (mV) r.valorTotal = nn(mV[1]);
  return (r.quantidade || r.valorTotal) ? r : null;
}

async function responder({ sb, telefone, texto, gravar }) {
  limparVelhas();
  const s = emCurso.get(telefone);
  if (!s) return null;
  s.conversa.push({ quem: 'gestor', texto, em: new Date().toISOString() });

  const dizer = (t) => {
    s.conversa.push({ quem: 'assistente', texto: t, em: new Date().toISOString() });
    return t;
  };

  if (ehCancelar(texto)) { emCurso.delete(telefone); return 'Cancelado. Nada foi lançado.'; }

  /* --- fechamento --- */
  if (s.etapa === ETAPAS.TOTAL) {
    if (ehNao(texto)) { emCurso.delete(telefone); return dizer('Não lancei nada. Pode mandar de novo quando quiser.'); }
    if (!ehSim(texto)) return dizer('Só para eu ter certeza: responda *sim* para lançar, ou *não* para descartar.');
    const r = await gravar(s);
    emCurso.delete(telefone);
    return dizer(r);
  }

  /* --- conferência de item --- */
  const it = s.itens[s.i];

  if (simples(texto) === 'pular') { it.pulado = true; return dizer(avancar(s)); }

  /* escolha entre candidatos */
  if (!it.insumoId && it.candidatos.length > 1) {
    const n = parseInt(simples(texto), 10);
    if (n >= 1 && n <= it.candidatos.length) {
      const c = it.candidatos[n - 1];
      it.insumoId = c.id; it.insumoRef = c.ref; it.nomeCadastro = c.nome;
      if (!it.unidade) it.unidade = c.unidade || '';
      return dizer(textoDoItem(it, s.i + 1, s.itens.length));
    }
  }

  /* item não encontrado: ele escreveu outro nome */
  if (!it.insumoId) {
    const achados = await acharInsumos(sb, s.lojaId, texto);
    if (achados.length === 1) {
      it.insumoId = achados[0].id; it.insumoRef = achados[0].ref_local;
      it.nomeCadastro = achados[0].nome;
      if (!it.unidade) it.unidade = achados[0].unidade || '';
      return dizer(textoDoItem(it, s.i + 1, s.itens.length));
    }
    if (achados.length > 1) {
      it.candidatos = achados.map(a => ({ id: a.id, ref: a.ref_local, nome: a.nome, unidade: a.unidade }));
      return dizer(perguntaAtual(s));
    }
    return dizer(`Também não achei "${texto}" no cadastro. Tente outro nome, ou *pular*.`);
  }

  if (ehSim(texto)) return dizer(avancar(s));

  const cor = lerCorrecao(texto);
  if (cor) {
    if (cor.quantidade) it.quantidade = cor.quantidade;
    if (cor.unidade) it.unidade = cor.unidade;
    if (cor.valorTotal) it.valorTotal = cor.valorTotal;
    if (it.quantidade) it.valorUnitario = +(it.valorTotal / it.quantidade).toFixed(4);
    return dizer(`Corrigido: ${it.nomeCadastro} — ${it.quantidade}${it.unidade ? ' ' + it.unidade : ''} · ` +
      `R$ ${dinheiro(it.valorTotal)}.\n\nConfirma? *sim* ou escreva de novo.`);
  }

  return dizer('Não entendi. Responda *sim* se estiver certo, ou escreva a correção ' +
    'no formato _10 kg por 45,00_.');
}

/* ----------------------------------------------------------
   4. GRAVAR — sem calcular nada
   ---------------------------------------------------------- */
async function gravarPendente(sb, s) {
  const validos = s.itens.filter(x => x.insumoId && !x.pulado);
  const dados = {
    tipo: 'nota_entrada',
    fornecedor: s.cabecalho.fornecedor || '',
    documento: s.cabecalho.documento || '',
    data: s.cabecalho.data,
    valorTotal: s.cabecalho.valorTotal,
    itens: validos.map(x => ({
      insumoId: x.insumoId, insumoRef: x.insumoRef, nome: x.nomeCadastro,
      quantidade: x.quantidade, unidade: x.unidade,
      valorUnitario: x.valorUnitario, valorTotal: x.valorTotal,
    })),
  };
  const resumo = `${validos.length} ${validos.length === 1 ? 'item' : 'itens'}` +
    (s.cabecalho.fornecedor ? ` · ${s.cabecalho.fornecedor}` : '') +
    ` · R$ ${dinheiro(s.cabecalho.valorTotal)}`;

  const { error } = await sb.from('whatsapp_pendentes').insert([{
    loja_id: s.lojaId, sucursal_id: s.sucursalId, telefone: s.telefone,
    acao: 'nota_entrada', dados, resumo, situacao: 'confirmado',
    confirmado_em: new Date().toISOString(),
    conversa: s.conversa,
  }]);
  if (error) throw new Error(error.message);

  return `✅ *Lançado.*\n${resumo}\n\n` +
    `Entra no estoque e no financeiro assim que o sistema da loja atualizar — ` +
    `com o PDV aberto, é questão de segundos.`;
}

function temConversaAberta(telefone) { return emCurso.has(telefone); }

module.exports = { iniciar, responder, gravarPendente, temConversaAberta };
