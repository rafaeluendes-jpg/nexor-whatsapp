# Nexor — decisões e combinados

Registro do que foi combinado com Rafael, para não se perder entre sessões.

## Relatórios (a construir)

**Toda tela de relatório precisa ter um ícone de informação no topo.**

- Fica discreto, não aparente — só um "?" ou "i" pequeno ao lado do título
- Ao clicar, abre um painel lateral ou balão explicando **como aquele relatório é calculado**
- O texto deve dizer: de onde vem cada número, quais tabelas alimentam, o que entra
  e o que fica de fora
- Objetivo: quando os sócios olharem o relatório, entenderem a origem do dado e
  confiarem no número

Exemplo do tipo de texto esperado:

> **Como calculamos o CMV**
> Somamos todas as saídas de estoque com motivo de venda no período, usando o custo
> médio de cada item no momento da baixa. Não entram perdas de produção nem ajustes
> de contagem — esses aparecem em Perdas.
> Fonte: movimentações de estoque + fichas técnicas.

## Permissões (a construir)

- Permissão **por sucursal**: o franqueador marca item a item o que cada loja enxerga
- O usuário herda o que a sucursal dele libera, e pode ser restringido ainda mais
- Estrutura já criada no banco: sucursais, usuarios, usuario_sucursais,
  sucursal_permissoes, usuario_permissoes, auditoria

## Regras de negócio já implementadas

- Sabores de gelato geram **Gelato Venda**; não existe estoque por sabor
- Massa de cascão gera **Cascão** com conversão "a receita inteira gera N unidades"
- Venda na frente de caixa nasce direto na fase **entregue**; só delivery passa pelo fluxo
- Motivo de movimentação precisa ser do **tipo Produzir** para gerar produto acabado
- Custo do destino = média ponderada do que foi realmente produzido

## Movimentação de estoque (V10.0.0 — mudança estrutural)

A tela **deixou de ser genérica e virou só baixa manual**. As quatro portas do estoque
ficaram assim, cada uma com o seu lugar:

| Movimento | Onde se faz |
|---|---|
| Entrada | Nota de entrada |
| Produção | Ordem de produção |
| Acerto de saldo | Contagem de estoque |
| **Baixa manual** | **Movimentação de estoque** |

Regras que passam a valer:

- O botão **+** só aceita motivo do **tipo Saída**. Motivos de Entrada e Produzir
  continuam existindo (o sistema e a produção usam), mas não aparecem mais nessa tela
- A **observação saiu do cabeçalho e passou para cada linha** — cada item baixado tem
  a sua própria justificativa. Lançamentos antigos continuam mostrando a observação
  do cabeçalho, sem quebrar
- O **custo não é mais digitado**: é sempre o custo médio ponderado do item, em campo
  de leitura. Trocar a unidade recalcula o custo e **não mexe na quantidade digitada**
- Baixar uma **ficha técnica** tira do estoque da própria ficha. Só a **produção**
  explode a ficha nos ingredientes da receita
- O seletor de itens só oferece o que realmente guarda estoque (insumo com controle
  ligado, ficha marcada como estocável)
- A busca do relatório filtra **a partir de 3 letras**, por nome, código, identificação
  ou observação da linha. Nome inteiro ou código continua travando no item exato
- A **linha do tempo do histórico** ganhou a coluna **Custo médio** e mostra a
  observação de cada linha

## Financeiro: banco e forma pertencem ao pagamento (V10.1.0)

- **Dar entrada num lançamento não pede banco nem forma de pagamento.** Só o dia do
  pagamento. Uma conta a pagar é uma obrigação; o banco só existe quando ela é paga
- **O joinha abre a confirmação de pagamento no meio da tela**, com banco, forma de
  pagamento e dia. Só depois de confirmar o lançamento fica pago
- Desmarcar o pago é direto, sem janela, e o banco fica guardado para a próxima vez
- Editar um lançamento **já pago** continua permitindo corrigir banco e forma
- A nota de entrada continua levando a conta pré-escolhida para os seus boletos
- Na **conciliação bancária**, editar não mostra mais receita/despesa — o tipo do
  movimento aparece fixo, porque o dinheiro já saiu ou entrou no banco
- Editar um lançamento que veio de **nota de entrada** mostra os **itens comprados**
  naquela nota: quantidade, valor unitário, desconto e total

## Estoque Total: totais do filtro e ordenação (V10.2.0)

- Acima da tabela ficou uma barra com **três números**: o valor em dinheiro do que o
  filtro pegou, o valor total do estoque inteiro, e quanto o filtro representa em %
- Sem filtro, a barra avisa que os dois valores são o mesmo. Com filtro, ela destaca
  o valor filtrado e oferece o botão de limpar
- O rodapé da tabela repete os dois totais quando há filtro
- **Todas as 8 colunas ordenam ao clicar** no título; clicar de novo inverte.
  Texto começa em A→Z, número começa do maior para o menor. A seta mostra o sentido
- Empate sempre desempata pelo nome, para a lista nunca "dançar" entre um clique e outro
- A **exportação passou a seguir o filtro e a ordem da tela**, e traz no fim as duas
  linhas de total (do filtro e do estoque inteiro)

## Perda de dados na sincronização — causa e correção (V10.3.0)

Rafael relatou que a cada atualização "some tudo". Foram encontradas quatro falhas
somadas, todas capazes de apagar dados sozinhas:

1. **A rede de proteção do download nunca foi ligada.** A função `volta(linhas,fn,atual)`
   tinha o terceiro parâmetro justamente para manter os dados locais quando a nuvem
   respondesse vazio — e nas 30 chamadas ninguém o passava. Nuvem vazia = coleção local
   zerada. **Correção:** a proteção agora é aplicada uma vez, no fim do download,
   comparando cada coleção com o estado anterior. Não depende mais de lembrar do argumento
2. **O download não era atômico.** `api()` lança erro; se a 12ª tabela falhasse, as 11
   primeiras já tinham sido substituídas. **Correção:** o download inteiro virou
   tudo-ou-nada. Se qualquer tabela falhar, todas as coleções voltam ao estado anterior
3. **O envio apagava na nuvem o que sumia no aparelho.** Depois de um download que zerou
   uma coleção, o próximo envio deletava essas linhas da nuvem — perda definitiva.
   **Correção:** travas em `apagarRemovidos` — nunca esvazia uma tabela inteira, nunca
   apaga mais de 60% de uma vez, e o `_snap` só é atualizado depois de apagar de verdade.
   Os botões de reinício chamam `autorizarEsvaziar()` para poder limpar de propósito
4. **Falha ao gravar no aparelho passava como um toast.** Memória do navegador cheia =
   gravação recusada em silêncio e o próximo F5 voltava ao estado antigo.
   **Correção:** aviso fixo e vermelho na tela, que só some quando a gravação volta

Além disso: **cópia local automática** antes de cada download (`nexor_respaldo`), com
botão de restaurar em Backup e Restauração.

## Atualização de versão

- `location.reload(true)` não força nada nos navegadores atuais — o arquivo antigo vinha
  do cache. Agora recarrega com endereço novo (`?v=timestamp`), que realmente troca
- Checagem a cada 45s (era 180s), na abertura e ao voltar para a aba

## Menu do topo: exigia dois cliques (V10.3.1)

`fecharDrop()` agendava `mnuBox.innerHTML=''` para 200ms depois, para dar tempo da
animação de saída. Como `toggleDrop()` chamava `fecharDrop()` e logo em seguida
desenhava o menu novo, essa limpeza atrasada apagava o menu recém-aberto. O menu
aparecia e sumia sozinho — daí a impressão de precisar clicar duas ou três vezes.

- Trocar de categoria não passa mais por `fecharDrop()`: troca o conteúdo direto
- A limpeza atrasada só executa se, passados os 200ms, nenhum outro menu tiver aberto
- Na troca, o menu aparece na hora, sem esperar o próximo quadro e sem escada de animação
- A escada de animação na abertura caiu de até 416ms para no máximo 150ms

## Baixa manual: sem escolher operação, sem identificação (V10.4.0)

- A tela inteira é baixa manual, então isso virou um **rótulo fixo**, não um campo.
  Não se escolhe mais "Saída manual" numa lista
- **Motivo da baixa** fica ao lado, alimentado pelos motivos do tipo Saída cadastrados
  em Configuração da Loja › Movimentação de Estoque. Já vem com o primeiro escolhido —
  o "Selecione uma opção" saiu
- Link **(cadastrar novo)** ao lado do motivo leva direto para a configuração
- O campo **Identificação** saiu da baixa. A coluna continua no relatório, porque venda,
  nota e ordem de produção preenchem ela sozinhas
