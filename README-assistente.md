# Assistente de Gestão do Nexor

Responde ao **gestor da loja**, não ao cliente. Lê o mesmo banco que o sistema Nexor
lê — por isso o número nunca diverge do que aparece na tela.

## Como reconhece o gestor
`whatsapp_config.gestor_zap` guarda o WhatsApp do gestor daquela loja. Só esse número
recebe resposta de gestão; qualquer outro cai na atendente de cliente, como antes.

## O que responde hoje
- "qual o faturamento de hoje" — soma os pedidos do dia, com ticket médio
- "quanto tem de açúcar" — saldo, mínimo e aviso se estiver abaixo
- "o que precisa comprar" — todos os itens abaixo do mínimo
- "tem boleto para pagar" — despesas não pagas vencendo até hoje
- "sim" / "não" — responde o checklist do dia e **grava** em `assistente_conversas`

## O que ainda não faz
- Lançar nota por foto ou por texto
- Dar baixa em boleto
- Enviar a cobrança do checklist no horário (falta o agendador)
