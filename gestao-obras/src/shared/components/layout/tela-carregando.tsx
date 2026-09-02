import { LogoSimbolo } from '@/shared/components/marca/logo'

export function TelaCarregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="min-h-dvh grid place-items-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="size-14 rounded-2xl bg-carvao grid place-items-center animate-pulse">
          <LogoSimbolo className="h-8" />
        </div>
        <p className="text-sm text-muted-foreground">{texto}</p>
      </div>
    </div>
  )
}