- Na configuração, a coluna Saída passou a dizer que é ela que alimenta a baixa manual

## Onde se cadastra o motivo de baixa (V10.4.1)

O cadastro sempre esteve em **Configuração da Loja**, mas o item do menu se chamava
"Movimentação de Estoque" — o mesmo nome da tela de operação, no módulo Estoque.
Rafael achou que o cadastro estava dentro da movimentação. Era só o nome.

- O item passou a se chamar **Motivos de Baixa de Estoque**
- A coluna **Saída** vem primeiro e diz "estes são os seus"; Entrada e Produzir
  explicam que o sistema usa sozinho
- O atalho na baixa manual diz "(cadastrar em Configuração da Loja)"
- Cadastrar, renomear ou inativar ali reflete na baixa na hora seguinte — mesma lista

## Cadastro novo sumia depois de atualizar (V10.5.0)

A V10.3.0 fechou o caso "nuvem responde vazio". Faltava o irmão dele, que foi o que
apagou o motivo "Venda para franqueado":

1. O cadastro nasce no aparelho e fica marcado para enviar
2. O envio não chega a acontecer — ou falha numa tabela **anterior** na fila
3. `NUVEM.sujo` só existia na memória e nascia `false` a cada boot, então o download
   não era bloqueado
4. O download troca a lista inteira pela da nuvem, que ainda não tem o registro novo.
   Ele some, e some em silêncio

Correções:

- **`DB._enviados`** guarda, por coleção, o que a nuvem **confirmou** ter recebido.
  No download, todo registro local ausente da resposta e ausente dessa lista é
  devolvido: é novo, não é apagado. Quem já foi confirmado e sumiu da nuvem continua
  sendo exclusão de verdade, feita em outro aparelho
- **`DB._sujo`** grava a pendência de envio junto com os dados, então ela sobrevive a
  um F5 e o boot seguinte sabe que precisa subir antes de baixar
- **Envio que falha marca a pendência**, bloqueando o download por cima
- O que for segurado agenda o envio sozinho e fica registrado no log da nuvem

Na primeira sincronização depois desta versão, `_enviados` está vazio — de propósito.
Isso faz o sistema tratar tudo que está no aparelho como ainda-não-confirmado e
reenviar, em vez de deixar a nuvem apagar.

## Duas entradas diferentes: a do sistema e a da nuvem (V10.6.0)

Entrar no sistema como "franqueador" **não liga o aparelho na nuvem**. São duas coisas:

| Entrada | O que faz | Onde |
|---|---|---|
| Login do sistema | diz quem é você e o que pode ver | tela de entrada |
| Conexão da nuvem | liga o aparelho no banco de dados | ícone de nuvem › Banco de dados |

Sem a segunda, o aparelho grava só no navegador dele. Nada sobe, nada desce, e ninguém
da rede enxerga. Foi o que aconteceu com o sócio do Rafael: ele cadastrava motivos que
ficavam presos na máquina dele.

Isso aparecia apenas como "Salvo neste aparelho" em letra pequena no rodapé.

- Agora um **aviso vermelho fixo** ocupa o rodapé enquanto o aparelho estiver fora da
  nuvem, com botão "Ligar agora"
- Os três avisos (gravação, sincronização, nuvem) passaram a morar numa barra única e
  empilham, em vez de um cobrir o outro

### Verificado no banco (05/08)

- `motivos_movimentacao` **está** publicada para tempo real — a propagação funciona
- Existe **uma única loja** e **um único usuário de nuvem** (`rafael@nexor.app`)
- A RLS exige sessão autenticada (`minha_loja()` lê de `auth.uid()`), então sem a
  conexão da nuvem nenhuma tabela responde

### Pendente de decisão

Cada pessoa da rede precisa da própria conta de nuvem, ou o login do sistema deve
conectar sozinho usando uma credencial da rede. Hoje só existe a conta do Rafael.

## Um computador não via o outro (V10.7.0)

Os dois aparelhos estavam ligados na nuvem e na versão certa. A propagação dependia de
**um único mecanismo**: o aviso instantâneo por websocket (Supabase Realtime). Se ele
cai — wifi da loja, proxy, roteador, aba em segundo plano — não há erro, não há aviso:
o aparelho simplesmente fica olhando dados velhos por horas.

Conferido no banco (tudo certo do lado do servidor):

- as 36 tabelas do tempo real estão publicadas, com `REPLICA IDENTITY FULL`
- `motivos_movimentacao` está entre elas
- toda tabela do MAPA existe e tem índice único em `ref_local`, então o upsert funciona
- uma loja só, e a RLS exige sessão autenticada

Correções:

- **Conferência periódica a cada 45s**: com ou sem tempo real, o aparelho confere
  sozinho. Dois computadores convergem em menos de um minuto
- Só redesenha a tela se algo mudou de verdade (retrato por contagem + nomes dos
  cadastros pequenos), e nunca no meio de um lançamento ou com janela aberta
- Não consulta nada com a aba em segundo plano
- **Aviso quando o envio trava**: se há coisa pendente que não sobe, o aparelho também
  para de receber. Antes isso era silencioso; agora aparece na barra de avisos
- O rodapé passou a dizer se o tempo real está de pé e a hora da última sincronização

### Tabelas fora do tempo real (propagam só na conferência de 45s)

`cardapio_config`, `clientes_nexor`, `compras_sem_vinculo`, `ordens_producao`,
`sucursais`, `usuarios_sistema`

## Virada de chave da sincronização (V11.0.0)

Três defeitos estruturais, não três sintomas:

### 1. O envio mandava o banco inteiro a cada mudança

Qualquer `salvar()` reenviava todas as 41 tabelas, todas as linhas, e — nas tabelas com
filhos — **uma chamada de rede por pai**. Com milhares de pedidos e movimentações, o
envio demorava, competia consigo mesmo e era interrompido por qualquer F5.

**Agora é incremental.** Cada registro tem uma impressão (`DB._hash`) que inclui os
filhos. Só sobe o que mudou desde o último envio confirmado; o resto é pulado, inclusive
o laço dos filhos e dos vínculos. O identificador que a nuvem deu a cada registro fica
guardado em `DB._uuid`, então pular não quebra o vínculo pai-filho. O que falha não
tem a impressão gravada e é reenviado na tentativa seguinte.

### 2. A trava de exclusão existia mas nunca era conferida

`NUVEM.baixou` era definida com o comentário "daqui em diante este aparelho pode
espelhar exclusões" — e **nunca lida em lugar nenhum**. Um aparelho recém-aberto, com
cópia velha, podia apagar na nuvem o que o outro tinha acabado de criar.
Agora `apagarRemovidos` recusa enquanto o aparelho não tiver baixado na sessão.

### 3. A propagação dependia só do websocket

Ver V10.7.0. Agora há três camadas: aviso instantâneo, **contador de versão a cada 6s**
e conferência completa a cada 45s.

### Contador de versão (no banco)

Tabela `loja_versao` com uma linha por loja e 41 gatilhos que incrementam o número a
cada gravação. O aparelho lê **uma linha** de 6 em 6 segundos; só baixa o banco quando
o número mudou. Custo desprezível, convergência em segundos.

## Busca e ordenação em toda tabela (V11.1.0)

Em vez de mexer nas dezenas de telas uma a uma, o sistema **observa o que foi desenhado
e liga busca e ordenação sozinho**. Toda tela nova nasce com isso funcionando, e não há
o risco de esquecer uma.

- Campo de busca acima de qualquer tabela com 6+ linhas: filtra a partir de **3 letras**,
  olhando a linha inteira, e mostra "X de Y"
- Todo cabeçalho vira clicável. Coluna de texto começa A→Z; coluna de número começa da
  maior para a menor. Clicar de novo inverte. Empate mantém a ordem original
- O tipo é detectado pelo conteúdo: "1.200 g" ordena como 1200, não como texto
- Tabelas com linha de subtotal (célula juntada) **não** são reordenadas, para não
  misturar os grupos
- Telas com busca/ordenação própria (Estoque Total, Movimentação) são reconhecidas e
  não recebem outra por cima. Para excluir uma tabela, basta a classe `semBusca`

## Mapa do Sistema

`Configuração da Loja › Mapa do Sistema` (era "Dados da Loja", que era um placeholder).
Lista todas as telas do plano, módulo por módulo:

- **Bolinha verde** = pronto · **bolinha vermelha** = a construir
- Dentro de cada módulo, os prontos vêm primeiro e os pendentes no fim
- Resumo no topo: quantas prontas, quantas faltam, % concluído
- A lista sai de `AFAZER`, então se mantém correta sozinha conforme as telas ficam prontas

## Janela do navegador substituída (V11.2.0)

