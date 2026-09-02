import type { RouteObject } from 'react-router'
import { ClientesListaPage } from './pages/clientes-lista-page'
import { ClienteFormPage } from './pages/cliente-form-page'
import { ClienteDetalhePage } from './pages/cliente-detalhe-page'

export const rotasClientes: RouteObject[] = [
  { path: '/clientes', element: <ClientesListaPage /> },
  { path: '/clientes/novo', element: <ClienteFormPage /> },
  { path: '/clientes/:id', element: <ClienteDetalhePage /> },
  { path: '/clientes/:id/editar', element: <ClienteFormPage /> },
]
