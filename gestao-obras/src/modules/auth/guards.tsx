import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './hooks/use-auth'
import { TelaCarregando } from '@/shared/components/layout/tela-carregando'

/** Só deixa passar quem está logado. Guarda a rota de origem para voltar depois do login. */
export function RequerAutenticacao() {
  const { user, carregando } = useAuth()
  const location = useLocation()
  if (carregando) return <TelaCarregando />
  if (!user) return <Navigate to="/entrar" replace state={{ de: location.pathname + location.search }} />
  return <Outlet />
}

/** Telas de login/cadastro: quem já está logado vai direto para o app. */
export function RequerVisitante() {
  const { user, carregando } = useAuth()
  const location = useLocation()
  if (carregando) return <TelaCarregando />
  if (user) {
    const destino = (location.state as { de?: string } | null)?.de ?? '/'
    return <Navigate to={destino} replace />
  }
  return <Outlet />
}