`alert()` mostra uma caixa cinza com o endereço do site em cima — muda de cara em cada
navegador e não parece parte do sistema. Agora `window.alert` é substituído por `aviso()`,
que usa a mesma caixa das outras janelas do Nexor, no meio da tela. A primeira linha da
mensagem vira o título; o resto fica no corpo, preservando as quebras de linha. Fecha no
botão, no Escape, no Enter ou clicando fora.

Como a substituição é no `window.alert`, **toda tela do sistema passou a usar a janela
própria** — inclusive as que ainda não foram escritas.

## Ficha técnica

- **Subgrupo** e **Grupo de conta** saíram do cadastro. O que já estava gravado nesses
  campos é preservado ao editar; a tela só não pergunta mais
- Na composição, **Preço** e **Margem** viraram **Preço do kg** = custo total ÷ rendimento.
  A margem mostrava −100% enquanto não houvesse preço de venda, o que era só ruído.
  O preço de venda gravado continua intacto

## Uma tabela com problema paralisava as outras 40 (V11.3.0)

Diagnóstico no banco: `fichas_tecnicas` tinha **1 registro no aparelho e 0 na nuvem**.
Como o envio era uma fila única dentro de um `try` só, o primeiro registro recusado pelo
banco abortava tudo — as 40 tabelas seguintes nunca subiam, e o aparelho ficava
"travado" sem dizer onde. Schema, índices e RLS estavam corretos; era um dado.

- Cada tabela passou a subir **por conta própria**. Uma falhando, as outras continuam
- O aviso agora **nomeia a tabela e mostra a mensagem que o banco devolveu**
- O aparelho deixa de ficar travado: o download volta a funcionar, porque o que ainda
  não foi confirmado já está protegido por `_enviados`

## Sem estoque, sem custo

`custoDoItem` devolve **0 quando o saldo é zero ou negativo**. Custo médio é o preço do
que está dentro do estoque; sem nada dentro, não há custo. Ele volta a existir na
próxima entrada, que é quem forma o preço. Itens que não controlam estoque mantêm o
custo. O preço da **última compra** continua aparecendo — é histórico, não saldo.

## Códigos: numeração única, em ordem alfabética

- **Ingrediente e ficha dividem a mesma numeração** — é a mesma lista do estoque
- Botão **Renumerar códigos** no Estoque Total: dá 1, 2, 3... na ordem alfabética
- Cadastro novo pega **o próximo número livre**, sem renumerar os existentes. Inserir
  alfabeticamente empurraria milhares de códigos a cada cadastro e quebraria etiqueta,
  planilha e nota fiscal

## De onde vinham os códigos 700002 (V11.4.0)

Havia **dois contadores separados**: o de ingrediente começava em 700000 e o de ficha
em 1, para não colidirem. Era a única razão do número grande — e ela deixou de existir
quando as duas listas passaram a dividir a mesma numeração.

O acerto agora **roda sozinho, uma vez**, na primeira vez que uma tela de estoque abre
(`arrumarCodigos()`, marcado por `DB._codOk`). Não fica renumerando a cada tela. O botão
**Renumerar códigos** continua no Estoque Total para reorganizar depois de um lote de
cadastros.

## Colunas que faltavam no banco (V11.5.0)

A mensagem "Could not find the 'cfg_dre' column of 'config_loja'" era literal: o cliente
mandava campos que **não existiam no banco**. Comparei, campo a campo, o que cada tabela
do MAPA envia com as colunas reais. Faltavam quatro:

| Tabela | Coluna |
|---|---|
| `config_loja` | `cfg_dre`, `cfg_pdv` |
| `lancamentos_financeiros` | `cancelado` |
| `compras_sem_vinculo` | `itens` |

Criadas. A mensagem culpava `lancamentos_financeiros` porque `etapa` ficava na última
tabela do laço e o bloco de `config_loja` rodava fora dele — agora esse bloco também é
isolado e nomeia a si mesmo.

### Falha isolada x falha sistêmica

Uma ou duas tabelas com problema de dado não paralisam o aparelho. Mas se metade delas
falhar (ou 3+), é rede ou credencial caindo — aí a pendência continua marcada e nada é
baixado por cima.

## Juros e multa no pagamento

- Campos de **Juros** e **Multa** na confirmação de pagamento, com o total recalculado ao vivo
- Ao confirmar, o **valor do lançamento passa a ser o que realmente saiu da conta**, e o
  valor de antes fica em `valorOriginal`. Assim fluxo de caixa, DRE e conciliação batem
  com o extrato, sem precisar mexer em cada relatório
- Zerar os juros devolve o valor original — não acumula a cada pagamento
- Em pagamento de vários lançamentos os campos não aparecem: juros são de cada conta

## "All object keys must match" (V11.6.0)

O banco exige que **todos os registros de um envio tenham exatamente as mesmas chaves**.
Alguns mapeamentos escreviam `fk(...)||undefined` para um vínculo inexistente — e um
campo `undefined` simplesmente some do registro. Um grupo com destino subia com 3 chaves,
outro sem destino com 2, e o lote inteiro era recusado.

- `igualarChaves()` no `enviar()` **iguala todo lote antes de subir**: quem não tem o
  campo sobe com ele em branco. Vale para as 41 tabelas, inclusive as futuras
- Os dois mapeamentos que usavam `||undefined` passaram a usar `||null`

## Do boleto para a nota

No lançamento vindo de nota de entrada, o cabeçalho do bloco de itens virou **link**:
clicar abre a nota de entrada que gerou aquele boleto. Se a nota tiver sido apagada,
avisa em vez de quebrar.

O link "(cadastrar novo)" do Fornecedor saiu — não sobrou nenhum atalho de cadastro
dentro das telas de lançamento.

## Valor do boleto x valor pago (V11.7.0)

Dois números diferentes que não podem ser confundidos: o que foi combinado com o
fornecedor e o que realmente saiu da conta.

- Lista de lançamentos: **duas colunas** — "Valor do boleto" (discreto) e "Valor pago"
  (em destaque, com a cor do tipo). Quando houve encargo, uma linha embaixo mostra
  "+ R$ 20,00 juros/multa". Conta não paga mostra "em aberto"
- Conciliação bancária usa **exatamente as mesmas duas colunas** do lançamento
  financeiro: "Valor do boleto" e "Valor pago". O saldo acumulado segue o valor pago,
  que é o que aparece no extrato (V11.8.1)
- Exportação: colunas separadas de boleto, juros, multa e valor pago
- Helpers: `valorBoleto(l)`, `encargos(l)`, `valorPago(l)`

## Nova tela de acesso (V11.8.0)

Refeita conforme o desenho: painel da marca à esquerda, cartão de acesso à direita com
selo NEXOR ACCESS, indicador de sistema disponível, campos com ícone, "Manter conectado",
"Esqueci minha senha" e o rodapé de segurança. Os identificadores antigos (`lgC`, `lgU`,
`lgP`, `lgE`, `lgB`, `tg`) foram mantidos, então toda a lógica de entrada continua a mesma.

**Manter conectado** funciona de verdade:
- ligado → sessão em `localStorage`, o aparelho volta direto
- desligado → sessão em `sessionStorage`, vale só enquanto a aba estiver aberta
- a escolha fica lembrada em `nexor_manter`; `sair()` limpa os dois lugares

## A nota abre por cima do lançamento

`abrirNotaDoLanc` deixou de navegar para Notas de Entrada. A nota se desenha na própria
camada `mdOv`, então o lançamento é renomeado por um instante, a nota nasce separada e
vira `mdOv2` acima dele. O nó é clonado para descartar o clique-fora herdado (que
fecharia o lançamento de trás), os botões de fechar passam a chamar `fecharNotaSobre()`
e o "Excluir nota" é retirado — ali a nota é consulta.

## O bloco da nota não aparecia (V11.9.0)

O vínculo do lançamento com a nota (`l.ref`) **nunca era enviado nem baixado** — não
havia coluna para ele. A nota era criada, o vínculo existia no aparelho, e a primeira
sincronização o apagava. Sem `ref`, o bloco simplesmente não renderizava.

- Coluna `origem_ref` criada em `lancamentos_financeiros`; `l.ref` sobe e volta
- `notaDoLanc(l)` acha a nota por **três caminhos**: pelo `ref`, pela lista `lancIds`
  guardada na nota, e por nº do documento + fornecedor. Ao achar, **religa o `ref`**,
  então lançamentos antigos se consertam sozinhos ao serem abertos
- O mesmo `ref` é usado pelo fechamento de caixa, que também deixa de perder o vínculo

## Nenhuma janela do navegador sobrou (V11.10.0)

