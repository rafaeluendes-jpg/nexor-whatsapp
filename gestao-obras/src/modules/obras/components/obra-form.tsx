import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { CamposEndereco } from '@/shared/components/comuns/campos-endereco'
import { InputMoeda } from '@/shared/components/comuns/input-moeda'
import { useClientes } from '@/modules/clientes/api/clientes-api'
import { ClienteRapidoDialog } from '@/modules/clientes/components/cliente-rapido-dialog'
import { useMembrosOrganizacao } from '../api/obras-api'
import { obraSchema, obraVazia, STATUS_OBRA, statusObraInfo, type ObraValores } from '../schemas'

const NENHUM = '__nenhum__'

type Props = {
  inicial?: ObraValores
  editando?: boolean
  salvando?: boolean
  aoSalvar: (v: ObraValores) => void
  aoCancelar?: () => void
}

export function ObraForm({ inicial, editando, salvando, aoSalvar, aoCancelar }: Props) {
  const form = useForm<ObraValores>({
    resolver: zodResolver(obraSchema),
    defaultValues: inicial ?? obraVazia,
  })
  const { data: clientes } = useClientes()
  const { data: membros } = useMembrosOrganizacao()

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(aoSalvar)} className="space-y-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Identificação</CardTitle>
            <CardDescription>Como a obra aparece nas listas e nos relatórios.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-6">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem className="sm:col-span-4">
                  <FormLabel>Nome da obra *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex.: Residência Silva — Reforma completa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="codigo"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Código interno</FormLabel>
                  <FormControl>
                    <Input placeholder="OB-2026-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cliente_id"
              render={({ field }) => (
                <FormItem className="sm:col-span-3">
                  <div className="flex items-center justify-between">
                    <FormLabel>Cliente</FormLabel>
                    <ClienteRapidoDialog aoCriar={(c) => field.onChange(c.id)} />
                  </div>
                  <Select onValueChange={(v) => field.onChange(v === NENHUM ? '' : v)} value={field.value || NENHUM}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NENHUM}>Sem cliente por enquanto</SelectItem>
                      {clientes?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="responsavel_id"
              render={({ field }) => (
                <FormItem className="sm:col-span-3">
                  <FormLabel>Responsável</FormLabel>
                  <Select onValueChange={(v) => field.onChange(v === NENHUM ? '' : v)} value={field.value || NENHUM}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Quem responde pela obra" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NENHUM}>Não definido</SelectItem>
                      {membros?.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STATUS_OBRA.map((s) => (
                        <SelectItem key={s} value={s}>
                          {statusObraInfo[s].rotulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="valor_contratado"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Valor contratado</FormLabel>
                  <FormControl>
                    <InputMoeda value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="area_m2"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Área (m²)</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      placeholder="0"
                      name={field.name}
                      onBlur={field.onBlur}
                      value={field.value ?? ''}
                      onChange={(e) => {
                        const v = e.target.value.replace(',', '.')
                        field.onChange(v === '' ? null : Number(v))
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem className="sm:col-span-6">
                  <FormLabel>Descrição / escopo</FormLabel>
                  <FormControl>
                    <Textarea placeholder="O que será executado, observações do contrato, particularidades do terreno…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prazos</CardTitle>
            <CardDescription>O cronograma detalhado vem no módulo de etapas. Aqui é a visão geral.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-4">
            <FormField
              control={form.control}
              name="data_inicio_prevista"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Início previsto</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="data_fim_prevista"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Término previsto</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {editando && (
              <>
                <FormField
                  control={form.control}
                  name="data_inicio_real"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Início real</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormDescription>Preenchido ao iniciar a obra.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="data_fim_real"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Término real</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormDescription>Preenchido ao concluir.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Endereço da obra</CardTitle>
            <CardDescription>Onde a equipe vai trabalhar.</CardDescription>
          </CardHeader>
          <CardContent>
            <CamposEndereco<ObraValores> prefixo="endereco" />
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {aoCancelar && (
            <Button type="button" variant="outline" onClick={aoCancelar} disabled={salvando}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={salvando}>
            <Save /> {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar obra'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
