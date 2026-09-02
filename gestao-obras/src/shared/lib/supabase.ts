import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/shared/types/database'
import { env } from './env'

/**
 * Cliente único do Supabase para todo o app.
 * - Usa a chave PÚBLICA (publishable). Toda proteção de dados vem do RLS no banco.
 * - PKCE: fluxo de autenticação recomendado para apps web/mobile.
 * - Sessão persistida e renovada automaticamente.
 */
export const supabase = createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