A V11.2.0 trocou o `alert`. Faltava o `confirm`, que estava em **38 lugares** — e ele
não dá para substituir por cima, porque o do navegador devolve o resultado na hora e o
do Nexor precisa esperar a resposta.

- `pergunta(msg, ok, tipo)` — mesma caixa do aviso, com dois botões. O tipo é deduzido
  do texto: excluir/apagar/remover/limpar/sair abrem em vermelho
- 35 funções viraram `async` e passaram a usar `await pergunta(...)`
- As 3 restantes eram validações dentro de janelas, que devolvem `false` para impedir o
  fechamento. Para elas, `modal()` passou a **esperar validação assíncrona**:
  `if(f && typeof f.then==='function') f = await f`. Isso vale para qualquer janela do
  sistema daqui em diante
- O recibo do entregador, que perguntava depois de gravar, virou `.then()` — não precisa
  segurar o retorno da janela

Nenhuma chamada ao `confirm` do navegador restou no arquivo.

## Identidade oficial (V12.0.0)

Rafael enviou o arquivo `Nexor_Login_Funcional.html` com a tela oficial e a arte da marca.

- As duas imagens embutidas foram extraídas para arquivos do repositório:
  **`nexor-marca.png`** (painel da esquerda) e **`nexor-n.png`** (símbolo)
- O estilo do arquivo foi portado **inteiro**, com cada seletor preso a `#login` e as
  variáveis renomeadas com prefixo `nx-`, para não vazar no resto do sistema
- A marcação também é a do arquivo; só os identificadores dos campos viraram os do
  sistema (`lgC`, `lgU`, `lgP`, `lgK`, `lgB`, `lgE`, `tg`), então `entrar()` não mudou
- O `<form>` virou `<div>`: o sistema já trata Enter e o clique do botão
- **Cabe em uma tela só**: dois pontos de ajuste (900px e 760px de altura) encolhem
  cartão, campos e botão em vez de deixar rolar
- As mensagens de erro passaram a usar o estilo `.feedback` do arquivo (`lgAviso()`)
- O símbolo `nexor-n.png` substituiu o "N" desenhado no topo do sistema

## Ícone do sistema (V12.1.0)

O sistema **não declarava ícone nenhum** — por isso, ao salvar ou instalar no computador,
o navegador inventava um símbolo genérico.

- `nexor-icone.png` (512), `nexor-icone-192.png` e `nexor-n.png` (64) gerados a partir do
  símbolo oficial, recortados no quadrado central
- `<link rel="icon">` em dois tamanhos, `apple-touch-icon` e **`manifest.json`** — é o
  manifesto que dá o ícone e o nome corretos ao instalar no computador ou no celular.
  Inclui o ícone `maskable`, que o Android usa sem cortar em quadrado
- `theme-color` da marca na barra do navegador
- O "N" desenhado saiu dos três lugares que ainda o usavam: topo do sistema, marca da
  tela inicial e ícone na lista de aplicativos

## Tela de acesso sem rolagem (V12.1.1)

A causa da barra horizontal não estava no estilo novo: a regra **antiga** do `#login`
sobreviveu no arquivo — `display:flex; padding:16px; min-height:100dvh` — e transformava
a grade num item flex com folga, estourando a largura. Removida.

- `minmax(560px, 41.75fr)` virou `minmax(0, 41.75fr)`: a coluna direita pode encolher
- `100dvh` virou `height:100%` nos três painéis (o `dvh` somava com a barra do navegador)
- O cartão deixou de rolar por dentro (`overflow:visible`) e o painel centraliza
- Abaixo de 980px de largura, a marca sai e fica só o acesso
- Título de 43px para 31px no máximo; campos de 68px para 54px; espaçamento entre campos
  reduzido — as informações ficaram compactas sem perder a estética
- **"Sistema disponível" removido**

## Tela de acesso sem rolagem (V12.2.0)

O arquivo oficial foi desenhado para telas grandes: botão de 72px, campos de 54px,
cabeçalho de 58px. Num notebook comum isso estourava a altura e aparecia barra de
rolagem — e a regra `minmax(560px, ...)` do arquivo forçava largura mínima, gerando
barra horizontal também.

- Compactação por `clamp()`: cabeçalho, cartão, título, campos e botão encolhem com a
  tela em vez de transbordar. Dois pontos extras em 1100px e 980px de largura, e um em
  700px de altura
- `overflow:hidden` na estrutura; só o cartão rola, e apenas em tela muito baixa, com a
  barra escondida
- `body.semRolagem` enquanto a entrada está aberta: a página não rola por baixo
- O bloco **"Sistema disponível"** saiu — era informação que não ajuda quem vai entrar
- Os ajustes precisaram entrar nas **duas** folhas de estilo, senão a segunda cópia das
  regras originais sobrescrevia a compactação

## Proporção da tela de acesso (V12.3.0)

O desenho original enche a coluna da direita. Quando a marca sai da tela, essa coluna
vira a tela inteira e o cartão estica junto: campos larguíssimos para 46px de altura,
texto perdido no meio do branco. Parecia formulário de celular esticado.

- **Coluna de leitura com largura máxima** (`--nx-col: min(432px,100%)`), centralizada,
  valendo para o cabeçalho e o cartão. É a correção que resolve a desproporção
- A marca só some abaixo de **820px** (era 980), então na maioria das janelas ela aparece
- Ritmo vertical apertado: rótulo colado no campo, campos de 46px, título 25px,
  botão 50px, selo e lista de segurança proporcionais

Os ajustes vão nas **duas** folhas de estilo — a segunda cópia das regras originais
desfaria a primeira.

## Design System Nexor — base (V13.0.0)

Primeira etapa do redesenho. **Nenhuma função, rota, permissão ou regra foi tocada.**

### Tokens

O sistema já lia tudo de variáveis CSS — bastou realinhá-las com a paleta da marca para
todas as telas mudarem ao mesmo tempo. Descoberta importante: havia **três blocos
`:root`**, e o segundo reafinava as cores por cima do primeiro. Era ele que valia. Os
dois primeiros agora falam a mesma língua.

| Token | Valor |
|---|---|
| `--deep` | `#0B2B3B` azul-marinho |
| `--acc-d` | `#0E7475` verde-petróleo (ação principal) |
| `--acc` | `#159A9C` teal (destaque) |
| `--bg` | `#F3F7F8` · `--line` `#D6E1E4` |
| `--ink` / `--ink-2` | `#17262F` / `#667780` |
| `--ok` / `--amber` / `--red` | `#238A63` / `#C88A27` / `#C94B4B` |
| `--r` / `--r-s` | 8px / 6px · `--t` 170ms |

### Componentes globais

Raio limitado a 8px (6px em botões e campos), botões de 36px com hierarquia
petróleo/branco/vermelho, foco em teal com anel de 3px, tabelas com cabeçalho fixo,
zebra sutil e destaque no hover, sombras quase imperceptíveis, rolagem fina de 9px.

### Configuração do PDV

`repeat(auto-fit, ...)` fazia um item sozinho ocupar a coluna inteira e esticar a
miniatura. Trocado por `auto-fill` com `aspect-ratio`, e as colunas ganharam largura
mínima de 320px para não espremer.

### Pendente

Menu lateral agrupado e recolhível, barra superior com busca global e trilha, dashboard
como central de controle, e a varredura tela a tela.

## Estoque Total mais enxuto (V13.1.0)

A barra de três cartões abaixo dos filtros saiu inteira. O valor do filtro subiu para a
fileira de números do topo, ao lado do valor total do estoque, com destaque em teal e a
contagem "x de y itens" embaixo. Ele **só aparece quando há filtro** — sem filtro seria
o mesmo número duas vezes.

Os outros dois cartões ("Valor total do estoque" e "O filtro representa") foram
removidos: o primeiro repetia o do topo, o segundo era informação que ninguém usava.

A tabela também ganhou a classe `semBusca`: ela já tem busca e ordenação próprias, e
estava recebendo a busca automática por cima, duplicando o campo.

## A ficha que "sumiu" (V13.2.0)

Conferido no banco: **as 12 fichas estão lá**, inclusive a "BELGA GELATO" com os 2 itens.
Nada foi perdido. O que aconteceu foi pior de diagnosticar: ela ficou com
`grupo_id = null` e a tela de ficha técnica **só desenha por grupo** — então ela existia
e não aparecia em lugar nenhum.

Causa: no envio, `fk('fichaCats', categoriaId)` não resolveu o vínculo e gravou `null`
em silêncio. Com o envio incremental, a impressão do registro foi dada como boa e ele
nunca mais foi reenviado — o `null` virou permanente.

Duas correções estruturais:

- **Nenhum registro pode ficar invisível.** A árvore ganhou a pasta **Sem grupo**, com
  contagem em âmbar, que aparece só quando existe ficha órfã. O que estiver lá pode ser
  visto, aberto e corrigido
