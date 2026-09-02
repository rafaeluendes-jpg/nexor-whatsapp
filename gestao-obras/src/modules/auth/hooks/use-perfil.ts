import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from './use-auth'

export type Perfil = {
  id: string
  nome: string
  telefone: string | null
  avatar_url: string | null
  profissao: string | null
}

export type MembroOrg = {
  organizacao_id: string
  papel: 'proprietario' | 'administrador' | 'engenheiro' | 'mestre_obras' | 'funcionario' | 'prestador'
  organizacoes: { id: string; nome: string; logo_url: string | null } | null
}

export function usePerfil() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['perfil', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Perfil> => {
      const { data, error } = await supabase
        .from('perfis')
        .select('id, nome, telefone, avatar_url, profissao')
        .eq('id', user!.id)
        .single()
      if (error) throw error
      return data as Perfil
    },
  })
}

/** Organizações em que o usuário é membro (a maioria terá uma só). */
export function useMinhasOrganizacoes() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['minhas-organizacoes', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<MembroOrg[]> => {
      const { data, error } = await supabase
        .from('organizacao_membros')
        .select('organizacao_id, papel, organizacoes ( id, nome, logo_url )')
        .eq('ativo', true)
        .order('criado_em', { ascending: true })
      if (error) throw error
      return data as unknown as MembroOrg[]
    },
  })
}
