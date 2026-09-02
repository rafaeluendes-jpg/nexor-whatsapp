import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import type { Tables } from '@/shared/types/database'
import { useAuth } from '@/modules/auth/hooks/use-auth'
import { useOrganizacaoAtual } from '@/modules/auth/hooks/use-perfil'
import type { ObraValores, StatusObra } from '../schemas'

export type Obra = Tables<'obras'> & {
  clientes: { id: string; nome: string } | null
  responsavel: { id: string; nome: string } | null
}

const SELECAO = '*, clientes ( id, nome ), responsavel:perfis!obras_responsavel_id_fkey ( id, nome )'

export type FiltroObras = {
  busca?: string
  status?: StatusObra | 'todas'
  arquivadas?: boolean
  clienteId?: string
}

export function useObras(filtro: FiltroObras = {}) {
  const { organizacaoId } = useOrganizacaoAtual()
  return useQuery({
    queryKey: ['obras', organizacaoId, filtro],
    enabled: !!organizacaoId,
    queryFn: async (): Promise<Obra[]> => {
      let q = supabase.from('obras').select(SELECAO).eq('organizacao_id', organizacaoId!).order('atualizado_em', { ascending: false })
      q = filtro.arquivadas ? q.not('arquivada_em', 'is', null) : q.is('arquivada_em', null)
      if (filtro.status && filtro.status !== 'todas') q = q.eq('status', filtro.status)
      if (filtro.clienteId) q = q.eq('cliente_id', filtro.clienteId)
      const termo = filtro.busca?.trim()
      if (termo) q = q.or(`nome.ilike.%${termo}%,codigo.ilike.%${termo}%`)
      const { data, error } = await q
      if (error) throw error
      return data as unknown as Obra[]
    },
  })
}

export function useObra(id: string | undefined) {
  return useQuery({
    queryKey: ['obra', id],
    enabled: !!id,
    queryFn: async (): Promise<Obra> => {
      const { data, error } = await supabase.from('obras').select(SELECAO).eq('id', id!).single()
      if (error) throw error
      return data as unknown as Obra
    },
  })
}

/** Contagem por status para o painel inicial. */
export function useResumoObras() {
  const { organizacaoId } = useOrganizacaoAtual()
  return useQuery({
    queryKey: ['obras-resumo', organizacaoId],
    enabled: !!organizacaoId,
    queryFn: async () => {
      const { data, error } = await supabase.from('obras').select('status').eq('organizacao_id', organizacaoId!).is('arquivada_em', null)
      if (error) throw error
      const porStatus = {} as Record<StatusObra, number>
      for (const o of data) porStatus[o.status] = (porStatus[o.status] ?? 0) + 1
      return { total: data.length, porStatus }
    },
  })
}

/** Membros da organização para o campo "responsável". */
export function useMembrosOrganizacao() {
  const { organizacaoId } = useOrganizacaoAtual()
  return useQuery({
    queryKey: ['membros-organizacao', organizacaoId],
    enabled: !!organizacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizacao_membros')
        .select('user_id, papel, perfis ( id, nome )')
        .eq('organizacao_id', organizacaoId!)
        .eq('ativo', true)
      if (error) throw error
      return (data as unknown as { user_id: string; papel: string; perfis: { id: string; nome: string } | null }[]).map((m) => ({
        id: m.user_id,
        nome: m.perfis?.nome ?? 'Sem nome',
        papel: m.papel,
      }))
    },
  })
}

function paraBanco(v: ObraValores) {
  return {
    nome: v.nome,
    codigo: v.codigo || null,
    cliente_id: v.cliente_id || null,
    responsavel_id: v.responsavel_id || null,
    status: v.status,
    descricao: v.descricao || null,
    endereco: v.endereco,
    area_m2: v.area_m2 ?? null,
    valor_contratado: v.valor_contratado ?? null,
    data_inicio_prevista: v.data_inicio_prevista || null,
    data_fim_prevista: v.data_fim_prevista || null,
    data_inicio_real: v.data_inicio_real || null,
    data_fim_real: v.data_fim_real || null,
  }
}

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['obras'] })
  qc.invalidateQueries({ queryKey: ['obras-resumo'] })
}

export function useSalvarObra() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const { organizacaoId } = useOrganizacaoAtual()
  return useMutation({
    mutationFn: async ({ id, valores }: { id?: string; valores: ObraValores }): Promise<Obra> => {
      const q = id
        ? supabase.from('obras').update(paraBanco(valores)).eq('id', id)
        : supabase.from('obras').insert({ ...paraBanco(valores), organizacao_id: organizacaoId!, criado_por: user!.id })
      const { data, error } = await q.select(SELECAO).single()
      if (error) throw error
      return data as unknown as Obra
    },
    onSuccess: (o) => {
      invalidar(qc)
      qc.setQueryData(['obra', o.id], o)
    },
  })
}

export function useAlterarStatusObra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusObra }) => {
      const extra: Record<string, string> = {}
      const hoje = new Date().toISOString().slice(0, 10)
      if (status === 'em_execucao') extra.data_inicio_real = hoje
      if (status === 'concluida') extra.data_fim_real = hoje
      const { error } = await supabase.from('obras').update({ status, ...extra }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      invalidar(qc)
      qc.invalidateQueries({ queryKey: ['obra', id] })
    },
  })
}

export function useArquivarObra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, arquivar }: { id: string; arquivar: boolean }) => {
      const { error } = await supabase.from('obras').update({ arquivada_em: arquivar ? new Date().toISOString() : null }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      invalidar(qc)
      qc.invalidateQueries({ queryKey: ['obra', id] })
    },
  })
}

export function useExcluirObra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('obras').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidar(qc),
  })
}
