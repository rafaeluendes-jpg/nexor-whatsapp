import { Link } from 'react-router'
import { HardHat, Plus, Users, TriangleAlert, CheckCircle2 } from 'lucide-react'
import { usePerfil, useOrganizacaoAtual } from '@/modules/auth/hooks/use-perfil'
import { useObras, useResumoObras } from '@/modules/obras/api/obras-api'
import { ObraCard } from '@/modules/obras/components/obra-card'
import { useClientes } from '@/modules/clientes/api/clientes-api'
import { CabecalhoPagina } from '@/shared/components/layout/cabecalho-pagina'
import { EstadoVazio } from '@/shared/components/comuns/estado-vazio'
import { Button } from '@/shared/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { diasAte } from '@/shared/lib/formatos'

export function DashboardPage() {
  const { data: perfil, isLoading: carregandoPerfil } = usePerfil()
  const { organizacao, podeGerir } = useOrganizacaoAtual()
  const { data: resumo, isLoading: carregandoResumo } = useResumoObras()
  const { data: obras, isLoading: carregandoObras } = useObras()
  const { data: clientes } = useClientes()
  const primeiroNome = perfil?.nome?.split(' ')[0]

  const emExecucao = resumo?.porStatus.em_execucao ?? 0
  const concluidas = resumo?.porStatus.concluida ?? 0
  // Atrasada: marcada como atrasada OU com término previsto já vencido e ainda em andamento.
  const atrasadas =
    obras?.filter((o) => {
      if (o.status === 'concluida' || o.status === 'cancelada') return false
      if (o.status === 'atrasada') return true
      const d = diasAte(o.data_fim_prevista)
      return d !== null && d < 0
    }).length ?? 0

  const cartoes = [
    { rotulo: 'Obras ativas', valor: resumo?.total ?? 0, detalhe: `${emExecucao} em execução`, para: '/obras' },
    { rotulo: 'Em atraso', valor: atrasadas, detalhe: atrasadas ? 'Precisa de atenção' : 'Tudo no prazo', para: '/obras', alerta: atrasadas > 0 },
    { rotulo: 'Concluídas', valor: concluidas, detalhe: 'Histórico guardado', para: '/obras' },
    { rotulo: 'Clientes', valor: clientes?.length ?? 0, detalhe: 'Cadastrados', para: '/clientes' },
  ]

  const recentes = obras?.slice(0, 6) ?? []

  return (
    <>
      <CabecalhoPagina
        titulo={carregandoPerfil || !primeiroNome ? 'Olá!' : `Olá, ${primeiroNome}!`}
        descricao={organizacao?.nome ? `Painel de ${organizacao.nome}.` : 'Seu painel de obras.'}
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

      <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {carregandoResumo
          ? [1, 2, 3, 4].map((n) => <Skeleton key={n} className="h-28 rounded-xl" />)
          : cartoes.map((c) => (
              <Link key={c.rotulo} to={c.para}>
                <Card className="py-5 gap-1 h-full transition-shadow hover:shadow-md">
                  <CardHeader className="px-5">
                    <CardDescription>{c.rotulo}</CardDescription>
                    <CardTitle className="text-3xl tabular-nums">{c.valor}</CardTitle>
                    <p className={`text-xs mt-1 flex items-center gap-1 ${c.alerta ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {c.alerta ? <TriangleAlert className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                      {c.detalhe}
                    </p>
                  </CardHeader>
                </Card>
              </Link>
            ))}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Obras recentes</h2>
        {!!recentes.length && (
          <Button asChild variant="ghost" size="sm">
            <Link to="/obras">Ver todas</Link>
          </Button>
        )}
      </div>

      {carregandoObras ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : !recentes.length ? (
        <EstadoVazio
          icone={HardHat}
          titulo="Comece cadastrando sua primeira obra"
          texto="Depois é só ir preenchendo: cliente, prazos, equipe, pagamentos e fotos ficam todos na pasta da obra."
          acao={
            podeGerir && (
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button asChild>
                  <Link to="/obras/nova">
                    <HardHat /> Cadastrar obra
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/clientes/novo">
                    <Users /> Cadastrar cliente
                  </Link>
                </Button>
              </div>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {recentes.map((o) => (
            <ObraCard key={o.id} obra={o} />
          ))}
        </div>
      )}
    </>
  )
}
