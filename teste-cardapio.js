/* ==========================================================
   A CARLA SO PODE OFERECER O QUE ESTA NO CARDAPIO DIGITAL

   Em 28/08/2026 ela perguntou ao cliente: "quais sabores e tamanho
   (copo, cascao, pote 500g ou 1kg)?". Nada disso e verdade no
   WhatsApp: o cardapio digital da Santa Fe do Sul tem Gelato 500g,
   Gelato 1kg, Batido 300g e Batido 500g. Copo e cascao so existem no
   balcao — estao marcados apenas em "Frente de caixa".

   Ela inventava porque o contexto dela nunca teve a lista de produtos,
   so a de sabores. Estes testes prendem a regra do canal e a ligacao
   da lista no contexto.

   Rodar:  node teste-cardapio.js
   ========================================================== */
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/server.js', 'utf8');
function pegar(nome) {
  const i = src.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('não achei ' + nome + ' no server.js');
  let j = src.indexOf('{', i), n = 0, f = j;
  for (; f < src.length; f++) {
    if (src[f] === '{') n++;
    else if (src[f] === '}') { n--; if (!n) { f++; break; } }
  }
  return src.slice(i, f);
}
const F = new Function(pegar('noCardapioDigital') + '\n' + pegar('dinheiro') + '\n' +
  pegar('cardapioTexto') + '\nreturn {noCardapioDigital,cardapioTexto};')();

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

console.log('\n── Cada chave vale por si\n');

t('marcado só em Delivery NÃO entra no cardápio digital (a Taxa de Entrega)',
  F.noCardapioDigital({pdv:false,mesa:false,totem:false,cardapio:false,delivery:true}) === false);
t('marcado em Cardápio digital entra',
  F.noCardapioDigital({pdv:true,mesa:false,totem:false,cardapio:true,delivery:true}) === true);
t('marcado só na frente de caixa NÃO entra (Copo P, Cascão)',
  F.noCardapioDigital({pdv:true,mesa:false,totem:false,cardapio:false,delivery:false}) === false);
t('sem nenhuma marcação continua aparecendo em todo lugar',
  F.noCardapioDigital({}) === true);
t('objeto ausente não quebra', F.noCardapioDigital(undefined) === true);
t('`online`, nome antigo do mesmo campo, continua valendo',
  F.noCardapioDigital({online:true,pdv:true}) === true);
t('marcado em mesa e totem não vaza para o cardápio digital',
  F.noCardapioDigital({mesa:true,totem:true}) === false);

console.log('\n── O cardápio real da Santa Fé do Sul (dados de produção)\n');

/* copiado do banco em 28/08/2026 */
const PROD = [
  {nome:'Copo P',                     cat:'Copo',         d:{pdv:true,cardapio:false,delivery:false}},
  {nome:'Copo M',                     cat:'Copo',         d:{pdv:true,cardapio:false,delivery:false}},
  {nome:'Cascão 1 Bola',              cat:'Cascão',       d:{pdv:true,cardapio:false,delivery:false}},
  {nome:'Cascão 2 Bolas',             cat:'Cascão',       d:{pdv:true,cardapio:false,delivery:false}},
  {nome:'Gelato 500 Gramas',          cat:'Potes Gelato', d:{pdv:true,cardapio:true,delivery:true}},
  {nome:'Gelato 1 Kg',                cat:'Potes Gelato', d:{pdv:true,cardapio:true,delivery:true}},
  {nome:'Batido Di Gelato 300 Gramas',cat:'Sobremesas',   d:{pdv:true,cardapio:true,delivery:true}},
  {nome:'Batido Di Gelato 500 Gramas',cat:'Sobremesas',   d:{pdv:true,cardapio:true,delivery:true}},
  {nome:'Brownie Gourmet',            cat:'Sobremesas',   d:{pdv:true,cardapio:false,delivery:false}},
  {nome:'Taxa de Entrega',            cat:'Taxa de Entrega',d:{pdv:false,cardapio:false,delivery:true}}
];
const passam = PROD.filter(p => F.noCardapioDigital(p.d)).map(p => p.nome);

t('passam exatamente os quatro itens do cardápio digital',
  passam.length === 4, passam.join(' | '));
t('Copo P não passa',  passam.indexOf('Copo P') < 0);
t('Cascão não passa',  passam.every(n => !/cascão/i.test(n)));
t('Taxa de Entrega não passa', passam.indexOf('Taxa de Entrega') < 0);
t('Gelato 1 Kg passa', passam.indexOf('Gelato 1 Kg') >= 0);

console.log('\n── A lista chega ao contexto dela\n');

const txt = F.cardapioTexto(PROD.filter(p => F.noCardapioDigital(p.d))
  .map(p => ({nome:p.nome, preco:0, categoria:p.cat})));
t('agrupa por categoria', /Potes Gelato:/.test(txt) && /Sobremesas:/.test(txt));
t('não cita copo nem cascão', !/copo|cascão/i.test(txt));
t('lista vazia não vira texto', F.cardapioTexto([]) === '');
t('mostra o preço quando existe',
  /R\$ 65,00/.test(F.cardapioTexto([{nome:'Gelato 500 Gramas',preco:65,categoria:'Potes Gelato'}])));

console.log('\n── A função está ligada de verdade\n');

/* sem comentário no meio, senão o próprio texto explicativo passa no teste */
const codigo = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
t('montarContexto chama carregarCardapio',
  /const cardapio = cardapioTexto\(await carregarCardapio\(\)\)/.test(codigo));
t('a lista entra no texto do contexto',
  /\$\{cardapio \? `- O QUE O CLIENTE PODE PEDIR PELO WHATSAPP/.test(codigo));
t('a proibição de inventar tamanho está escrita na regra',
  /NUNCA invente tamanho, formato ou embalagem/.test(codigo));
t('a regra manda usar o nome exato da lista',
  /com o nome exato que está nela/.test(codigo));
t('carregarCardapio existe', /async function carregarCardapio\(\)/.test(codigo));
t('o cache não deixa a lista envelhecer mais de 3 minutos',
  /_cardapioCache\.quando < 3 \* 60 \* 1000/.test(codigo));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);
