import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LogIn } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { traduzirErro } from '@/shared/lib/erros'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { CampoSenha } from '../components/campo-senha'
import { loginSchema, type LoginValores } from '../schemas'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [enviando, setEnviando] = useState(false)
  const form = useForm<LoginValores>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', senha: '' },
  })

  async function entrar(valores: LoginValores) {
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: valores.email, password: valores.senha })
    setEnviando(false)
    if (error) {
      toast.error(traduzirErro(error))
      return
    }
    const destino = (location.state as { de?: string } | null)?.de ?? '/'
    navigate(destino, { replace: true })
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Entrar</h2>
        <p className="text-sm text-muted-foreground">Acesse suas obras com segurança.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(entrar)} className="space-y-5" noValidate>
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
                <div className="flex items-center justify-between">
                  <FormLabel>Senha</FormLabel>
                  <Link to="/esqueci-senha" className="text-xs text-primary hover:underline">
                    Esqueceu a senha?
                  </Link>
                </div>
                <FormControl>
                  <CampoSenha autoComplete="current-password" placeholder="Sua senha" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="lg" className="w-full" disabled={enviando}>
            <LogIn />
            {enviando ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </Form>

      <p className="text-sm text-center text-muted-foreground">
        Ainda não tem conta?{' '}
        <Link to="/criar-conta" className="font-medium text-primary hover:underline">
          Criar conta grátis
        </Link>
      </p>
    </div>
  )
}
