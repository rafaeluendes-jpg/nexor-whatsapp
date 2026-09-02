import { useState } from 'react'
import { Link } from 'react-router'
import { Archive, HardHat, Plus, Search } from 'lucide-react'
import { CabecalhoPagina } from '@/shared/components/layout/cabecalho-pagina'
import { EstadoVazio } from '@/shared/components/comuns/estado-vazio'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { cn } from '@/shared/lib/utils'
import { useOrganizacaoAtual } from '@/modules/auth/hooks/use-perfil'
import { useObras } from '../api/obras-api'
import { ObraCard } from '../components/obra-card'
import { STATUS_OBRA, statusObraInfo, type StatusObra } from '../schemas'

export function ObrasListaPage() {
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState<StatusObra | 'todas'>('todas')
  const [arquivadas, setArquivadas] = useState(false)
  const { data, isLoading } = useObras({ busca, status, arquivadas })
  const { podeGerir } = useOrganizacaoAtual()

  return (
    <>
      <CabecalhoPagina
        titulo="Obras"
        descricao="Cada obra é uma pasta completa: contrato, cronograma, financeiro, fotos e diário."
        acoes={
          podeGerir && (
            <Button asChild>
              <Link to="/obras/nova">
                <Plus /> Nova obra
              </Link>
            </Button>
          )
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome ou código" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusObra | 'todas')}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos os status</SelectItem>
            {STATUS_OBRA.map((s) => (
              <SelectItem key={s} value={s}>
                {statusObraInfo[s].rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant={arquivadas ? 'secondary' : 'ghost'} size="sm" className={cn('sm:ml-auto', arquivadas && 'ring-1 ring-border')} onClick={() => setArquivadas((v) => !v)}>
          <Archive /> {arquivadas ? 'Vendo arquivadas' : 'Arquivadas'}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : !data?.length ? (
        <EstadoVazio
          icone={HardHat}
          titulo={arquivadas ? 'Nenhuma obra arquivada' : busca || status !== 'todas' ? 'Nenhuma obra encontrada' : 'Nenhuma obra cadastrada'}
          texto={!arquivadas && !busca && status === 'todas' ? 'Crie a primeira obra para começar a organizar contrato, prazos e pagamentos.' : undefined}
          acao={
            !arquivadas &&
            !busca &&
            status === 'todas' &&
            podeGerir && (
              <Button asChild>
                <Link to="/obras/nova">
                  <Plus /> Criar primeira obra
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((o) => (
            <ObraCard key={o.id} obra={o} />
          ))}
        </div>
      )}
    </>
  )
}
