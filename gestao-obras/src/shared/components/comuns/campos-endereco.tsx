import { useFormContext, type FieldValues, type Path } from 'react-hook-form'
import { buscarCep } from '@/shared/lib/cep'
import { formatarCep, somenteDigitos } from '@/shared/lib/formatos'
import { UFS } from '@/shared/lib/schemas-comuns'
import { Input } from '@/shared/components/ui/input'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

/** Bloco de endereço reutilizável. `prefixo` é o nome do objeto no formulário (ex.: "endereco"). */
export function CamposEndereco<T extends FieldValues>({ prefixo }: { prefixo: string }) {
  const form = useFormContext<T>()
  const campo = (n: string) => `${prefixo}.${n}` as Path<T>

  async function aoSairDoCep(valor: string) {
    const r = await buscarCep(valor)
    if (!r) return
    const setar = (n: string, v?: string) => {
      if (v) form.setValue(campo(n), v as never, { shouldDirty: true })
    }
    setar('logradouro', r.logradouro)
    setar('bairro', r.bairro)
    setar('cidade', r.cidade)
    setar('uf', r.uf)
  }

  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <FormField
        control={form.control}
        name={campo('cep')}
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>CEP</FormLabel>
            <FormControl>
              <Input
                inputMode="numeric"
                placeholder="00000-000"
                {...field}
                value={formatarCep(field.value as string)}
                onChange={(e) => field.onChange(somenteDigitos(e.target.value).slice(0, 8))}
                onBlur={(e) => {
                  field.onBlur()
                  aoSairDoCep(e.target.value)
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={campo('logradouro')}
        render={({ field }) => (
          <FormItem className="sm:col-span-4">
            <FormLabel>Rua / Avenida</FormLabel>
            <FormControl>
              <Input placeholder="Rua das Obras" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={campo('numero')}
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>Número</FormLabel>
            <FormControl>
              <Input placeholder="123" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={campo('complemento')}
        render={({ field }) => (
          <FormItem className="sm:col-span-4">
            <FormLabel>Complemento</FormLabel>
            <FormControl>
              <Input placeholder="Lote, quadra, apto…" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={campo('bairro')}
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>Bairro</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={campo('cidade')}
        render={({ field }) => (
          <FormItem className="sm:col-span-3">
            <FormLabel>Cidade</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={campo('uf')}
        render={({ field }) => (
          <FormItem className="sm:col-span-1">
            <FormLabel>UF</FormLabel>
            <Select onValueChange={field.onChange} value={(field.value as string) || undefined}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {UFS.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
