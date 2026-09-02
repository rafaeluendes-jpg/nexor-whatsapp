import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, HardHat, Mail, MapPin, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { CabecalhoPagina } from '@/shared/components/layout/cabecalho-pagina'
import { EstadoVazio } from '@/shared/components/comuns/estado-vazio'
import { ConfirmarDialog } from '@/shared/components/comuns/confirmar-dialog'
import { NaoEncontrado } from '@/shared/components/comuns/nao-encontrado'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { traduzirErro } from '@/shared/lib/erros'
import { enderecoResumo, formatarDocumento, formatarTelefone, type Endereco } from '@/shared/lib/formatos'
import { useOrganizacaoAtual } from '@/modules/auth/hooks/use-perfil'
import { useObras } from '@/modules/obras/api/obras-api'
import { StatusObraBadge } from '@/modules/obras/components/status-obra-badge'
import { useCliente, useExcluirCliente } from '../api/clientes-api'

export function ClienteDetalhePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: c, isLoading, isError } = useCliente(id)
  const { data: obras } = useObras({ clienteId: id })
  const { podeGerir, ehAdmin } = useOrganizacaoAtual()
  const excluir = useExcluirCliente()

  if (isLoading) return <Skeleton className="h-96" />
  if (isError || !c?.id)
    return (
      <NaoEncontrado
        titulo="Cliente não encontrado"
        texto="Ele pode ter sido excluído, ou você não tem permissão para vê-lo."
        voltarPara="/clientes"
        voltarRotulo="Voltar para clientes"
      />
    )
  const e = c.endereco as Endereco
  const endereco = enderecoResumo(e)

  return (
    <>
      <Link to="/clientes" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Clientes
      </Link>
      <CabecalhoPagina
        titulo={c.nome}
        descricao={c.documento ? formatarDocumento(c.documento) : undefined}
        acoes={
          podeGerir && (
            <>
              <Button asChild variant="outline">
                <Link to={`/clientes/${c.id}/editar`}>
                  <Pencil /> Editar
                </Link>
              </Button>
              {ehAdmin && (
                <ConfirmarDialog
                  gatilho={
                    <Button variant="ghost" className="text-destructive hover:text-destructive">
                      <Trash2 /> Excluir
                    </Button>
                  }
                  titulo="Excluir cliente?"
                  descricao="As obras dele continuam existindo, mas ficam sem cliente vinculado. Esta ação não pode ser desfeita."
                  textoConfirmar="Excluir"
                  destrutivo
                  aoConfirmar={() =>
                    excluir.mutateAsync(c.id).then(
                      () => {
                        toast.success('Cliente excluído.')
                        navigate('/clientes', { replace: true })
                      },
                      (err) => toast.error(traduzirErro(err, 'Não foi possível excluir.')),
                    )
                  }
                />
              )}
            </>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>Contato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="flex items-center gap-2">
              <Phone className="size-4 text-muted-foreground" />
              {c.telefone ? (
                <a className="hover:underline" href={`https://wa.me/55${c.telefone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                  {formatarTelefone(c.telefone)}
                </a>
              ) : (
                '—'
              )}
            </p>
            <p className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" />
              {c.email ? <a className="hover:underline" href={`mailto:${c.email}`}>{c.email}</a> : '—'}
            </p>
            <p className="flex items-start gap-2">
              <MapPin className="size-4 mt-0.5 text-muted-foreground" />
              <span>{endereco || '—'}</span>
            </p>
            {c.observacoes && <p className="rounded-lg bg-muted p-3 text-muted-foreground whitespace-pre-wrap">{c.observacoes}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Obras deste cliente</CardTitle>
            {podeGerir && (
              <Button asChild size="sm" variant="outline">
                <Link to={`/obras/nova?cliente=${c.id}`}>
                  <Plus /> Nova obra
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!obras?.length ? (
              <EstadoVazio icone={HardHat} titulo="Nenhuma obra vinculada" />
            ) : (
              <ul className="divide-y">
                {obras.map((o) => (
                  <li key={o.id}>
                    <Link to={`/obras/${o.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-muted/50 -mx-2 px-2 rounded-lg">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{o.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">{enderecoResumo(o.endereco as Endereco) || o.codigo || ''}</p>
                      </div>
                      <StatusObraBadge status={o.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
