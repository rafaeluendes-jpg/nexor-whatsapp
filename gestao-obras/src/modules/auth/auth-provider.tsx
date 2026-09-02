import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/shared/lib/supabase'
import { queryClient } from '@/shared/lib/query-client'

export type AuthContextValue = {
  session: Session | null
  user: User | null
  /** true enquanto a sessão inicial ainda não foi lida do armazenamento */
  carregando: boolean
  sair: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return
      setSession(data.session)
      setCarregando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      setSession(novaSessao)
      setCarregando(false)
      // Ao trocar de usuário, nada do cache anterior pode vazar para a tela.
      if (evento === 'SIGNED_OUT' || evento === 'USER_UPDATED') queryClient.clear()
    })
    return () => {
      ativo = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      carregando,
      sair: async () => {
        await supabase.auth.signOut()
        queryClient.clear()
      },
    }),
    [session, carregando],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
