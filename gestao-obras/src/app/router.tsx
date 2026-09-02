import { createBrowserRouter, Navigate } from 'react-router'
import { RequerAutenticacao, RequerVisitante } from '@/modules/auth/guards'
import { AuthLayout } from '@/modules/auth/components/auth-layout'
import { LoginPage } from '@/modules/auth/pages/login-page'
import { CadastroPage } from '@/modules/auth/pages/cadastro-page'
import { EsqueciSenhaPage } from '@/modules/auth/pages/esqueci-senha-page'
import { RedefinirSenhaPage } from '@/modules/auth/pages/redefinir-senha-page'
import { CallbackPage } from '@/modules/auth/pages/callback-page'
import { AppShell } from '@/shared/components/layout/app-shell'
import { EmBrevePage } from '@/shared/components/layout/em-breve-page'
import { itensNav } from '@/shared/components/layout/nav-items'
import { DashboardPage } from '@/modules/dashboard/pages/dashboard-page'
import { ConfiguracoesPage } from '@/modules/configuracoes/pages/configuracoes-page'
import { rotasObras } from '@/modules/obras/rotas'
import { rotasClientes } from '@/modules/clientes/rotas'
import { ErroPage } from './erro-page'

export const router = createBrowserRouter([
  { path: '/auth/callback', element: <CallbackPage /> },
  {
    element: <RequerVisitante />,
    errorElement: <ErroPage />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/entrar', element: <LoginPage /> },
          { path: '/criar-conta', element: <CadastroPage /> },
          { path: '/esqueci-senha', element: <EsqueciSenhaPage /> },
        ],
      },
    ],
  },
  {
    element: <RequerAutenticacao />,
    errorElement: <ErroPage />,
    children: [
      // Redefinição de senha: usuário chega logado pelo link do e-mail.
      { element: <AuthLayout />, children: [{ path: '/redefinir-senha', element: <RedefinirSenhaPage /> }] },
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: '/configuracoes', element: <ConfiguracoesPage /> },
          ...rotasObras,
          ...rotasClientes,
          // Cada módulo terá sua própria pasta e suas próprias rotas; até lá, placeholder.
          ...itensNav.filter((i) => i.emBreve).map((i) => ({ path: i.para, element: <EmBrevePage /> })),
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
