import { HardHat } from 'lucide-react'

export function TelaCarregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="min-h-dvh grid place-items-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="size-12 rounded-xl bg-primary text-primary-foreground grid place-items-center animate-pulse">
          <HardHat className="size-6" />
        </div>
        <p className="text-sm text-muted-foreground">{texto}</p>
      </div>
    </div>
  )
}
