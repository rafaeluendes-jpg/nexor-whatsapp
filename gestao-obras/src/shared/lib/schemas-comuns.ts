import { z } from 'zod'
import { somenteDigitos } from './formatos'

export const telefoneOpcional = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .refine((v) => !v || /^\+?[0-9 ()-]{8,20}$/.test(v), 'Telefone inválido')

export const emailOpcional = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .or(z.literal(''))
  .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'E-mail inválido')

export const documentoOpcional = z
  .string()
  .optional()
  .or(z.literal(''))
  .refine((v) => {
    const n = somenteDigitos(v)
    return !n || n.length === 11 || n.length === 14
  }, 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)')

export const enderecoSchema = z.object({
  cep: z.string().optional().or(z.literal('')),
  logradouro: z.string().trim().max(160).optional().or(z.literal('')),
  numero: z.string().trim().max(20).optional().or(z.literal('')),
  complemento: z.string().trim().max(80).optional().or(z.literal('')),
  bairro: z.string().trim().max(80).optional().or(z.literal('')),
  cidade: z.string().trim().max(80).optional().or(z.literal('')),
  uf: z.string().trim().toUpperCase().max(2).optional().or(z.literal('')),
})
export type EnderecoValores = z.infer<typeof enderecoSchema>

export const enderecoVazio: EnderecoValores = { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' }

export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'] as const
