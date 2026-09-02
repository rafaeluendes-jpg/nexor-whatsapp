import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export function EstadoVazio({ icone: Icone, titulo, texto, acao }: { icone: LucideIcon; titulo: string; texto?: string; acao?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center space-y-3">
      <div className="mx-auto size-12 rounded-xl bg-muted grid place-items-center">
        <Icone className="size-6 text-muted-foreground" />
      </div>
      <p className="font-medium">{titulo}</p>
      {texto && <p className="text-sm text-muted-foreground max-w-sm mx-auto">{texto}</p>}
      {acao && <div className="pt-2">{acao}</div>}
    </div>
  )
}
