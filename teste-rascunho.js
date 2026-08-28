/* ==========================================================
   O RASCUNHO DA CARLA NUNCA PODE CHEGAR AO CLIENTE

   Em 26/08/2026 um cliente mandou "Boa tarde" e recebeu de volta o
   raciocinio do modelo, em ingles, explicando como a Carla deveria
   responder. Em 28/08 aconteceu de novo, com o conserto ja no GitHub —
   o servidor no ar era mais velho.

   Estes testes rodam as funcoes de verdade do server.js contra os
   textos que os clientes REALMENTE receberam.

   Rodar:  node teste-rascunho.js
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
const F = new Function(pegar('limparResposta') + '\n' + pegar('pareceRascunho') +
  '\nreturn {limparResposta,pareceRascunho};')();

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
/* a pergunta que importa: isso sai para o cliente? */
function sai(txt) {
  const limpo = F.limparResposta(txt || '');
  return (limpo && !F.pareceRascunho(limpo)) ? limpo : null;
}

console.log('\n── Os textos que o cliente recebeu de verdade\n');

const vazado26 = `<think>
Okay, the user said "Boa tarde". Let me analyze the request.
**Persona:** Carla, warm, welcoming.
**Constraints:** max 2 emojis, Portuguese.
Here's my thinking: I should greet them back.
</think>
Oi! Aqui é a Carla 😊`;
t('rascunho fechado com </think>: só a resposta sai',
  sai(vazado26) === 'Oi! Aqui é a Carla 😊', JSON.stringify(sai(vazado26)));

const vazado28 = `<think>
The user said "Boa tarde" (Good afternoon).
I need to follow the specific instructions for the first message.
1.  *Mandatory Introduction:* "Oi! Aqui é a Carla, da Jolô Gelato SFS" (or similar).
Final Polish:
"Oi! Aqui é a Carla, da Jolô Gelato SFS. Boa tarde! 😊 Estamos abertos agora."`;
t('rascunho que NUNCA fecha a tag: não sai nada', sai(vazado28) === null,
  JSON.stringify(sai(vazado28)));

console.log('\n── Outras formas de rascunho que já apareceram\n');

t('tag <thinking>', sai('<thinking>bla bla</thinking>Boa tarde!') === 'Boa tarde!');
t('tag <reasoning>', sai('<reasoning>bla</reasoning>Oi!') === 'Oi!');
t('marcador <|end_of_thought|>',
  sai('penso penso <|end_of_thought|>Olá!') === 'Olá!');
t('rascunho em inglês sem tag nenhuma',
  sai('**Analyze the Request:** the user wants ice cream. **Persona:** Carla.') === null);
t('começa em inglês falando do próprio trabalho',
  sai('Okay, I should greet the customer and I need to be warm.') === null);
t('só a tag aberta, sem mais nada', sai('<think>') === null);
t('vazio', sai('') === null);
t('espaço em branco', sai('   \n  ') === null);

console.log('\n── E a resposta de verdade tem de passar\n');

t('saudação simples',
  sai('Oi! Aqui é a Carla, da Jolô Gelato SFS. Boa tarde! 😊') !== null);
t('cardápio com valores',
  sai('Temos casquinha por R$ 12,00 e pote de 100g por R$ 20,00. Qual você prefere?') !== null);
t('resposta com quebra de linha e emoji',
  sai('Seu pedido saiu! 🛵\nChega em uns 40 minutos.') !== null);
t('resposta curta', sai('Sim!') !== null);
t('resposta que fala a palavra "pensar" sem ser rascunho',
  sai('Vou pensar num sabor pra você! Que tal pistache?') !== null);
t('resposta em português que começa com "Primeiro"',
  sai('Primeiro me diz o endereço, aí eu calculo a taxa 😊') !== null);

console.log('\n── A trava tem de estar na porta, não só dentro das funções\n');

t('a saída para o cliente passa por limparResposta',
  /const limpa = limparResposta\(resposta \|\| ''\);/.test(src));
t('e recusa o que parecer rascunho',
  /if \(limpa && !pareceRascunho\(limpa\)\)/.test(src));
t('mandando a limpa, nunca a crua',
  /sendMessage\(de, \{ text: limpa \}\)/.test(src));
t('e o bloqueio fica registrado no log',
  /resposta bloqueada na porta/.test(src));
t('o modelo é instruído a esconder o raciocínio na origem',
  /reasoning_format: 'hidden'/.test(src));
t('e há como saber que versão está no ar',
  /const VERSAO_ROBO = /.test(src) && /versao: VERSAO_ROBO/.test(src));

console.log('\n════════════════════════════════════════════════════');
console.log('Robô da Jolô · o rascunho não chega ao cliente');
console.log(testes - falhas + ' de ' + testes + ' testes passaram');
console.log('════════════════════════════════════════════════════\n');
process.exit(falhas ? 1 : 0);
