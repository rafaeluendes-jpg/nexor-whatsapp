import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '@/shared/lib/supabase'
import { traduzirErro } from '@/shared/lib/erros'
import { Button } from '@/shared/components/ui/button'
import { TelaCarregando } from '@/shared/components/layout/tela-carregando'

/**
 * Destino dos links de e-mail (confirmação de conta, recuperação de senha, convite).
 * Troca o código PKCE por uma sessão e leva o usuário ao lugar certo.
 * Só aceita destinos internos (caminho começando com "/") para evitar redirecionamento aberto.
 */
export function CallbackPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const proximo = params.get('proximo')
    const destino = proximo && /^\/(?!\/)/.test(proximo) ? proximo : '/'
    const codigo = params.get('code')
    const erroUrl = params.get('error_description') ?? params.get('error')

    async function concluir() {
      if (erroUrl) {
        setErro(traduzirErro(erroUrl))
        return
      }
      if (codigo) {
        const { error } = await supabase.auth.exchangeCodeForSession(codigo)
        if (error) {
          setErro(traduzirErro(error))
          return
        }
      }
      navigate(destino, { replace: true })
    }
    concluir()
  }, [navigate, params])

  if (!erro) return <TelaCarregando texto="Validando seu acesso…" />

  return (
    <div className="min-h-dvh grid place-items-center p-6">
      <div className="max-w-sm w-full space-y-6 text-center">
        <div className="mx-auto size-14 rounded-2xl bg-destructive/10 text-destructive grid place-items-center">
          <AlertTriangle className="size-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Link inválido</h2>
          <p className="text-sm text-muted-foreground">{erro}</p>
        </div>
        <Button asChild className="w-full">
          <Link to="/entrar">Ir para o login</Link>
        </Button>
      </div>
    </div>
  )
}
