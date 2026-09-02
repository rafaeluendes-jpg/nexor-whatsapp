import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import { KeyRound, Save, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { traduzirErro } from '@/shared/lib/erros'
import { useAuth } from '@/modules/auth/hooks/use-auth'
import { usePerfil } from '@/modules/auth/hooks/use-perfil'
import { senhaSchema, PROFISSOES } from '@/modules/auth/schemas'
import { CampoSenha } from '@/modules/auth/components/campo-senha'
import { CabecalhoPagina } from '@/shared/components/layout/cabecalho-pagina'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { Separator } from '@/shared/components/ui/separator'

const perfilSchema = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome').max(120),
  telefone: z.string().trim().regex(/^\+?[0-9 ()-]{8,20}$/, 'Telefone inválido').optional().or(z.literal('')),
  profissao: z.string().trim().max(60).optional().or(z.literal('')),
})
type PerfilValores = z.infer<typeof perfilSchema>

const senhaFormSchema = z
  .object({ senha: senhaSchema, confirmarSenha: z.string() })
  .refine((d) => d.senha === d.confirmarSenha, { path: ['confirmarSenha'], message: 'As senhas não conferem' })
type SenhaValores = z.infer<typeof senhaFormSchema>

function FormPerfil() {
  const { user } = useAuth()
  const { data: perfil } = usePerfil()
  const qc = useQueryClient()
  const [salvando, setSalvando] = useState(false)
  const form = useForm<PerfilValores>({
    resolver: zodResolver(perfilSchema),
    defaultValues: { nome: '', telefone: '', profissao: '' },
  })

  useEffect(() => {
    if (perfil) form.reset({ nome: perfil.nome, telefone: perfil.telefone ?? '', profissao: perfil.profissao ?? '' })
  }, [perfil, form])

  async function salvar(v: PerfilValores) {
    setSalvando(true)
    const { error } = await supabase
      .from('perfis')
      .update({ nome: v.nome, telefone: v.telefone || null, profissao: v.profissao || null })
      .eq('id', user!.id)
    setSalvando(false)
    if (error) {
      toast.error(traduzirErro(error, 'Não foi possível salvar o perfil.'))
      return
    }
    qc.invalidateQueries({ queryKey: ['perfil'] })
    toast.success('Perfil atualizado.')
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(salvar)} className="space-y-4 max-w-lg" noValidate>
        <FormField
          control={form.control}
          name="nome"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="telefone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>WhatsApp</FormLabel>
                <FormControl>
                  <Input type="tel" inputMode="tel" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="profissao"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Atuação</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || undefined}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PROFISSOES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="space-y-1">
          <FormLabel>E-mail</FormLabel>
          <Input value={user?.email ?? ''} disabled />
          <p className="text-xs text-muted-foreground">A troca de e-mail será liberada em uma próxima etapa.</p>
        </div>
        <Button type="submit" disabled={salvando}>
          <Save /> {salvando ? 'Salvando…' : 'Salvar'}
        </Button>
      </form>
    </Form>
  )
}

function FormSenha() {
  const [salvando, setSalvando] = useState(false)
  const form = useForm<SenhaValores>({ resolver: zodResolver(senhaFormSchema), defaultValues: { senha: '', confirmarSenha: '' } })

  async function salvar({ senha }: SenhaValores) {
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvando(false)
    if (error) {
      toast.error(traduzirErro(error))
      return
    }
    form.reset()
    toast.success('Senha alterada com sucesso.')
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(salvar)} className="space-y-4 max-w-lg" noValidate>
        <FormField
          control={form.control}
          name="senha"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nova senha</FormLabel>
              <FormControl>
                <CampoSenha mostrarForca autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmarSenha"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirmar nova senha</FormLabel>
              <FormControl>
                <CampoSenha autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={salvando}>
          <KeyRound /> {salvando ? 'Alterando…' : 'Alterar senha'}
        </Button>
      </form>
    </Form>
  )
}

export function ConfiguracoesPage() {
  const { sair } = useAuth()
  return (
    <>
      <CabecalhoPagina titulo="Configurações" descricao="Seu perfil e a segurança da sua conta." />
      <Tabs defaultValue="perfil">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="seguranca">Segurança</TabsTrigger>
        </TabsList>
        <TabsContent value="perfil">
          <Card>
            <CardHeader>
              <CardTitle>Meu perfil</CardTitle>
              <CardDescription>Como você aparece para a equipe e para os clientes.</CardDescription>
            </CardHeader>
            <CardContent>
              <FormPerfil />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="seguranca">
          <Card>
            <CardHeader>
              <CardTitle>Senha</CardTitle>
              <CardDescription>Use uma senha forte e exclusiva para este app.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormSenha />
              <Separator />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">Sair da conta</p>
                  <p className="text-sm text-muted-foreground">Encerra a sessão neste aparelho.</p>
                </div>
                <Button variant="outline" onClick={() => sair()}>
                  <LogOut /> Sair
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}
