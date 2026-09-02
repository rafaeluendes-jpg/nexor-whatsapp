import { Link, useNavigate, useParams } from 'react-router'
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarRange,
  Camera,
  ChevronDown,
  FolderOpen,
  ListChecks,
  MapPin,
  NotebookPen,
  Pencil,
  Trash2,
  User,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { CabecalhoPagina } from '@/shared/components/layout/cabecalho-pagina'
import { ConfirmarDialog } from '@/shared/components/comuns/confirmar-dialog'
import { NaoEncontrado } from '@/shared/components/comuns/nao-encontrado'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { traduzirErro } from '@/shared/lib/erros'
import { enderecoResumo, formatarData, formatarDataHora, formatarMoeda, formatarNumero, type Endereco } from '@/shared/lib/formatos'
import { useOrganizacaoAtual } from '@/modules/auth/hooks/use-perfil'
import { useAlterarStatusObra, useArquivarObra, useExcluirObra, useObra } from '../api/obras-api'
import { StatusObraBadge } from '../components/status-obra-badge'
import { PrazoObra } from '../components/obra-card'
import { STATUS_OBRA, statusObraInfo } from '../schemas'

const abasFuturas: { valor: string; rotulo: string; icone: LucideIcon; texto: string }[] = [
  { valor: 'cronograma', rotulo: 'Cronograma', icone: CalendarRange, texto: 'Etapas com datas previstas e realizadas, atraso e medição.' },
  { valor: 'etapas', rotulo: 'Etapas', icone: ListChecks, texto: 'O que foi executado, o que falta e fotos por etapa.' },
  { valor: 'financeiro', rotulo: 'Financeiro', icone: Wallet, texto: 'Parcelas, pagamentos com comprovante, diárias e faltas.' },
  { valor: 'equipe', rotulo: 'Equipe', icone: UsersRound, texto: 'Quem trabalha nesta obra, presença e diárias.' },
  { valor: 'documentos', rotulo: 'Documentos', icone: FolderOpen, texto: 'Contrato, aditivos, projeto e comprovantes.' },
  { valor: 'fotos', rotulo: 'Fotos', icone: Camera, texto: 'Evolução da obra, antes e depois, por etapa e ambiente.' },
  { valor: 'diario', rotulo: 'Diário', icone: NotebookPen, texto: 'Ocorrências, imprevistos e alterações pedidas pelo cliente.' },
]

function Dado({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="font-medium">{valor}</p>
    </div>
  )
}

