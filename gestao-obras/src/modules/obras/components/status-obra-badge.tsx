import { Badge } from '@/shared/components/ui/badge'
import { statusObraInfo, type StatusObra } from '../schemas'

/** Nunca quebra a tela: status desconhecido vira um rótulo neutro. */
export function StatusObraBadge({ status, className }: { status: StatusObra | string; className?: string }) {
  const info = statusObraInfo[status as StatusObra] ?? { rotulo: String(status ?? '—'), variante: 'secondary' as const }
  return (
    <Badge variant={info.variante} className={className}>
      {info.rotulo}
    </Badge>
  )
}
