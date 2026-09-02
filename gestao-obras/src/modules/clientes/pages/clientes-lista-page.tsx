import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Plus, Search, Users } from 'lucide-react'
import { CabecalhoPagina } from '@/shared/components/layout/cabecalho-pagina'
import { EstadoVazio } from '@/shared/components/comuns/estado-vazio'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { formatarDocumento, formatarTelefone, iniciais, type Endereco } from '@/shared/lib/formatos'
import { useOrganizacaoAtual } from '@/modules/auth/hooks/use-perfil'
import { useClientes } from '../api/clientes-api'

export function ClientesListaPage() {
  const [busca, setBusca] = useState('')
  const { data, isLoading } = useClientes(busca)
  const { podeGerir } = useOrganizacaoAtual()
  const navigate = useNavigate()

  return (
    <>
      <CabecalhoPagina
        titulo="Clientes"
        descricao="Quem contrata as obras. Cada cliente pode ter várias obras."
        acoes={
          podeGerir && (
            <Button asChild>
              <Link to="/clientes/novo">
                <Plus /> Novo cliente
              </Link>
            </Button>
          )
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome, e-mail ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-16" />
          ))}
        </div>
      ) : !data?.length ? (
        <EstadoVazio
          icone={Users}
          titulo={busca ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda'}
          texto={busca ? 'Tente outro termo.' : 'Cadastre o primeiro cliente para vincular às obras.'}
          acao={
            !busca &&
            podeGerir && (
              <Button asChild>
                <Link to="/clientes/novo">
                  <Plus /> Cadastrar cliente
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Celular: cartões */}
          <ul className="grid gap-3 md:hidden">
            {data.map((c) => (
              <li key={c.id}>
                <Link to={`/clientes/${c.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-4 active:bg-muted">
                  <Avatar className="size-10">
                    <AvatarFallback>{iniciais(c.nome)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{c.nome}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {formatarTelefone(c.telefone)}
                      {c.email ? ` · ${c.email}` : ''}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {/* Computador: tabela */}
          <div className="hidden md:block rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Cidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((c) => {
                  const e = c.endereco as Endereco
                  return (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/clientes/${c.id}`)}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarFallback>{iniciais(c.nome)}</AvatarFallback>
                          </Avatar>
                          {c.nome}
                        </div>
                      </TableCell>
                      <TableCell>{formatarTelefone(c.telefone)}</TableCell>
                      <TableCell className="text-muted-foreground">{c.email ?? '—'}</TableCell>
                      <TableCell className="tabular-nums">{formatarDocumento(c.documento)}</TableCell>
                      <TableCell className="text-muted-foreground">{e?.cidade ? `${e.cidade}${e.uf ? '/' + e.uf : ''}` : '—'}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </>
  )
}
