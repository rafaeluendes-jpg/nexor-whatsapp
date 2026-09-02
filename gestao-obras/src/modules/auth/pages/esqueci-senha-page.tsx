import { useState } from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, MailCheck, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { traduzirErro } from '@/shared/lib/erros'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { esqueciSenhaSchema, type EsqueciSenhaValores } from '../schemas'

export function EsqueciSenhaPage() {
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const form = useForm<EsqueciSenhaValores>({ resolver: zodResolver(esqueciSenhaSchema), defaultValues: { email: '' } })

  async function enviar({ email }: EsqueciSenhaValores) {
    setEnviando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?proximo=/redefinir-senha`,
    })
    setEnviando(false)
    // Mesma resposta exista ou não a conta: não revela e-mails cadastrados.
    if (error && !/rate limit/i.test(error.message)) {
      setEnviado(true)
      return
    }
    if (error) {
      toast.error(traduzirErro(error))
      return
    }
    setEnviado(true)
  }

  if (enviado) {
    return (
      <div className="space-y-6">
        <div className="size-14 rounded-2xl bg-success/15 text-success grid place-items-center">
          <MailCheck className="size-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Verifique seu e-mail</h2>
          <p className="text-sm text-muted-foreground">
            Se existir uma conta com esse e-mail, você receberá um link para criar uma nova senha em instantes.
          </p>
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link to="/entrar">
            <ArrowLeft /> Voltar para o login
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Recuperar senha</h2>
        <p className="text-sm text-muted-foreground">Informe seu e-mail e enviaremos um link seguro para redefinir.</p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(enviar)} className="space-y-5" noValidate>
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
          <Button type="submit" size="lg" className="w-full" disabled={enviando}>
            <KeyRound />
            {enviando ? 'Enviando…' : 'Enviar link'}
          </Button>
        </form>
      </Form>
      <Link to="/entrar" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar para o login
      </Link>
    </div>
  )
}