- **Vínculo que não resolve não passa batido.** `fk()` anota a falha, o log da nuvem
  registra qual vínculo faltou, e a impressão do registro **não é gravada** — ele volta
  a subir na próxima sincronização, quando o vínculo já existir

## Por que a ficha "mudava de lugar" (V13.3.0)

Rafael foi preciso: ela **estava no lugar certo** e se perdeu ao atualizar. O mecanismo:

1. O vínculo com o grupo subiu vazio por uma falha momentânea de resolução
2. O download seguinte trouxe esse vazio e **apagou o grupo correto que ainda estava
   no aparelho** — o dado bom foi destruído pelo dado ruim

**Terceira rede de proteção:** no download, **vínculo cheio ganha de vínculo vazio**.
Se a nuvem traz um vínculo em branco e o registro local tem um, o local é mantido e o
sistema agenda o reenvio para corrigir a nuvem. Se a nuvem traz um vínculo **diferente**,
ela manda — a troca feita em outro aparelho continua valendo.

Vale para 13 campos de ligação: categoria, subgrupo, grupo, conta, destino, fornecedor,
forma de pagamento, conta destino, cliente, entregador, origem, caixa e motivo.

## Paleta creme, verde, dourado e azul (V14.0.0)

Só as cores mudaram — estrutura, telas e funções ficaram idênticas. **Quatro cores,
quatro trabalhos, e ninguém usa cor por decoração:**

| Cor | Token | Trabalho |
|---|---|---|
| Verde profundo `#1E4634` | `--deep` | identidade e navegação (barras do sistema) |
| Dourado `#8A6A32` | `--acc-d` | a ação principal |
| Azul petróleo `#1C6E97` | `--blue` | o que se clica e o que informa |
| Terracota `#9A4A3C` | `--red` | o que exige atenção |

Fundo creme `#FAF6EF` na área de trabalho, branco no conteúdo, bordas `#EAE4D9`.

- O rodapé virou verde, fechando a tela como aplicativo em vez de página que rola
- A faixa de módulos ficou branca, sem degradê
- Azul entrou onde faltava cor com função: link, linha sob o mouse, linha selecionada,
  ícone de aviso informativo

A quinta cor é o limite: se aparecer uma sexta sem trabalho definido, a regra quebra.

## "Evitou apagar 18 de 24 de cardapio_config" (V14.0.1)

A trava funcionou, mas o motivo era um defeito: `DB.cardapioL` é um **espelho derivado**
de `DB.cardapio`, gerado no envio com id `cc_<sucursal>`. O download sobrescrevia esse
espelho com as **linhas cruas da nuvem**, cujo id é o uuid do banco. No envio seguinte,
nenhum id batia e o sistema concluía que tudo tinha sido excluído.

- O download **não toca mais** no espelho — ele é derivado, não vem da nuvem
- Regra geral em `apagarRemovidos`: **zero identificadores em comum entre o antes e o
  agora é troca de formato, não exclusão**. A lista nova é adotada sem apagar nada
- `arrumarEspelhoCardapio()` zera uma vez a marca antiga, que estava com os dois
  formatos misturados

## O Mapa do Sistema mentia (V14.1.0)

Rafael abriu Usuários e Permissões e a tela estava lá — mas o Mapa marcava como
pendente. O mapa lia de `AFAZER`, uma **lista escrita à mão** que envelhece toda vez que
uma tela é construída e ninguém lembra de tirar da lista.

`telaPronta(mid,iid)` agora **pergunta ao roteador**: lê o código de `abrir()` e monta a
relação de telas que ele sabe abrir. Se o roteador atende, está pronta — a lista à mão
vira só o texto explicativo do que ainda falta. O mapa não pode mais mentir.

Duas entradas saíram da lista por já existirem: **Usuários e Permissões** e
**Canais de Venda e Integração**. Restam **7 pendentes**.

## Nova tela de acesso e grupos com editar/excluir visíveis (V15.0.0)

- Tela de acesso trocada pelo arquivo `Nexor_Login.html`. As três imagens viraram
  arquivos (`nexor-logo-h.png` e `nexor-marca-lado.png`), o estilo foi preso a `#login`
  e as variáveis ganharam prefixo `lg-`. Os identificadores dos campos continuam os do
  sistema, então `entrar()` não mudou
- O campo **Cliente** virou digitação, não lista fixa: o sistema compara com a rede
  cadastrada na loja, e uma lista com opções fixas travaria o acesso de outras redes
- Restos da tela anterior (marcação e estilo, nas duas folhas) foram removidos
- Na ficha técnica, **editar e excluir grupo já existiam, mas só apareciam ao passar o
  mouse** — ninguém encontrava. Agora ficam visíveis, com opacidade reduzida, e cheios
  ao passar o mouse ou no grupo ativo

## O aviso da leitura da nuvem passou a dizer onde parou (V15.1.0)

O aviso de download interrompido era genérico — "tente de novo quando a internet
estabilizar" — e não dava como diagnosticar nada. Agora:

- `api()` carrega no erro **a tabela** e o status, e distingue **queda de rede**
  (o `fetch` falha) de **erro do banco** (resposta com status ruim)
- Queda de rede: **tenta de novo sozinho** depois de 900ms antes de reclamar, e o texto
  fala de internet
- Erro do banco: o aviso nomeia a tabela e repete a mensagem exata do banco, e pede que
  seja enviada — é ela que resolve em minutos. Não há repetição automática, porque erro
  de dado não melhora tentando de novo

## Categoria financeira separada por tipo (V16.0.0)

Categoria de receita e de despesa não se misturam mais.

- Coluna `tipo` em `categorias_financeiras`; categorias antigas entram como **despesa**
  e não somem
- A tela virou **duas colunas** — Receita em verde, Despesa — cada uma com o seu botão
  "Cadastrar receita" / "Cadastrar despesa". O tipo é fixo depois de criado
- O lançamento **só oferece as categorias do tipo que está sendo lançado**, e trocar
  receita/despesa descarta a categoria escolhida se ela for do outro lado
- Compras sem Vínculo ganhou largura máxima e centralização — estava colado na borda

### Ainda pendente deste pedido

- Relatório de entradas (só existe o de despesas)
- Melhoria visual do cadastro de contas de banco

## Contas bancárias: lista e cadastro (V16.1.0)

**A lista** era um cartão grande por conta, com botões escritos. Com três contas já
rolava a tela. Virou **uma lista**: selo do banco, nome com agência e conta embaixo,
saldo à direita, ações como ícone. Rodapé com contagem e total. Os cartões de indicador
saíram do meio da tela — o saldo total subiu para o cabeçalho.

**O cadastro** tinha uma grade de 14 botões grandes de banco que ocupava mais espaço que
o formulário inteiro. Virou **pastilha**, com os 5 mais usados à mostra e "+ 9 bancos"
sob demanda. Se a conta editada usa um banco fora dos 5, ele entra na frente.

Campos reordenados: **Nome e Saldo inicial** na primeira linha (o saldo estava espremido
entre agência e conta, sendo o campo que mais importa), agência e conta na segunda, como
opcionais. A explicação do saldo virou caixa de informação azul.

## Ordem dos relatórios (definida por Rafael)

1. Faturamento por Dia
2. Itens Consumidos
3. Itens Vendidos
4. Vendas por Área de Entrega
5. Vendas por Forma de Pagamento
6. Vendas por Período
7. Relatório CMV
8. DRE
9. Cupons

Removido: "Vendas Geradas" (redundante).

## Dashboard

- Canais de Venda
- Faturamento
- Venda por Data e Hora
- **Comparativo Anual** (novo)

Removido: "Acompanhamento de Venda".

## Pendências

- [ ] Gestão de Relatórios (com a explicação de cada um)
- [ ] Gestão e Dashboard
- [ ] Configuração da Loja: sucursais, usuários, permissões
- [ ] Cardápio digital
- [ ] Robô do WhatsApp
- [ ] Integração fiscal (via empresa contratada)
- [ ] Integração iFood (após homologação como parceiro)

## Totem de autoatendimento (avaliado, a construir depois)

O cardápio digital já é a maior parte do que um totem precisa. A diferença:
tela cheia, sem escolher loja, botões maiores, volta ao início sozinho.

**Duas versões possíveis:**

1. **Sem pagamento no totem** (recomendado para começar) — o cliente monta o
   pedido, sai uma senha, ele paga no caixa. Elimina a fila de escolher.
   Dá para testar num tablet de ~R$ 1.500 antes de comprar totem.

2. **Com pagamento** — exige integração TEF com a adquirente e um programa
   instalado na máquina. É a parte cara e demorada.