export function ObraDetalhePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: o, isLoading, isError } = useObra(id)
  const { podeGerir, ehAdmin } = useOrganizacaoAtual()
  const alterarStatus = useAlterarStatusObra()
  const arquivar = useArquivarObra()
  const excluir = useExcluirObra()

  if (isLoading) return <Skeleton className="h-96" />
  if (isError || !o?.id)
    return (
      <NaoEncontrado
        titulo="Obra não encontrada"
        texto="Ela pode ter sido excluída, ou você não tem permissão para vê-la."
        voltarPara="/obras"
        voltarRotulo="Voltar para obras"
      />
    )
  const endereco = enderecoResumo(o.endereco as Endereco)
  const arquivada = !!o.arquivada_em

  return (
    <>
      <Link to="/obras" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Obras
      </Link>
      <CabecalhoPagina
        titulo={o.nome}
        descricao={[o.codigo, o.clientes?.nome].filter(Boolean).join(' · ') || undefined}
        acoes={
          podeGerir && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <StatusObraBadge status={o.status} className="pointer-events-none" />
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Mudar status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {STATUS_OBRA.map((s) => (
                    <DropdownMenuItem
                      key={s}
                      disabled={s === o.status}
                      onClick={() =>
                        alterarStatus.mutate(
                          { id: o.id, status: s },
                          {
                            onSuccess: () => toast.success(`Obra marcada como ${statusObraInfo[s].rotulo.toLowerCase()}.`),
                            onError: (e) => toast.error(traduzirErro(e, 'Não foi possível alterar o status.')),
                          },
                        )
                      }
                    >
                      {statusObraInfo[s].rotulo}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button asChild variant="outline">
                <Link to={`/obras/${o.id}/editar`}>
                  <Pencil /> Editar
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Mais ações">
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      arquivar.mutate(
                        { id: o.id, arquivar: !arquivada },
                        {
                          onSuccess: () => toast.success(arquivada ? 'Obra restaurada.' : 'Obra arquivada.'),
                          onError: (e) => toast.error(traduzirErro(e)),
                        },
                      )
                    }
                  >
                    {arquivada ? <ArchiveRestore /> : <Archive />}
                    {arquivada ? 'Restaurar' : 'Arquivar'}
                  </DropdownMenuItem>
                  {ehAdmin && (
                    <ConfirmarDialog
                      gatilho={
                        <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
                          <Trash2 /> Excluir obra
                        </DropdownMenuItem>
                      }
                      titulo="Excluir esta obra?"
                      descricao="Tudo que estiver dentro da pasta desta obra será apagado. Prefira arquivar se quiser manter o histórico."
                      textoConfirmar="Excluir definitivamente"
                      destrutivo
                      aoConfirmar={() =>
                        excluir.mutateAsync(o.id).then(
                          () => {
                            toast.success('Obra excluída.')
                            navigate('/obras', { replace: true })
                          },
                          (err) => toast.error(traduzirErro(err, 'Não foi possível excluir.')),
                        )
                      }
                    />
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )
        }
      />

      {arquivada && (
        <Alert className="mb-6">
          <Archive />
          <AlertTitle>Obra arquivada</AlertTitle>
          <AlertDescription>Arquivada em {formatarDataHora(o.arquivada_em)}. Ela não aparece na lista principal, mas todo o histórico continua aqui.</AlertDescription>
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Card className="py-5 gap-1">
          <CardHeader className="px-5">
            <CardDescription>Valor contratado</CardDescription>
            <CardTitle className="text-xl sm:text-2xl tabular-nums">{formatarMoeda(o.valor_contratado)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="py-5 gap-1">
          <CardHeader className="px-5">
            <CardDescription>Prazo</CardDescription>
            <CardTitle className="text-xl sm:text-2xl">
              <PrazoObra obra={o} className="text-xl sm:text-2xl" /> {o.status === 'concluida' && 'Concluída'}
              {!o.data_fim_prevista && o.status !== 'concluida' && <span className="text-muted-foreground">Sem data</span>}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="py-5 gap-1">
          <CardHeader className="px-5">
            <CardDescription>Área</CardDescription>
            <CardTitle className="text-xl sm:text-2xl tabular-nums">{formatarNumero(o.area_m2, ' m²')}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="py-5 gap-1">
          <CardHeader className="px-5">
            <CardDescription>Responsável</CardDescription>
            <CardTitle className="text-xl sm:text-2xl truncate">{o.responsavel?.nome ?? '—'}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="visao">
        <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
          <TabsList className="w-max">
            <TabsTrigger value="visao">Visão geral</TabsTrigger>
            {abasFuturas.map((a) => (
              <TabsTrigger key={a.valor} value={a.valor}>
                <a.icone /> {a.rotulo}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="visao" className="grid gap-6 lg:grid-cols-2 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Dados da obra</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Dado rotulo="Cliente" valor={o.clientes ? <Link className="hover:underline inline-flex items-center gap-1" to={`/clientes/${o.clientes.id}`}><User className="size-4" />{o.clientes.nome}</Link> : 'Sem cliente'} />
              <Dado rotulo="Status" valor={<StatusObraBadge status={o.status} />} />
              <Dado rotulo="Início previsto" valor={formatarData(o.data_inicio_prevista)} />
              <Dado rotulo="Término previsto" valor={formatarData(o.data_fim_prevista)} />
              <Dado rotulo="Início real" valor={formatarData(o.data_inicio_real)} />
              <Dado rotulo="Término real" valor={formatarData(o.data_fim_real)} />
              <div className="sm:col-span-2">
                <Dado rotulo="Endereço" valor={endereco ? <span className="inline-flex items-start gap-1"><MapPin className="size-4 mt-0.5 shrink-0" />{endereco}</span> : '—'} />
              </div>
              <Dado rotulo="Criada em" valor={formatarDataHora(o.criado_em)} />
              <Dado rotulo="Última atualização" valor={formatarDataHora(o.atualizado_em)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Descrição / escopo</CardTitle>
            </CardHeader>
            <CardContent>
              {o.descricao ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{o.descricao}</p> : <p className="text-sm text-muted-foreground">Nenhuma descrição informada.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {abasFuturas.map((a) => (
          <TabsContent key={a.valor} value={a.valor} className="mt-4">
            <div className="rounded-xl border border-dashed p-10 text-center space-y-3">
              <div className="mx-auto size-12 rounded-xl bg-muted grid place-items-center">
                <a.icone className="size-6 text-muted-foreground" />
              </div>
              <p className="font-medium">{a.rotulo} desta obra</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">{a.texto} Este módulo é a próxima etapa da construção.</p>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </>
  )
}
