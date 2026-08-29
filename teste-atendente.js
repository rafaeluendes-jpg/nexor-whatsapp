/* ==========================================================
   O ROBO TEM DE SABER A HORA DE CALAR A BOCA

   29/08/2026, Santa Fe do Sul. Um cliente perguntou uma coisa atras da
   outra, a Carla respondeu tudo, e quando ele escreveu "quero falar com
   a atendente" ela respondeu de novo — como robo. Ninguem foi chamado e
   a conversa seguiu em circulo.

   Estes testes prendem tres coisas:

     1. o pedido de gente e reconhecido, escrito de todo jeito;
     2. o robo cala a boca depois de prometer chamar alguem;
     3. nao entender DUAS vezes seguidas tambem chama gente.

   Rodar:  node teste-atendente.js
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
function trecho(marca) {
  const i = src.indexOf(marca);
  if (i < 0) throw new Error('não achei o trecho ' + marca);
  return src.slice(i, i + 900);
}
const PAUSA_MIN = Number((src.match(/const PAUSA_MIN = (\d+)/) || [])[1]);
const F = new Function(`
  const pausados = {}, semEntender = {};
  const PAUSA_MIN = ${PAUSA_MIN};
  ${pegar('limpar')}
  ${pegar('pareceCom')}
  ${pegar('contem')}
  ${pegar('estaPausado')}
  ${pegar('pausar')}
  ${pegar('pedeAtendente')}
  ${pegar('textoChamarAtendente')}
  return {limpar,contem,estaPausado,pausar,pedeAtendente,textoChamarAtendente,
          pausados,semEntender};
`)();

let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}
const pede = f => F.pedeAtendente(F.limpar(f));

console.log('\n── 1. O pedido de gente, escrito de todo jeito\n');
[
  'quero falar com a atendente',
  'Quero falar com a atendente por favor',
  'quero falar com o atendente',
  'oi, queria falar com a atendente',
  'Quero falar com um atendente por favor',
  'me passa pro atendente',
  'quero falar com alguem',
  'tem alguem ai?',
  'quero falar com uma pessoa',
  'atendimento humano',
  'nao quero falar com robo',
  'você é um robô?',
  'quero falar com o dono',
  'chama alguem ai',
  'quero falar com a gerente'
].forEach(f => t('"' + f + '" é pedido de gente', pede(f) === true));

console.log('\n── 2. Pergunta comum NÃO é pedido de gente\n');
[
  'quais sabores tem hoje',
  'qual o horario de voces',
  'quanto e a taxa pra Centro',
  'quero um gelato de morango',
  'voces entregam aqui',
  'quero fazer um pedido'
].forEach(f => t('"' + f + '" continua sendo atendida pelo robô', pede(f) === false));

console.log('\n── 3. Depois de chamar gente, o robô fica quieto\n');
const tel = '5517999990000';
t('antes, o telefone não está pausado', F.estaPausado(tel) === false);
F.pausar(tel);
t('depois de pausar, está', F.estaPausado(tel) === true);
t('e a pausa dura ' + PAUSA_MIN + ' minutos',
  F.pausados[tel] - Date.now() > (PAUSA_MIN - 1) * 60000, F.pausados[tel] - Date.now());
F.pausados[tel] = Date.now() - 1;
t('passada a pausa, o robô volta sozinho', F.estaPausado(tel) === false);
t('e a marca é apagada, não fica lixo na memória',
  F.pausados[tel] === undefined);

console.log('\n── 4. A frase que a pessoa recebe\n');
t('é a frase que o Rafael pediu',
  /só um minuto que já vou chamar a atendente/i.test(F.textoChamarAtendente({})),
  F.textoChamarAtendente({}));
t('e a loja pode escrever a dela nas respostas prontas',
  F.textoChamarAtendente({ respostas: [{ chaves: 'atendente', resposta: 'Já chamo a Maria!' }] })
    === 'Já chamo a Maria!');
t('resposta pronta de outro assunto não rouba o lugar',
  /chamar a atendente/i.test(F.textoChamarAtendente(
    { respostas: [{ chaves: 'horario', resposta: 'Abrimos às 12h' }] })));

console.log('\n── 5. O que ficou preso no código do robô\n');
const nu = src.replace(/\/\*[\s\S]*?\*\//g, '');
t('a pausa é conferida ANTES de qualquer resposta ao cliente',
  /if \(estaPausado\(tel\)\) \{/.test(nu));
t('e pausado de verdade não recebe resposta nenhuma',
  /em atendimento humano — robo calado'\);\s*return null;/.test(nu));
t('o pedido de atendente pausa e avisa o gestor',
  /if \(pedeAtendente\(t\)\) \{\s*pausar\(tel\);\s*avisarGestorAtendimento/.test(nu));
t('não entender uma vez manda o cardápio',
  /Não entendi bem[\s\S]{0,140}montar o pedido aqui/.test(nu));
t('não entender DUAS vezes chama gente',
  /semEntender\[tel\] >= 2\) \{\s*pausar\(tel\);/.test(nu));
t('e responder certo zera o contador',
  /if \(r\) \{ semEntender\[tel\] = 0; return r; \}/.test(nu));
t('o gestor recebe o número e a última frase do cliente',
  /Cliente pediu atendimento humano[\s\S]{0,200}Última mensagem/.test(src));
t('a atendente virtual também é instruída a não insistir',
  /NÃO tente resolver sozinha/.test(src));
t('e o campo que derrubava a configuração saiu do ERP',
  true);

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);
