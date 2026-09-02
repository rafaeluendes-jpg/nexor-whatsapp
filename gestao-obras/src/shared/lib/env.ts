import { z } from 'zod'

// Valida as variáveis de ambiente na inicialização: falha cedo, com mensagem clara,
// em vez de quebrar silenciosamente em produção.
const schema = z.object({
  VITE_SUPABASE_URL: z.url({ message: 'VITE_SUPABASE_URL precisa ser uma URL válida' }),
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(20, 'VITE_SUPABASE_PUBLISHABLE_KEY ausente')
    .refine((k) => !k.includes('service_role'), 'Nunca use a service_role key no frontend'),
})

const parsed = schema.safeParse(import.meta.env)

if (!parsed.success) {
  const detalhes = parsed.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n')
  throw new Error(`Configuração de ambiente inválida:\n${detalhes}\n\nVeja o arquivo .env.example.`)
}

export const env = parsed.data