**Ordem sugerida:** depois de usuários e permissões.

## Chave do robô: fechada dos dois lados (V17.3.0)

O robô do WhatsApp estava **aberto**. A exigência de chave dependia da variável
`EXIGIR_CHAVE=sim` no Render, que nunca foi ligada — então `protege` deixava tudo
passar. Quem descobrisse o endereço do Render conseguia mandar mensagem pelo WhatsApp
das lojas e derrubar as conexões. E a chave que o sistema enviava (`NexorZap2026`)
estava escrita dentro do `index.html`, num repositório público.

**No robô (`server.js`):**

- A chave passou a ser exigida **sempre que existir chave configurada**. Só fica aberto
  quem não configurou nenhuma — e agora isso aparece no log da inicialização
- `CORS` deixou de aceitar qualquer origem: só os domínios do Nexor e `localhost`
- `/diagnostico`, `/envios` e `/testeia` estavam **sem proteção**. `/diagnostico`
  mostrava os números conectados e os nomes das variáveis de ambiente; `/envios` listava
  telefones de clientes. Os três passaram por `protege`, e a lista de variáveis saiu
  da resposta
- Freio de **20 envios por minuto por loja**, porque o WhatsApp bane número que dispara
  em rajada

**No sistema (`index.html`):**

- `ZAP_KEY` saiu do código. A chave é digitada **uma vez por aparelho** e guardada
  em `localStorage` — não sobe para a nuvem e não viaja com o sistema. Cada computador
  que for comandar o robô precisa digitar
- Campo novo em Robô do WhatsApp › Conexão, com guardar e apagar
- `zapApi()` agora distingue **falta de chave**, **chave recusada** (401) e
  **limite de envio** (429), cada um com o seu recado
- `desconectarZap()` e `desconectarZapPdv()` eram as duas únicas chamadas sem
  `try/catch` — passariam a quebrar sozinhas agora que a função pode recusar

**O que continua valendo:** o Nexor roda no navegador, então a chave é visível para
quem já está logado e abre as ferramentas do navegador. Isso protege contra quem está
de fora, não contra quem já tem acesso ao sistema. A proteção completa exige passar as
chamadas por uma função no Supabase — fica para depois.

## Próxima obra: ligar o login no Supabase Auth (mapa levantado em 07/08)

Levantamento feito direto no banco. Corrige duas crenças antigas que estavam erradas:

- **O RLS não está desligado.** Está ligado nas 61 tabelas, e a arquitetura certa **já existe**:
  tabela `perfis` ligada a `auth.uid()`, e as funções `minha_loja()`, `minha_empresa()` e
  `sou_admin()`. 29 tabelas usam a regra
  `loja_id = minha_loja() OR (sou_admin() AND loja da minha empresa)`
- **A chave do Supabase no `index.html` não é vazamento.** É a `publishable`, pública por
  desenho. O que a torna inofensiva é o RLS — que está lá

**O que falta é a ligação.** O sistema ainda faz login comparando senha em texto puro na
tabela `usuarios`. Como ninguém entra pelo Auth, `auth.uid()` fica vazio e as regras das
29 tabelas não têm em quem se apoiar.

### Buracos concretos

| Tabela | Aberto para | Gravidade |
|---|---|---|
| `whatsapp_config` | leitura e escrita por qualquer um | alta |
| `whatsapp_mensagens` | leitura e escrita — 70 conversas de cliente | **alta** |
| `whatsapp_sessoes` | leitura e escrita | alta |
| `pedidos`, `app_usuarios` | leitura | média |
| `produtos`, `categorias`, `areas_entrega`, `areas_zonas`, `formas_pagamento`, `grupos_opcoes`, `opcoes`, `sucursais` | leitura | proposital — o cardápio digital lê sem login |

As três do WhatsApp não precisam de acesso pelo navegador: quem escreve nelas é o robô,
pelo servidor. Fechar é seguro.

### Ordem

1. Criar o usuário do Rafael no Supabase Auth + linha em `perfis` com `cargo='admin'`
2. Trocar `entrar()` para autenticar no Auth; `api()` passa a levar o token da sessão
3. Fechar `whatsapp_config`, `whatsapp_mensagens`, `whatsapp_sessoes`
4. Tirar `pedidos` e `app_usuarios` da leitura pública
5. Criação de usuário por Edge Function (a chave de administrador **não pode** ir para o
   navegador — senão qualquer cliente vira admin de todas as redes)
6. Chave do robô por cliente, guardada no servidor, via Edge Function. Remover o campo de
   digitar chave criado na V17.3.0

### O que NÃO se perde

Insumos (326), fichas (12 + 4.391 itens), fornecedores (53), sucursais (6) e toda a
configuração continuam. Só os 7 usuários são recriados — começando pelo do Rafael, e os
demais pela própria tela depois.

### Risco a vigiar

Se o token não for junto nas chamadas, as telas abrem **vazias**. Não é perda de dado, é
o banco recusando. Testar tela por tela depois do passo 2, antes de seguir.

## Vazamento entre redes: cinco tabelas fechadas (07/08)

O levantamento da véspera apontou três tabelas do WhatsApp abertas ao público. Conferindo
política por política no `pg_policies`, apareceram **outras cinco**, de gravidade maior,
que ninguém tinha visto: `usuarios_sistema`, `app_usuarios`, `pedidos_online`,
`whatsapp_gestores` e `whatsapp_pendentes` estavam com `ALL / true` para **authenticated**.

Não é acesso público — é pior no contexto de um sistema vendido a várias redes: qualquer
cliente logado enxergava os dados de **todos os outros clientes**. Em `usuarios_sistema`
isso inclui login e senha em texto puro de toda a base.

- Função nova `minha_rede(loja_id)`, para as políticas não repetirem a expressão
- As cinco passaram a valer a mesma regra das outras 29
- `whatsapp_pendentes` não tem `loja_id` e guarda a sucursal como texto — pode ser o uuid
  do banco ou o código local (`suc_sfs`), então a política aceita os dois caminhos
- Conferido nos dois sentidos: o usuário do Rafael continua vendo 7 usuários, 326 insumos
  e 9 pedidos online; um usuário de outra rede vê zero

### O que ficou aberto de propósito

`app_usuarios` (leitura pública) e `pedidos` (política "app le pedidos") **alimentam o
aplicativo do franqueado**, em `rafaeluendes-jpg.github.io/nexor-app/`, que entra sem
sessão. Tirar derruba o aplicativo. O certo não é tirar: é trocar por função no banco que
devolva a linha só quando a senha bate — como já faz a `login_nexor`. Fica para quando o
repositório do `nexor-app` for mexido.

## Correções ao mapa da obra do Auth (07/08)

- **O passo 1 já estava feito.** `rafael@nexor.app` existe no Auth desde 28/07, com perfil,
  loja e empresa. O cargo é `plataforma`, não `admin` — e `sou_admin()` só aceita `'admin'`.
  Com uma loja só não atrapalha, porque `minha_loja()` resolve; na segunda rede o ramo de
  admin nunca dispararia
- **`login_nexor` está aberta ao anônimo.** É um endereço público que confere senha em
  texto puro, sem freio, e devolve `loja_id`, permissões, `tudo` e `mestre` quando acerta.
  Com senha de 3 caracteres é questão de minutos. Some no passo 2, junto com a tabela
- **O passo 2 esbarra nas senhas.** Os 7 usuários têm senha de 3 caracteres; o Auth exige 6.
  E o login `franqueador` não é e-mail, que o Auth exige. Os outros 6 já são
- **O robô não está conectado.** `whatsapp_sessoes` vazia e nada em `whatsapp_mensagens`
  desde 02/08 — fechar as três do WhatsApp não interrompe operação nenhuma

## Uma entrada só: o login virou Supabase Auth (V17.4.0)

Eram duas entradas — a do sistema (senha em texto puro em `usuarios_sistema`) e a da
nuvem (ícone de nuvem › Banco de dados). Como ninguém entrava pelo Auth, `auth.uid()`
ficava vazio e as regras de RLS das 29 tabelas não tinham em quem se apoiar: estavam
escritas e não valiam nada. Agora **quem entra no sistema entra na nuvem**.

### No banco

- As **7 contas criadas no Auth**, com e-mail confirmado e identidade. O login
  `franqueador` não era e-mail, que o Auth exige — virou `franqueador@jologelato.com`
- Uma linha em `perfis` para cada: os dois `mestre` como `admin`, as 5 unidades como
  `gerente`. `rafael@nexor.app` continua como `plataforma`, com a senha antiga — é a
  conta de conexão, separada das de pessoas
- **`login_nexor` removida.** Era executável pelo anônimo e conferia senha em texto
  puro sem freio nenhum. Conferido no repositório `nexor-app`: ninguém mais a chama

