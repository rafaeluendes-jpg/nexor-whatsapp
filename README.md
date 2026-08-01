# Nexor WhatsApp

Robô de WhatsApp do sistema Nexor. Uma sessão por loja, conectada por QR code.

## O que faz
- Conecta o WhatsApp de cada loja lendo um QR no sistema
- Responde sozinho: cardápio, horário, taxa de entrega, pagamento
- Envia os avisos de cada fase do pedido (aceito, saiu para entrega, entregue)
- Reconecta sozinho se a conexão cair

## Variáveis de ambiente
| nome | para que serve |
|---|---|
| `CHAVE_API` | senha que o sistema usa para falar com o robô |
| `SUPABASE_URL` | endereço do banco |
| `SUPABASE_KEY` | chave de serviço do banco |
