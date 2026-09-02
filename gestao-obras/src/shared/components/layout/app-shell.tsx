import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { LogOut, Menu, MoreHorizontal, Settings, User } from 'lucide-react'
import { LogoWordmark, TAGLINE } from '@/shared/components/marca/logo'
import { useAuth } from '@/modules/auth/hooks/use-auth'
import { useMinhasOrganizacoes, usePerfil } from '@/modules/auth/hooks/use-perfil'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle } from '@/shared/components/ui/sheet'
import { Badge } from '@/shared/components/ui/badge'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { cn } from '@/shared/lib/utils'
import { itemConfiguracoes, itensNav, type ItemNav } from './nav-items'

function iniciais(nome?: string) {
  if (!nome) return '?'
  const partes = nome.trim().split(/\s+/)
  return (partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')
}

function LinkNav({ item, aoNavegar, compacto }: { item: ItemNav; aoNavegar?: () => void; compacto?: boolean }) {
  const Icone = item.icone
  return (
    <NavLink
      to={item.para}
      end={item.para === '/'}
      onClick={aoNavegar}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground',
          isActive && 'bg-sidebar-accent text-sidebar-foreground shadow-inner',
          compacto && 'justify-center px-2',
        )
      }
    >
      <Icone className="size-5 shrink-0" />
      {!compacto && <span className="flex-1 truncate">{item.rotulo}</span>}
      {!compacto && item.emBreve && (
        <span className="text-[10px] uppercase tracking-wide text-sidebar-foreground/40">em breve</span>
      )}
    </NavLink>
  )
}

function MenuLateral({ aoNavegar }: { aoNavegar?: () => void }) {
  const { data: orgs } = useMinhasOrganizacoes()
  const org = orgs?.[0]?.organizacoes
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 h-16 border-b border-sidebar-border flex items-center">
        <LogoWordmark className="h-7" />
      </div>
      <div className="px-5 py-3 border-b border-sidebar-border">
        <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/45">Conta</p>
        <p className="font-medium text-sm leading-tight truncate">{org?.nome ?? TAGLINE}</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {itensNav.map((item) => (
          <LinkNav key={item.para} item={item} aoNavegar={aoNavegar} />
        ))}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <LinkNav item={itemConfiguracoes} aoNavegar={aoNavegar} />
      </div>
    </div>
  )
}

function MenuUsuario() {
  const { user, sair } = useAuth()
  const { data: perfil, isLoading } = usePerfil()
  const navigate = useNavigate()
  if (isLoading) return <Skeleton className="size-9 rounded-full" />
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" aria-label="Menu do usuário">
          <Avatar className="size-9 border">
            <AvatarImage src={perfil?.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="bg-primary text-primary-foreground">{iniciais(perfil?.nome)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="font-medium truncate">{perfil?.nome}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
          <User /> Meu perfil
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
          <Settings /> Configurações
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => sair()}>
          <LogOut /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function BarraInferior({ abrirMenu }: { abrirMenu: () => void }) {
  const principais = itensNav.filter((i) => i.principal).slice(0, 4)
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur safe-bottom">
      <ul className="grid grid-cols-5">
        {principais.map((item) => {
          const Icone = item.icone
          return (
            <li key={item.para}>
              <NavLink
                to={item.para}
                end={item.para === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 py-2 text-[11px] font-medium text-muted-foreground',
                    isActive && 'text-primary',
                  )
                }
              >
                <Icone className="size-5" />
                {item.rotulo}
              </NavLink>
            </li>
          )
        })}
        <li>
          <button
            onClick={abrirMenu}
            className="w-full flex flex-col items-center gap-1 py-2 text-[11px] font-medium text-muted-foreground"
          >
            <MoreHorizontal className="size-5" />
            Mais
          </button>
        </li>
      </ul>
    </nav>
  )
}

export function AppShell() {
  const [menuAberto, setMenuAberto] = useState(false)
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar fixa: desktop */}
      <aside className="hidden lg:block sticky top-0 h-dvh">
        <MenuLateral />
      </aside>

      {/* Menu deslizante: celular */}
      <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
        <SheetContent side="left" className="p-0 w-[280px] bg-sidebar border-sidebar-border [&>button]:text-sidebar-foreground">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <MenuLateral aoNavegar={() => setMenuAberto(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur safe-top lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">
            <Menu />
          </Button>
          <div className="flex-1 min-w-0" id="cabecalho-pagina" />
          <Badge variant="outline" className="hidden sm:inline-flex gap-1.5">
            <span className="size-1.5 rounded-full bg-success" /> Conexão segura
          </Badge>
          <MenuUsuario />
        </header>
        <main className="flex-1 px-4 py-6 pb-24 lg:px-8 lg:pb-8">
          <Outlet />
        </main>
      </div>

      <BarraInferior abrirMenu={() => setMenuAberto(true)} />
    </div>
  )
}
