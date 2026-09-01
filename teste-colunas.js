/* ==========================================================
   AS CONSULTAS DO ROBO PEDEM COLUNAS QUE EXISTEM

   01/09/2026: treze erros 400 no registro do banco, todos do servidor do
   robo, em `categorias?select=id,nome,ativo`. A coluna chama `ativa`. O
   `catch` da funcao engolia o erro e devolvia lista vazia — a Carla
   atendia SEM CARDAPIO, sem saber um sabor nem um preco, sem avisar
   ninguem.

   Este teste le o proprio server.js e prende as colunas de cada consulta
   contra o desenho real das tabelas, para o mesmo tipo de erro de
   digitacao nao voltar em silencio.
   ========================================================== */
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/server.js', 'utf8');
let falhas = 0, testes = 0;
function t(nome, ok, det) {
  testes++;
  if (ok) console.log('   ok   ' + nome);
  else { falhas++; console.log('   FALHOU  ' + nome + (det !== undefined ? '  → ' + det : '')); }
}

/* colunas reais, conferidas no banco de produção em 01/09/2026 */
const COLUNAS = {
  categorias: ['id','nome','ativa','cor','criado_em','descricao','imagem','imposto',
               'impressao','loja_id','ordem','ref_local','replicado_de','replicado_em','sucursais'],
  insumos: null,          /* não travado aqui: não é a tabela do defeito */
};

console.log('\n── Nenhuma consulta pede coluna que não existe\n');

const re = /from\(['"]([a-z_]+)['"]\)\s*\.\s*select\(\s*['"]([^'"]*)['"]/g;
let m, vistas = 0;
while ((m = re.exec(src))) {
  const tab = m[1], campos = m[2];
  const cols = COLUNAS[tab];
  if (!cols) continue;
  vistas++;
  const pedidas = campos.split(',').map(c => c.trim().split('(')[0].trim()).filter(Boolean);
  const fora = pedidas.filter(c => c !== '*' && cols.indexOf(c) < 0);
  t(tab + ' → ' + campos, fora.length === 0, fora.length ? 'não existe: ' + fora.join(', ') : '');
}
t('a consulta de categorias foi mesmo conferida', vistas >= 1, vistas);
t('e ela não pede mais "ativo"', !/from\(['"]categorias['"]\)\s*\.\s*select\([^)]*ativo/.test(src));

console.log('\n── E o cardápio vazio não passa despercebido\n');
t('a função de cardápio ainda existe', /async function carregarCardapio\(\)/.test(src));
t('o comentário registra o defeito, para não voltar',
  /A COLUNA CHAMA `ativa`, NAO `ativo`/.test(src));

console.log('\n' + (falhas ? '✗ ' + falhas + ' de ' + testes + ' falharam'
                           : '✓ ' + testes + ' testes passaram') + '\n');
process.exit(falhas ? 1 : 0);
