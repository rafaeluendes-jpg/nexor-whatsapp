import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/shared/lib/supabase'
import { traduzirErro } from '@/shared/lib/erros'
import { Button } from '@/shared/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { CampoSenha } from '../components/campo-senha'
import { redefinirSenhaSchema, type RedefinirSenhaValores } from '../schemas'

/** Tela aberta a partir do link de recuperação (o usuário já chega com sessão temporária). */
export function RedefinirSenhaPage() {
  const navigate = useNavigate()
  const [enviando, setEnviando] = useState(false)
  const form = useForm<RedefinirSenhaValores>({
    resolver: zodResolver(redefinirSenhaSchema),
    defaultValues: { senha: '', confirmarSenha: '' },
  })

  async function salvar({ senha }: RedefinirSenhaValores) {
    setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setEnviando(false)
    if (error) {
      toast.error(traduzirErro(error))
      return
    }
    toast.success('Senha atualizada. Bem-vindo de volta!')
    navigate('/', { replace: true })
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Nova senha</h2>
        <p className="text-sm text-muted-foreground">Escolha uma senha forte que você não use em outros sites.</p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(salvar)} className="space-y-5" noValidate>
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
          <Button type="submit" size="lg" className="w-full" disabled={enviando}>
            <ShieldCheck />
            {enviando ? 'Salvando…' : 'Salvar nova senha'}
          </Button>
        </form>
      </Form>
    </div>
  )
}
