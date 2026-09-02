import { Outlet } from 'react-router'
import { ShieldCheck, FolderLock, Smartphone } from 'lucide-react'
import { LogoLockup, LogoWordmark, NOME_APP, TAGLINE } from '@/shared/components/marca/logo'

const destaques = [
  { icone: ShieldCheck, titulo: 'Segurança em primeiro lugar', texto: 'Cada obra é um cofre: só quem você autoriza vê.' },
  { icone: FolderLock, titulo: 'Arquivo completo da obra', texto: 'Contratos, fotos, pagamentos e diário em um só lugar, para sempre.' },
  { icone: Smartphone, titulo: 'No canteiro ou no escritório', texto: 'Funciona no celular como aplicativo e no computador em tela cheia.' },
]

export function AuthLayout() {
  return (
    <div className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr]">
      {/* Painel de marca: só no desktop */}
      <aside className="hidden lg:flex flex-col justify-between bg-sidebar text-sidebar-foreground p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07] bg-[linear-gradient(135deg,transparent_40%,#FF6A00_50%,transparent_60%)]" />
        <div className="relative">
          <LogoLockup className="h-20" />
        </div>
        <div className="relative space-y-8 max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Toda a sua obra organizada, do orçamento ao pós-obra.
          </h1>
          <ul className="space-y-5">
            {destaques.map(({ icone: Icone, titulo, texto }) => (
              <li key={titulo} className="flex gap-4">
                <div className="size-10 shrink-0 rounded-lg bg-sidebar-accent grid place-items-center">
                  <Icone className="size-5 text-brand" />
                </div>
                <div>
                  <p className="font-medium">{titulo}</p>
                  <p className="text-sm text-sidebar-foreground/70">{texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-sidebar-foreground/50">© {new Date().getFullYear()} {NOME_APP} · {TAGLINE}. Dados protegidos com criptografia e controle de acesso por obra.</p>
      </aside>

      {/* Formulário */}
      <main className="flex flex-col safe-top safe-bottom">
        <header className="lg:hidden px-6 pt-8">
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-carvao px-4 py-4">
            <LogoWordmark className="h-8" />
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/75 whitespace-nowrap">
              <span className="text-brand">—</span> {TAGLINE} <span className="text-brand">—</span>
            </p>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-sm">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
