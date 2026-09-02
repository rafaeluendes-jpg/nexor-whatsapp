import wordmark from '@/shared/assets/marca/r2on-wordmark.png'
import lockup from '@/shared/assets/marca/r2on-lockup.png'
import simbolo from '@/shared/assets/marca/r2on-simbolo.png'
import { cn } from '@/shared/lib/utils'

export const NOME_APP = 'R2ON'
export const TAGLINE = 'Gestão inteligente de obras'

type Props = { className?: string; alt?: string }

/** "R2ON" em branco e laranja. Só funciona sobre fundo escuro. */
export function LogoWordmark({ className, alt = NOME_APP }: Props) {
  return <img src={wordmark} alt={alt} draggable={false} className={cn('h-8 w-auto select-none', className)} />
}

/** Logo completa com a frase "Gestão inteligente de obras". Fundo escuro. */
export function LogoLockup({ className, alt = `${NOME_APP} · ${TAGLINE}` }: Props) {
  return <img src={lockup} alt={alt} draggable={false} className={cn('h-14 w-auto select-none', className)} />
}

/** Só o símbolo (o "O" com os prédios). Fundo escuro. */
export function LogoSimbolo({ className, alt = NOME_APP }: Props) {
  return <img src={simbolo} alt={alt} draggable={false} className={cn('h-8 w-auto select-none', className)} />
}
