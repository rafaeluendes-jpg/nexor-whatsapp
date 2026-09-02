import { z } from 'zod'

export const senhaSchema = z
  .string()
  .min(8, 'Mínimo de 8 caracteres')
  .max(72, 'Máximo de 72 caracteres')
  .refine((s) => /[a-z]/.test(s) && /[A-Z]/.test(s), 'Use letras maiúsculas e minúsculas')
  .refine((s) => /[0-9]/.test(s), 'Inclua pelo menos um número')

export const emailSchema = z.email('Informe um e-mail válido').max(254).transform((e) => e.trim().toLowerCase())

export const loginSchema = z.object({
  email: emailSchema,
  senha: z.string().min(1, 'Informe a senha'),
})
export type LoginValores = z.infer<typeof loginSchema>

export const cadastroSchema = z
  .object({
    nome: z.string().trim().min(2, 'Informe seu nome').max(120),
    nomeEmpresa: z.string().trim().max(120).optional(),
    profissao: z.string().trim().max(60).optional(),
    telefone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()-]{8,20}$/, 'Telefone inválido')
      .optional()
      .or(z.literal('')),
    email: emailSchema,
    senha: senhaSchema,
    confirmarSenha: z.string(),
    aceitaTermos: z.literal(true, { error: 'Você precisa aceitar os termos' }),
  })
  .refine((d) => d.senha === d.confirmarSenha, { path: ['confirmarSenha'], message: 'As senhas não conferem' })
export type CadastroValores = z.infer<typeof cadastroSchema>

export const esqueciSenhaSchema = z.object({ email: emailSchema })
export type EsqueciSenhaValores = z.infer<typeof esqueciSenhaSchema>

export const redefinirSenhaSchema = z
  .object({ senha: senhaSchema, confirmarSenha: z.string() })
  .refine((d) => d.senha === d.confirmarSenha, { path: ['confirmarSenha'], message: 'As senhas não conferem' })
export type RedefinirSenhaValores = z.infer<typeof redefinirSenhaSchema>

export const PROFISSOES = [
  'Engenheiro(a) civil',
  'Arquiteto(a)',
  'Construtor(a) / Empreiteiro(a)',
  'Mestre de obras',
  'Pedreiro(a)',
  'Eletricista',
  'Encanador(a)',
  'Pintor(a)',
  'Instalador(a)',
  'Empresa de construção / reformas',
  'Outro',
] as const