### No sistema

- `entrarPeloAuth()` distingue **senha recusada** de **internet caída**. A diferença é
  o que impede uma recusa do servidor de virar entrada pela conferência local
- Sem internet, a entrada **cai para o cadastro do aparelho** e abre em modo local, com
  o aviso vermelho do rodapé. Uma loja não pode parar de vender porque o wifi caiu
- `abrirSessao()` não religa a nuvem quando a entrada já ligou — só busca o que mudou
- `sair()` encerra também a sessão do Auth; deixá-la de pé manteria o token válido
- A senha `'123'` embutida do administrador mestre **saiu do `baseUsr()`**. Era a mesma
  em toda instalação do Nexor: porta destrancada em todo cliente futuro

### Consequência que ficou registrada na tela

Criar usuário em Usuários e Permissões **não cria a conta no Auth** — a chave de
administrador não pode ir para o navegador, senão qualquer cliente vira admin de todas
as redes. Até a Edge Function existir, a tela avisa em caixa âmbar que a conta precisa
ser criada no banco, e o login passou a exigir formato de e-mail.

**O passo 5 deixou de ser opcional:** sem ele, ninguém cadastra usuário novo sozinho.

### Ainda aberto

O `nexor-app` lê `app_usuarios` inteira e **compara a senha dentro do navegador**, e puxa
`pedidos` com limite de 20 mil linhas, sem sessão. São as duas últimas políticas públicas.
Fecham quando aquele repositório for mexido — troca por função no banco, como era a
`login_nexor`.

### Testado e funcionando (07/08, 12:02 → 12:10)

Entrada confirmada pelas duas contas, com o banco registrando `last_sign_in_at`:
`rafael@uendes.com` às 12:02 e `franqueador@jologelato.com` às 12:10. Estoque Total
(R$ 19.632,63 em 337 itens), Ficha Técnica, Lançamentos, PDV e Usuários abriram cheias —
é o que prova que o token está indo junto e o RLS reconheceu `auth.uid()`. Na sessão do
franqueador o menu **Administração não aparece**: a diferença de cargo funcionando.

### Três coisas que o teste levantou

**1. `clientes_nexor` recusava o envio.** É a tabela do contrato — plano, módulos, situação
da rede — e a regra dela exige `sou_plataforma()`. A regra está certa: num sistema vendido,
o cliente não pode gravar o próprio contrato, senão se dá o plano que quiser. Faltava o
Rafael ser reconhecido como dono da plataforma. `rafael@uendes.com` passou a `plataforma`,
e `sou_admin()` foi ampliada para `cargo in ('admin','plataforma')` — senão trocar o cargo
tiraria dele o ramo de admin das 29 tabelas.

**2. Mexer por SQL em tabela espelhada não gruda.** Eu troquei `franqueador` para
`franqueador@jologelato.com` direto no banco; o aparelho subiu a cópia local por cima e
desfez. Resultado: a conta do Auth existia com um nome e o cadastro do sistema com outro,
e ninguém entrava por aquele acesso. **A correção tem de ser feita pela tela**, que é quem
manda em `usuarios_sistema`. É também o motivo de o passo 5 (Edge Function) não ter
alternativa: não há como criar usuário por fora sem a sincronização desfazer.

**3. "Sem grupo 1" na Ficha Técnica não era falha do Auth.** É ficha duplicada:
**BELGA GELATO código 84** sem grupo e **Belga Gelato código 85** dentro de Produzido. A
pasta âmbar da V13.2.0 fazendo o trabalho dela — mostrando o que ficaria invisível.

### Gordura que sobrou

O cadastro ainda guarda a senha em texto puro, e ela sobe para `usuarios_sistema`. Depois
do Auth isso é **sobra**: só serve para a conferência local quando a internet cai. O certo
é guardar uma marca no aparelho, que não viaja para a nuvem. Fica para depois do `nexor-app`.

## O aplicativo do franqueado fala só por função (V17.5.0)

Eram as duas últimas portas abertas, e as piores que restavam:

- `app_usuarios` com leitura pública — o aplicativo **baixava a tabela inteira e comparava
  a senha dentro do navegador**. Qualquer pessoa com o endereço lia nome, login e senha em
  texto puro de todos os acessos de todas as redes
- `pedidos` com leitura pública, até 20 mil linhas, sem login nenhum

**Achado no caminho:** a consulta de pedidos do aplicativo filtrava por uma coluna `data`
que **não existe** na tabela — o nome certo é `data_venda`. Ela vinha falhando em silêncio,
então os números do franqueado nunca carregaram. Corrigido junto.

### No banco

- `senha_hash` em `app_usuarios`, cifrada com bcrypt. A coluna `senha` foi esvaziada
- `app_sessoes`: token de 64 caracteres, validade de 30 dias. RLS ligada **sem política
  nenhuma**, de propósito — só as funções abaixo entram lá
- `app_entrar(login,senha)` devolve token e perfil, **nunca a senha**. Freio de 5 tentativas
  e 15 minutos de bloqueio, com meio segundo de espera em cada erro para travar varredura.
  Durante o bloqueio nem a senha certa passa
- `app_dados(token,dias)` devolve lojas, produtos e pedidos **já filtrados pelas sucursais
  daquele acesso** — antes o franqueado de Jales lia os pedidos de São Paulo
- `app_definir_senha(login,senha)` cifra dentro do banco, e só aceita acesso da própria rede
- As políticas `login publico` e `app le pedidos` foram removidas

### No aplicativo

Zero consultas diretas a tabela: são só chamadas de função. A senha **deixou de ser
guardada no aparelho** — fica só o token, que vence e pode ser cortado pelo banco.

## Criação de acesso por Edge Function (V17.5.0)

`criar-usuario`, no servidor. É a única coisa que tem a chave de administrador — ela não
pode ir para o navegador, senão qualquer cliente vira admin de todas as redes.

- Confere a sessão de quem chamou com `getUser()`, e lê o perfil **com a sessão dele**,
  então o RLS continua valendo
- Só `admin` e `plataforma` criam. Gerente recebe recusa
- **A loja é sempre a de quem chamou**, nunca a que vem no pedido — senão um admin criaria
  usuário dentro da rede do vizinho
- E-mail válido e senha de 6+ obrigatórios. Se o e-mail já existir em outra rede, recusa
- `verify_jwt` desligado de propósito: com ele ligado, a vistoria do navegador (OPTIONS),
  que vai sem cabeçalho, seria recusada antes de chegar na função. O rigor está no `getUser()`

Testada nos quatro caminhos: sem sessão recusa, gerente recusa, admin cria, senha curta
recusa. A tela de Usuários e Permissões perdeu o aviso âmbar — agora a conta nasce ao salvar.

### O que sobrou aberto ao anônimo

Só o que o cardápio digital precisa ler sem login: `produtos`, `categorias`,
`areas_entrega`, `areas_zonas`, `formas_pagamento`, `grupos_opcoes`, `opcoes`, `sucursais`
e `cardapio_config`. Mais as três do WhatsApp, que esperam saber qual chave o robô usa
no Render.

`sucursais` merece uma volta depois: ela expõe CNPJ, endereço e telefone de todas as redes,
e o cardápio precisa de bem menos que isso.

## As três do WhatsApp, fechadas (V17.5.1)

Estavam abertas há meses porque o **robô usava a chave pública do banco** — sem as
políticas `ALL/true`, ele não conseguiria gravar. Fechar antes de resolver isso teria
derrubado o robô no meio do expediente.

Descoberto ao olhar o Render: a variável se chama `CHAVE_BANCO`, que **não está na lista
de nomes que o `server.js` procura**. Funcionava só porque o robô acha a chave **pelo
formato** (`acharPorConteudo`), com uma regra que reconhecia `sb_publishable_` ou `eyJ` —
e por isso nunca reconheceria uma chave secreta.

**No robô:** a chave secreta passou a ter preferência (`sb_secret_`, ou um JWT cujo corpo
diga `service_role`). O log da inicialização agora diz qual está em uso, e reclama quando
for a pública. Rafael trocou o valor de `CHAVE_BANCO` no Render; o log confirmou
`chave do banco: SECRETA (correta)`.

**No banco:**

- `whatsapp_mensagens` e `whatsapp_config` passaram a valer pela sucursal, que chega na
  loja — nenhuma das duas tem `loja_id` próprio, e a sucursal é texto, então as políticas
  aceitam tanto o uuid quanto o código local
- `whatsapp_sessoes` ficou **com RLS ligada e nenhuma política**. Ela guarda a credencial
  da conexão do WhatsApp e o navegador não tem o que fazer ali — só o robô, pelo servidor,
  com a chave secreta que passa por cima do RLS

