import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { CabecalhoPagina } from '@/shared/components/layout/cabecalho-pagina'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { NaoEncontrado } from '@/shared/components/comuns/nao-encontrado'
import { traduzirErro } from '@/shared/lib/erros'
import { enderecoVazio } from '@/shared/lib/schemas-comuns'
import { useCliente, useSalvarCliente } from '../api/clientes-api'
import { ClienteForm } from '../components/cliente-form'
import type { ClienteValores } from '../schemas'

export function ClienteFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: cliente, isLoading, isError } = useCliente(id)
  const salvar = useSalvarCliente()
  const editando = !!id

  if (editando && isLoading) return <Skeleton className="h-96" />
  if (editando && (isError || !cliente?.id))
    return (
      <NaoEncontrado
        titulo="Cliente não encontrado"
        texto="Ele pode ter sido excluído, ou você não tem permissão para editá-lo."
        voltarPara="/clientes"
        voltarRotulo="Voltar para clientes"
      />
    )

  const inicial: ClienteValores | undefined = cliente
    ? {
        nome: cliente.nome,
        telefone: cliente.telefone ?? '',
        email: cliente.email ?? '',
        documento: cliente.documento ?? '',
        endereco: { ...enderecoVazio, ...(cliente.endereco as object) },
        observacoes: cliente.observacoes ?? '',
      }
    : undefined

  return (
    <>
      <CabecalhoPagina titulo={editando ? 'Editar cliente' : 'Novo cliente'} descricao={editando ? cliente?.nome : 'Cadastre quem contrata a obra.'} />
      <div className="max-w-3xl">
        <ClienteForm
          inicial={inicial}
          salvando={salvar.isPending}
          aoCancelar={() => navigate(-1)}
          aoSalvar={(v) =>
            salvar.mutate(
              { id, valores: v },
              {
                onSuccess: (c) => {
                  toast.success(editando ? 'Cliente atualizado.' : 'Cliente cadastrado.')
                  navigate(`/clientes/${c.id}`, { replace: true })
                },
                onError: (e) => toast.error(traduzirErro(e, 'Não foi possível salvar o cliente.')),
              },
            )
          }
        />
      </div>
    </>
  )
}
