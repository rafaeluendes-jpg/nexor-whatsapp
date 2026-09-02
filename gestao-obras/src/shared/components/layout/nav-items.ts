import {
  LayoutDashboard,
  HardHat,
  Users,
  CalendarRange,
  ListChecks,
  Wallet,
  UsersRound,
  FolderOpen,
  NotebookPen,
  Camera,
  Ruler,
  Calculator,
  FileBarChart,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export type ItemNav = {
  rotulo: string
  para: string
  icone: LucideIcon
  /** aparece na barra inferior do celular */
  principal?: boolean
  /** módulo ainda não construído: mostra "em breve" */
  emBreve?: boolean
}

export const itensNav: ItemNav[] = [
  { rotulo: 'Início', para: '/', icone: LayoutDashboard, principal: true },
  { rotulo: 'Obras', para: '/obras', icone: HardHat, principal: true, emBreve: true },
  { rotulo: 'Clientes', para: '/clientes', icone: Users, emBreve: true },
  { rotulo: 'Cronograma', para: '/cronograma', icone: CalendarRange, principal: true, emBreve: true },
  { rotulo: 'Etapas', para: '/etapas', icone: ListChecks, emBreve: true },
  { rotulo: 'Financeiro', para: '/financeiro', icone: Wallet, principal: true, emBreve: true },
  { rotulo: 'Equipe', para: '/equipe', icone: UsersRound, emBreve: true },
  { rotulo: 'Documentos', para: '/documentos', icone: FolderOpen, emBreve: true },
  { rotulo: 'Diário de obra', para: '/diario', icone: NotebookPen, emBreve: true },
  { rotulo: 'Fotos', para: '/fotos', icone: Camera, emBreve: true },
  { rotulo: 'Quantitativos', para: '/quantitativos', icone: Ruler, emBreve: true },
  { rotulo: 'Orçamento', para: '/orcamento', icone: Calculator, emBreve: true },
  { rotulo: 'Relatórios', para: '/relatorios', icone: FileBarChart, emBreve: true },
]

export const itemConfiguracoes: ItemNav = { rotulo: 'Configurações', para: '/configuracoes', icone: Settings }
