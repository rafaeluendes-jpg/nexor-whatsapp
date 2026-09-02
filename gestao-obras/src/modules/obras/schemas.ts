import { z } from 'zod'
import { enderecoSchema, enderecoVazio } from '@/shared/lib/schemas-comuns'
import { Constants } from '@/shared/types/database'

export const STATUS_OBRA = Constants.public.Enums.status_obra
export type StatusObra = (typeof STATUS_OBRA)[number]

export const statusObraInfo: Record<StatusObra, { rotulo: string; variante: 'secondary' | 'info' | 'warning' | 'destructive' | 'success' | 'outline' }> = {
  planejada: { rotulo: 'Planejada', variante: 'secondary' },
  em_execucao: { rotulo: 'Em execução', variante: 'info' },
  pausada: { rotulo: 'Pausada', variante: 'warning' },
  atrasada: { rotulo: 'Atrasada', variante: 'destructive' },
  concluida: { rotulo: 'Concluída', variante: 'success' },
  cancelada: { rotulo: 'Cancelada', variante: 'outline' },
}

const dataOpcional = z.string().optional().or(z.literal(''))
const numeroOpcional = z.number().min(0).nullable().optional()

export const obraSchema = z
  .object({
    nome: z.string().trim().min(2, 'Informe o nome da obra').max(160),
    codigo: z.string().trim().max(30).optional().or(z.literal('')),
    cliente_id: z.string().optional().or(z.literal('')),
    responsavel_id: z.string().optional().or(z.literal('')),
    status: z.enum(STATUS_OBRA),
    descricao: z.string().trim().max(4000).optional().or(z.literal('')),
    endereco: enderecoSchema,
    area_m2: numeroOpcional,
    valor_contratado: numeroOpcional,
    data_inicio_prevista: dataOpcional,
    data_fim_prevista: dataOpcional,
    data_inicio_real: dataOpcional,
    data_fim_real: dataOpcional,
  })
  .refine((d) => !d.data_inicio_prevista || !d.data_fim_prevista || d.data_fim_prevista >= d.data_inicio_prevista, {
    path: ['data_fim_prevista'],
    message: 'O término previsto precisa ser depois do início',
  })
export type ObraValores = z.infer<typeof obraSchema>
export type ObraEntrada = z.input<typeof obraSchema>

export const obraVazia: ObraValores = {
  nome: '',
  codigo: '',
  cliente_id: '',
  responsavel_id: '',
  status: 'planejada',
  descricao: '',
  endereco: enderecoVazio,
  area_m2: null,
  valor_contratado: null,
  data_inicio_prevista: '',
  data_fim_prevista: '',
  data_inicio_real: '',
  data_fim_real: '',
}
