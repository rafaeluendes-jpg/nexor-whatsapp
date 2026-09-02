import { Link } from 'react-router'
import { CalendarDays, MapPin, User } from 'lucide-react'
import { diasAte, enderecoResumo, formatarData, formatarMoeda, type Endereco } from '@/shared/lib/formatos'
import { cn } from '@/shared/lib/utils'
import type { Obra } from '../api/obras-api'
import { StatusObraBadge } from './status-obra-badge'

export function PrazoObra({ obra, className }: { obra: Obra; className?: string }) {
  if (obra.status === 'concluida' || obra.status === 'cancelada') return null
  const dias = diasAte(obra.data_fim_prevista)
  if (dias === null) return null
  const texto = dias < 0 ? `${Math.abs(dias)} dia${Math.abs(dias) === 1 ? '' : 's'} de atraso` : dias === 0 ? 'Termina hoje' : `${dias} dia${dias === 1 ? '' : 's'} restantes`
  return <span className={cn('text-xs font-medium', dias < 0 ? 'text-destructive' : dias <= 7 ? 'text-brand' : 'text-muted-foreground', className)}>{texto}</span>
}

export function ObraCard({ obra }: { obra: Obra }) {
  const endereco = enderecoResumo(obra.endereco as Endereco)
  return (
    <Link
      to={`/obras/${obra.id}`}
      className="group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-shadow hover:shadow-md active:bg-muted/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {obra.codigo && <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{obra.codigo}</p>}
          <p className="font-semibold leading-snug group-hover:text-brand line-clamp-2">{obra.nome}</p>
        </div>
        <StatusObraBadge status={obra.status} />
      </div>
      <div className="space-y-1.5 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 truncate">
          <User className="size-4 shrink-0" /> {obra.clientes?.nome ?? 'Sem cliente'}
        </p>
        {endereco && (
          <p className="flex items-center gap-2 truncate">
            <MapPin className="size-4 shrink-0" /> {endereco}
          </p>
        )}
        <p className="flex items-center gap-2">
          <CalendarDays className="size-4 shrink-0" />
          {formatarData(obra.data_inicio_prevista)} → {formatarData(obra.data_fim_prevista)}
        </p>
      </div>
      <div className="mt-auto flex items-center justify-between border-t pt-3">
        <span className="text-sm font-semibold tabular-nums">{formatarMoeda(obra.valor_contratado)}</span>
        <PrazoObra obra={obra} />
      </div>
    </Link>
  )
}
