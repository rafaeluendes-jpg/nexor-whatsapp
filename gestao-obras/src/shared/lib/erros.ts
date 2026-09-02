/**
 * Traduz mensagens de erro do Supabase Auth para português claro.
 * Nunca revela se um e-mail existe ou não (evita enumeração de usuários).
 */
const mapa: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/email not confirmed/i, 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.'],
  [/user already registered/i, 'Não foi possível concluir o cadastro. Se você já tem conta, faça login.'],
  [/password should be at least/i, 'A senha precisa ter pelo menos 8 caracteres.'],
  [/weak password|pwned|compromised/i, 'Essa senha é fraca ou já vazou em outros sites. Escolha outra.'],
  [/rate limit|too many requests|over_email_send_rate_limit/i, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'],
  [/otp expired|token has expired|invalid token|link is invalid/i, 'Esse link expirou ou é inválido. Solicite um novo.'],
  [/same password/i, 'A nova senha precisa ser diferente da atual.'],
  [/signups not allowed/i, 'Cadastro desativado no momento.'],
  [/network|failed to fetch/i, 'Sem conexão. Verifique sua internet.'],
]

export function traduzirErro(erro: unknown, padrao = 'Algo deu errado. Tente novamente.'): string {
  const msg = erro instanceof Error ? erro.message : typeof erro === 'string' ? erro : ''
  for (const [re, texto] of mapa) if (re.test(msg)) return texto
  return padrao
}
