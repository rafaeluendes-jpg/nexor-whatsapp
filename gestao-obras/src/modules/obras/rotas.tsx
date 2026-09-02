import type { RouteObject } from 'react-router'
import { ObrasListaPage } from './pages/obras-lista-page'
import { ObraFormPage } from './pages/obra-form-page'
import { ObraDetalhePage } from './pages/obra-detalhe-page'

export const rotasObras: RouteObject[] = [
  { path: '/obras', element: <ObrasListaPage /> },
  { path: '/obras/nova', element: <ObraFormPage /> },
  { path: '/obras/:id', element: <ObraDetalhePage /> },
  { path: '/obras/:id/editar', element: <ObraFormPage /> },
]