Conferido nos dois sentidos: o anônimo recebe lista vazia e é recusado ao escrever; a
sessão do Rafael continua vendo as 70 mensagens e as 5 configurações.

### Chaves queimadas nesta série de sessões

Tudo que passou por conversa ou por repositório público deve ser considerado exposto:
`NexorZap2026` (já trocada), a chave publishable do Supabase (é pública por desenho, sem
problema), o token do GitHub `ghp_4VkW...`, a `CHAVE_API` do robô e a `GROQ_KEY`. As três
últimas continuam pendentes de troca.

## O robô reconhece a sessão, não uma chave digitada (V17.6.0)

Rafael cortou certo: **um sistema vendido a várias redes não pode depender de alguém
distribuir senha para cada loja de cada cliente.** O campo de digitar chave da V17.3.0 foi
um remendo de quando o robô estava aberto e ainda não havia login de verdade. Hoje há —
cada pessoa tem sessão no Auth e o sistema já carrega um token em toda chamada.

Era o passo 6 do mapa, e ele chegou antes do previsto porque o passo 2 o destravou.

**No robô:** `autorizado()` tem duas portas. Primeiro o cabeçalho `Authorization: Bearer`
— o robô pergunta ao Supabase de quem é o token e lê `perfis`, com cache de 60 segundos
para não consultar a cada clique. A chave fixa continua como segunda porta, para chamada
de máquina (script, agendador) que não tem sessão de gente.

**Ganho que a chave nunca deu:** `daMinhaLoja` entrou em `/conectar`, `/estado`,
`/desconectar` e `/enviar`. Antes, quem tivesse a chave comandava **qualquer** loja de
**qualquer** rede — era uma só para todo mundo. Agora o gerente de Jales não desconecta o
WhatsApp de São Paulo. Quem entra pela chave fixa não tem perfil e passa reto: já foi
autenticado pela chave.

**No sistema:** `zapApi()` manda o token da sessão. Sem nuvem, ainda aceita a chave fixa,
se houver. O bloco "Chave de acesso ao robô" saiu da tela de Conexão e virou um aviso do
estado da autorização — não há mais nada a configurar por aparelho.

**Consequência prática:** cliente novo não recebe chave nenhuma. Entra no sistema e o robô
já obedece.

## Assistente Nexor — canal e lançamento (parte 1 de 2)

Duas coisas diferentes que eu tinha confundido numa resposta: a **atendente (Carla)** é um
número por loja, no celular da sorveteria, por QR/Baileys. A **Assistente Nexor** é **um
número só para toda a plataforma**, atendendo todas as redes vendidas — e por isso vai pela
Cloud API da Meta. Baileys não serve ali: é uso não oficial, e um número disparando cobrança
para dezenas de gestores é o perfil que o WhatsApp bane.

### A decisão que estruturou tudo

**O robô não calcula estoque.** No Nexor o estoque é um número guardado no insumo, somado
por `aplicarMovimento()` quando alguém lança pela tela — não há reconstrução a partir dos
movimentos. Se o robô também somasse, seriam duas contas em lugares diferentes, e é assim
que nasce divergência. Ele grava o lançamento **já confirmado** em `whatsapp_pendentes`, e
o sistema aplica pelo mesmo caminho de uma pessoa digitando.

O atraso que isso criaria não existe na prática: o PDV fica aberto o dia todo. Foi o que
dispensou reescrever o cálculo de estoque — o caminho de maior risco do sistema.

### `canal.js`

Esconde a diferença dos dois canais. Quem envia chama `enviarPara()` e não sabe por onde
saiu. Trata o **nono dígito** brasileiro, que faz mensagem sumir quando o número está
gravado no formato antigo. As rotas `/meta/webhook` já respondem à vistoria da Meta; sem
`META_TOKEN` e `META_PHONE_NUMBER_ID` a assistente cai no Baileys — o que permite testar
tudo antes de o número sair da aprovação.

### `lancamento.js`

Conversa de conferência item a item. Entende foto (modelo com visão) ou texto, casa cada
item com o cadastro de insumos, e **pergunta quando há dúvida** em vez de escolher sozinha.
Aceita correção escrita (_12 kg por 58,00_), permite pular item, e só grava depois do sim
no total. A IA só extrai — instrução explícita para nunca inventar valor, quantidade ou
fornecedor; o que não achar volta em branco e vira pergunta.

**A trilha:** a conversa inteira vai junto no campo `conversa`, com hora de cada fala. Se um
dia alguém disser que o sistema lançou errado, está registrado o que foi perguntado e o que
ele respondeu. `whatsapp_pendentes` ganhou política restritiva: **só a plataforma apaga** —
o franqueado não pode remover a própria confirmação.

Testado de ponta a ponta em simulação: desambiguação entre dois açúcares, correção de
quantidade e valor, total e gravação.

### Falta (parte 2)

- Caixa de entrada no sistema, que consome os pendentes e aplica
- PDF do relatório de checklist e envio a cada X dias

## Caixa de entrada da assistente (V18.0.0 — parte 2)

O que fecha o ciclo: o robô confirma e grava; **quem aplica é o sistema**.

`aplicarPendenteAssistente()` monta a nota de entrada com a mesma forma da tela, cria o
lançamento financeiro no mesmo formato, e chama **`aplicarMovimento()` — a mesma função
que a tela chama**. Era esse o ponto: uma conta só. O custo médio, o histórico de compra e
o preço da última compra saem todos pelo caminho de sempre.

**Decisões dentro dele:**

- O fornecedor é achado pelo nome ou **criado**, para a nota não nascer solta
- O lançamento entra **em aberto, sem banco e sem forma de pagamento**. Banco e forma
  pertencem ao pagamento (V10.1.0) — a assistente não decide de onde o dinheiro sai
- O item é procurado por `ref_local`, depois por id, depois por nome. Se não achar,
  **falha e diz qual item** em vez de lançar errado
- **Erro de dado não é repetido**: o pendente é marcado como `erro` e a fila segue. Senão
  um item defeituoso travaria todos os outros atrás dele
- O laço roda de 60 em 60 segundos, e **nunca com janela aberta ou aba em segundo plano** —
  aplicar uma nota no meio de um lançamento redesenharia a tela debaixo da mão da pessoa
- Ligado nos dois caminhos de entrada: quem faz login e quem volta com sessão guardada

**Na fila do banco** ficou um pendente de teste (`TESTE ASSISTENTE`, 100 copinhos por
R$ 100,00) para conferir de ponta a ponta na primeira abertura.

## Relatório do checklist em PDF (V18.1.0 — parte 3)

### A trilha era furada em dois pontos

Conferindo as políticas antes de construir, apareceram duas falhas que esvaziavam o
sentido do relatório:

- **A matriz da rede conseguia apagar.** A regra dizia `sou_admin()`, e essa função foi
  ampliada hoje. Mas a matriz é parte interessada no que o relatório mostra. Passou a ser
  `sou_plataforma()` — apagar é só do dono do Nexor
- **O franqueado podia reescrever uma resposta já dada.** A regra de UPDATE deixava alterar
  qualquer linha da loja dele: dava para trocar um "não" por "sim" no dia seguinte. Agora a
  regra exige `respondida_em is null`, e um **gatilho no banco** recusa a alteração mesmo
  para quem chegar por fora do RLS. Testado: a troca foi barrada

### `relatorio.js`

PDF escrito à mão, sem biblioteca. Uma tabela de texto não justifica arrastar 2 MB de
pacote para um serviço que roda sozinho, e menos dependência é menos coisa para quebrar.
Validado com um leitor de PDF de verdade: paginação, fontes e xref corretos.

- Uma seção por sucursal; quem não tem registro aparece como "sem registro", em vez de
  sumir. O que não casar com sucursal nenhuma cai em "Sem unidade identificada" — dado
  órfão não pode desaparecer do relatório
- Quem não respondeu aparece como **SEM RESPOSTA**, que é informação, não ausência
- Acento é trocado por equivalente sem acento: o PDF base usa WinAnsi e mostraria caractere
  quebrado num documento que vai para o franqueador
- Rodapé diz que o PDF é cópia e que o original está no Nexor, sem poder ser alterado

**O envio** roda de hora em hora e respeita a frequência de cada rede (`relatorio_freq`),
com **um relatório por rede, não por unidade**. Período vazio não gera envio. Rota
`/relatorio/:loja` dispara na hora, para conferir sem esperar o prazo.

**Limite conhecido:** o PDF vai pelo Baileys, que aceita o arquivo direto. A Cloud API da
Meta exige URL pública para documento — quando o número da Meta existir, o PDF precisará
subir para algum lugar antes. Fica anotado.
