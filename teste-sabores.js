/* ==========================================================
   A CARLA NAO FALA NOME DE SABOR

   Ordem da loja em 30/08/2026: quando perguntarem qual sabor tem, ela
   NAO lista. Manda o link do cardapio e diz que la esta tudo.

   O motivo nao e estetica: a lista muda com a producao do dia. Sabor
   citado no WhatsApp que ja acabou vira reclamacao no balcao — e a
   Carla nao tem como saber o que a cuba tem agora.

   Estes testes prendem as tres pontas:
     1. a resposta pronta manda o link e nao cita sabor;
     2. o contexto da IA nao recebe mais lista de sabor nenhuma;
     3. a proibicao esta ESCRITA na regra que vai para o modelo.

   Rodar:  node teste-sabores.js
   ========================================================== */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/server.js', 'utf8');

function pegar(nome) {
  let i = src.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('não achei ' + nome + ' no server.js');
  if (src.slice(Math.max(0, i - 6), i) === 'async ') i -= 6;
  let j = src.indexOf('{', i), n = 0, f = j;
  for (; f < src.length; f++) {
    if (src[f] === '{') n++;
    else if (src[f] === '}') { n--; if (!n) { f++; break; } }
  }
  return src.slice(i, f);
}

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

const F = new Function(pegar('pareceCom') + '\n' + pegar('limpar') + '\n' + pegar('contem') + '\n' + pegar('responderSabores') +
  '\nreturn {responderSabores};')();
const LINK = 'https://joiagest.com.br/cardapio';

/* os sabores que a loja tem hoje, para conferir que NENHUM aparece */
const SABORES = ['Leite Ninho Trufado Gelato', 'Jolô Gelato', 'Maracuja Sorbet',
  'Chocolate Zero Açucar', 'Ovomaltine', 'Whey Zero Açucar', 'morango',
  'chocolate', 'ninho', 'maracuja'];

console.log('\n── 1. Perguntou de sabor, recebe o link\n');

const PERGUNTAS = [
  'qual sabor de gelato voces tem?',
  'quais os sabores de hoje',
  'tem de morango?',
  'que sabores tem hoje',
  'tem sabor zero acucar?',
  'voces tem alguma novidade de sabor',
  'tem gelato diet?',
];
for (const q of PERGUNTAS) {
  const r = String(F.responderSabores(q.toLowerCase(), LINK) || '');
  t('"' + q + '" → manda o link', r.indexOf(LINK) >= 0, r);
  t('"' + q + '" → NÃO cita nenhum sabor',
    !SABORES.some(s => new RegExp(s.split(' ')[0], 'i').test(r)), r);
  t('"' + q + '" → nunca volta vazio', r.trim().length > 10, r);
}

console.log('\n── 2. A resposta é curta, de WhatsApp — não é textão\n');

const r = String(F.responderSabores('quais sabores tem', LINK));
t('cabe em poucas linhas', r.split('\n').filter(x => x.trim()).length <= 5,
  r.split('\n').length + ' linhas');
t('diz que está tudo no cardápio', /cardápio/i.test(r), r);
t('não tem lista com marcadores', r.indexOf('•') < 0, r);
console.log('\n' + r + '\n');

console.log('\n── 3. A IA também não recebe nem cita sabor\n');

const contexto = pegar('montarContexto');
t('o contexto NÃO carrega mais a lista de sabores',
  !/carregarSabores\s*\(/.test(contexto));
t('não monta lista de tradicionais, zero e lançamentos',
  !/Sabores tradicionais:/.test(contexto) && !/Lançamentos: \$\{/.test(contexto));
t('e diz ao modelo que ele NÃO tem essa lista',
  /NÃO tem a lista/.test(contexto), 'regra ausente');
t('a proibição de dizer nome de sabor está escrita',
  /NUNCA diga o nome de um sabor/.test(contexto), 'regra ausente');
t('e manda o link como resposta padrão para sabor',
  /resposta é\s*\n?\s*sempre a mesma: está tudo no cardápio, e manda o link/
    .test(contexto.replace(/\s+/g, ' ')) ||
  /está tudo no cardápio, e manda o link/.test(contexto), 'regra ausente');

console.log('\n── 4. Nada de código morto: o leitor de sabores saiu junto\n');

t('carregarSabores não existe mais', src.indexOf('async function carregarSabores') < 0);
t('nem o cache dele', src.indexOf('_saboresCache =') < 0);
t('nem ehZero, que só servia para ele', src.indexOf('function ehZero(') < 0);
t('e ninguém ficou chamando o que não existe',
  !/[^`'"\/]\bcarregarSabores\s*\(/.test(src));
t('os alérgenos continuam de pé — alergia não se resolve com link',
  /async function alergenosTexto/.test(src) && /await alergenosTexto\(\)/.test(src));

console.log('\n════════════════════════════════════════════════════');
console.log(falhas ? `${falhas} de ${testes} FALHARAM` : `${testes} de ${testes} testes passaram`);
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);
