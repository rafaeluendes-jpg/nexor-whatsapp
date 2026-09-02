import { Outlet } from 'react-router'
import { HardHat, ShieldCheck, FolderLock, Smartphone } from 'lucide-react'

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
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_20%_20%,white,transparent_45%),radial-gradient(circle_at_80%_70%,white,transparent_40%)]" />
        <div className="relative flex items-center gap-3">
          <div className="size-11 rounded-xl bg-brand text-brand-foreground grid place-items-center shadow-lg shadow-brand/30">
            <HardHat className="size-6" />
          </div>
          <div>
            <p className="font-semibold text-lg leading-tight">Gestão de Obras</p>
            <p className="text-xs text-sidebar-foreground/70">Gestão inteligente da construção</p>
          </div>
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
        <p className="relative text-xs text-sidebar-foreground/50">© {new Date().getFullYear()} · Dados protegidos com criptografia e controle de acesso por obra.</p>
      </aside>

      {/* Formulário */}
      <main className="flex flex-col safe-top safe-bottom">
        <header className="lg:hidden flex items-center gap-3 px-6 pt-8">
          <div className="size-10 rounded-xl bg-primary text-primary-foreground grid place-items-center">
            <HardHat className="size-5" />
          </div>
          <div>
            <p className="font-semibold leading-tight">Gestão de Obras</p>
            <p className="text-xs text-muted-foreground">Gestão inteligente da construção</p>
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
