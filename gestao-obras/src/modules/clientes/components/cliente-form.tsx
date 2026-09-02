import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { CamposEndereco } from '@/shared/components/comuns/campos-endereco'
import { formatarDocumento, somenteDigitos } from '@/shared/lib/formatos'
import { clienteSchema, clienteVazio, type ClienteValores } from '../schemas'

type Props = {
  inicial?: ClienteValores
  salvando?: boolean
  aoSalvar: (v: ClienteValores) => void
  aoCancelar?: () => void
  compacto?: boolean
}

export function ClienteForm({ inicial, salvando, aoSalvar, aoCancelar, compacto }: Props) {
  const form = useForm<ClienteValores>({
    resolver: zodResolver(clienteSchema),
    defaultValues: inicial ?? clienteVazio,
  })

  const dados = (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        control={form.control}
        name="nome"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>Nome *</FormLabel>
            <FormControl>
              <Input autoComplete="off" placeholder="Nome do cliente ou empresa" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="telefone"
        render={({ field }) => (
          <FormItem>
            <FormLabel>WhatsApp</FormLabel>
            <FormControl>
              <Input type="tel" inputMode="tel" placeholder="(11) 99999-9999" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>E-mail</FormLabel>
            <FormControl>
              <Input type="email" inputMode="email" placeholder="cliente@email.com" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="documento"
        render={({ field }) => (
          <FormItem>
            <FormLabel>CPF ou CNPJ</FormLabel>
            <FormControl>
              <Input
                inputMode="numeric"
                placeholder="000.000.000-00"
                {...field}
                value={formatarDocumento(field.value) === '—' ? '' : formatarDocumento(field.value)}
                onChange={(e) => field.onChange(somenteDigitos(e.target.value).slice(0, 14))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )

  const rodape = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      {aoCancelar && (
        <Button type="button" variant="outline" onClick={aoCancelar} disabled={salvando}>
          Cancelar
        </Button>
      )}
      <Button type="submit" disabled={salvando}>
        <Save /> {salvando ? 'Salvando…' : 'Salvar cliente'}
      </Button>
    </div>
  )

  if (compacto) {
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(aoSalvar)} className="space-y-5" noValidate>
          {dados}
          {rodape}
        </form>
      </Form>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(aoSalvar)} className="space-y-6" noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Dados do cliente</CardTitle>
            <CardDescription>Contato principal de quem contrata a obra.</CardDescription>
          </CardHeader>
          <CardContent>{dados}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Endereço</CardTitle>
            <CardDescription>Endereço do cliente (o da obra fica no cadastro da obra).</CardDescription>
          </CardHeader>
          <CardContent>
            <CamposEndereco<ClienteValores> prefixo="endereco" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea placeholder="Preferências, horários, indicações…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
        {rodape}
      </form>
    </Form>
  )
}
