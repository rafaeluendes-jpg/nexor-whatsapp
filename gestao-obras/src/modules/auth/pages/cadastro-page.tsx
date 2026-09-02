import { useState } from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { traduzirErro } from '@/shared/lib/erros'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { CampoSenha } from '../components/campo-senha'
import { cadastroSchema, PROFISSOES, type CadastroValores } from '../schemas'

export function CadastroPage() {
  const [enviando, setEnviando] = useState(false)
  const [emailEnviado, setEmailEnviado] = useState<string | null>(null)
  const form = useForm<CadastroValores>({
    resolver: zodResolver(cadastroSchema),
    defaultValues: {
      nome: '',
      nomeEmpresa: '',
      profissao: '',
      telefone: '',
      email: '',
      senha: '',
      confirmarSenha: '',
      aceitaTermos: undefined as unknown as true,
    },
  })

  async function cadastrar(v: CadastroValores) {
    setEnviando(true)
    const { data, error } = await supabase.auth.signUp({
      email: v.email,
      password: v.senha,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // Esses dados alimentam o trigger que cria o perfil e a organização.
        data: {
          nome: v.nome,
          nome_empresa: v.nomeEmpresa || null,
          profissao: v.profissao || null,
          telefone: v.telefone || null,
          tipo_conta: 'profissional',
        },
      },
    })
    setEnviando(false)
    if (error) {
      toast.error(traduzirErro(error))
      return
    }
    // Com confirmação de e-mail ligada, a sessão vem nula até confirmar.
    if (!data.session) setEmailEnviado(v.email)
  }

  if (emailEnviado) {
    return (
      <div className="space-y-6">
        <div className="size-14 rounded-2xl bg-success/15 text-success grid place-items-center">
          <MailCheck className="size-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Confirme seu e-mail</h2>
          <p className="text-sm text-muted-foreground">
            Enviamos um link de confirmação para <strong className="text-foreground">{emailEnviado}</strong>. Abra o
            e-mail e toque no link para ativar sua conta.
          </p>
        </div>
        <Alert>
          <AlertTitle>Não chegou?</AlertTitle>
          <AlertDescription>Verifique a pasta de spam. O link vale por 24 horas.</AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="w-full">
          <Link to="/entrar">Voltar para o login</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Criar conta</h2>
        <p className="text-sm text-muted-foreground">Leva menos de um minuto. Sem cartão de crédito.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(cadastrar)} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="nome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Seu nome</FormLabel>
                <FormControl>
                  <Input autoComplete="name" placeholder="Nome completo" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="profissao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Atuação</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
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
            <FormField
              control={form.control}
              name="telefone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp</FormLabel>
                  <FormControl>
                    <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="nomeEmpresa"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Empresa (opcional)</FormLabel>
                <FormControl>
                  <Input autoComplete="organization" placeholder="Nome da sua empresa ou marca" {...field} />
                </FormControl>
                <FormDescription>Se deixar em branco, usamos o seu nome.</FormDescription>
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
                  <Input type="email" inputMode="email" autoComplete="email" placeholder="voce@empresa.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="senha"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Senha</FormLabel>
                <FormControl>
                  <CampoSenha mostrarForca autoComplete="new-password" placeholder="Mínimo 8 caracteres" {...field} />
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
                <FormLabel>Confirmar senha</FormLabel>
                <FormControl>
                  <CampoSenha autoComplete="new-password" placeholder="Repita a senha" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="aceitaTermos"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-start gap-3">
                  <FormControl>
                    <Checkbox checked={field.value === true} onCheckedChange={(v) => field.onChange(v === true)} className="mt-0.5" />
                  </FormControl>
                  <FormLabel className="font-normal leading-snug text-muted-foreground">
                    Li e aceito os termos de uso e a política de privacidade.
                  </FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="lg" className="w-full" disabled={enviando}>
            <UserPlus />
            {enviando ? 'Criando conta…' : 'Criar conta'}
          </Button>
        </form>
      </Form>

      <p className="text-sm text-center text-muted-foreground">
        Já tem conta?{' '}
        <Link to="/entrar" className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}
