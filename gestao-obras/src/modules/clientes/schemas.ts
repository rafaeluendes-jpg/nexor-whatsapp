import { z } from 'zod'
import { documentoOpcional, emailOpcional, enderecoSchema, enderecoVazio, telefoneOpcional } from '@/shared/lib/schemas-comuns'

export const clienteSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome').max(120),
  telefone: telefoneOpcional,
  email: emailOpcional,
  documento: documentoOpcional,
  endereco: enderecoSchema,
  observacoes: z.string().trim().max(2000).optional().or(z.literal('')),
})
export type ClienteValores = z.infer<typeof clienteSchema>
export type ClienteEntrada = z.input<typeof clienteSchema>

export const clienteVazio: ClienteValores = {
  nome: '',
  telefone: '',
  email: '',
  documento: '',
  endereco: enderecoVazio,
  observacoes: '',
}
