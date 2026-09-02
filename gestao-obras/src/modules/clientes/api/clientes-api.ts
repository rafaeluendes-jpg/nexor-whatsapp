import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { somenteDigitos } from '@/shared/lib/formatos'
import type { Tables } from '@/shared/types/database'
import { useAuth } from '@/modules/auth/hooks/use-auth'
import { useOrganizacaoAtual } from '@/modules/auth/hooks/use-perfil'
import type { ClienteValores } from '../schemas'

export type Cliente = Tables<'clientes'>

const chave = {
  lista: (org: string | null, busca: string) => ['clientes', org, busca] as const,
  um: (id: string) => ['cliente', id] as const,
}

export function useClientes(busca = '') {
  const { organizacaoId } = useOrganizacaoAtual()
  return useQuery({
    queryKey: chave.lista(organizacaoId, busca),
    enabled: !!organizacaoId,
    queryFn: async (): Promise<Cliente[]> => {
      let q = supabase.from('clientes').select('*').eq('organizacao_id', organizacaoId!).order('nome')
      const termo = busca.trim()
      if (termo) q = q.or(`nome.ilike.%${termo}%,email.ilike.%${termo}%,telefone.ilike.%${termo}%`)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useCliente(id: string | undefined) {
  return useQuery({
    queryKey: chave.um(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<Cliente> => {
      const { data, error } = await supabase.from('clientes').select('*').eq('id', id!).single()
      if (error) throw error
      return data
    },
  })
}

function paraBanco(v: ClienteValores) {
  return {
    nome: v.nome,
    telefone: v.telefone || null,
    email: v.email || null,
    documento: somenteDigitos(v.documento) || null,
    endereco: v.endereco,
    observacoes: v.observacoes || null,
  }
}

export function useSalvarCliente() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const { organizacaoId } = useOrganizacaoAtual()
  return useMutation({
    mutationFn: async ({ id, valores }: { id?: string; valores: ClienteValores }): Promise<Cliente> => {
      if (id) {
        const { data, error } = await supabase.from('clientes').update(paraBanco(valores)).eq('id', id).select().single()
        if (error) throw error
        return data
      }
      const { data, error } = await supabase
        .from('clientes')
        .insert({ ...paraBanco(valores), organizacao_id: organizacaoId!, criado_por: user!.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['clientes'] })
      qc.setQueryData(chave.um(c.id), c)
    },
  })
}

export function useExcluirCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clientes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] })
      qc.invalidateQueries({ queryKey: ['obras'] })
    },
  })
}
