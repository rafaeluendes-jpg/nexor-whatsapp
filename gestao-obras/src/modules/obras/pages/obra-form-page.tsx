import { useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { CabecalhoPagina } from '@/shared/components/layout/cabecalho-pagina'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { NaoEncontrado } from '@/shared/components/comuns/nao-encontrado'
import { traduzirErro } from '@/shared/lib/erros'
import { enderecoVazio } from '@/shared/lib/schemas-comuns'
import { useObra, useSalvarObra } from '../api/obras-api'
import { ObraForm } from '../components/obra-form'
import { obraVazia, type ObraValores } from '../schemas'

export function ObraFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { data: obra, isLoading, isError } = useObra(id)
  const salvar = useSalvarObra()
  const editando = !!id

  if (editando && isLoading) return <Skeleton className="h-96" />
  if (editando && (isError || !obra?.id))
    return (
      <NaoEncontrado
        titulo="Obra não encontrada"
        texto="Ela pode ter sido excluída, ou você não tem permissão para editá-la."
        voltarPara="/obras"
        voltarRotulo="Voltar para obras"
      />
    )

  const inicial: ObraValores = obra
    ? {
        nome: obra.nome,
        codigo: obra.codigo ?? '',
        cliente_id: obra.cliente_id ?? '',
        responsavel_id: obra.responsavel_id ?? '',
        status: obra.status,
        descricao: obra.descricao ?? '',
        endereco: { ...enderecoVazio, ...(obra.endereco as object) },
        area_m2: obra.area_m2,
        valor_contratado: obra.valor_contratado,
        data_inicio_prevista: obra.data_inicio_prevista ?? '',
        data_fim_prevista: obra.data_fim_prevista ?? '',
        data_inicio_real: obra.data_inicio_real ?? '',
        data_fim_real: obra.data_fim_real ?? '',
      }
    : { ...obraVazia, cliente_id: params.get('cliente') ?? '' }

  return (
    <>
      <CabecalhoPagina titulo={editando ? 'Editar obra' : 'Nova obra'} descricao={editando ? obra?.nome : 'Abra a pasta de uma nova obra.'} />
      <div className="max-w-4xl">
        <ObraForm
          inicial={inicial}
          editando={editando}
          salvando={salvar.isPending}
          aoCancelar={() => navigate(-1)}
          aoSalvar={(v) =>
            salvar.mutate(
              { id, valores: v },
              {
                onSuccess: (o) => {
                  toast.success(editando ? 'Obra atualizada.' : 'Obra criada.')
                  navigate(`/obras/${o.id}`, { replace: true })
                },
                onError: (e) =>
                  toast.error(
                    /obras_codigo_unico/.test(String((e as Error).message))
                      ? 'Já existe uma obra com esse código.'
                      : traduzirErro(e, 'Não foi possível salvar a obra.'),
                  ),
              },
            )
          }
        />
      </div>
    </>
  )
}
