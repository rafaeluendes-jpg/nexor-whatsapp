import { Link, isRouteErrorResponse, useRouteError } from 'react-router'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'

export function ErroPage() {
  const erro = useRouteError()
  const titulo = isRouteErrorResponse(erro) && erro.status === 404 ? 'Página não encontrada' : 'Algo deu errado'
  return (
    <div className="min-h-dvh grid place-items-center p-6">
      <div className="max-w-sm w-full space-y-6 text-center">
        <div className="mx-auto size-14 rounded-2xl bg-destructive/10 text-destructive grid place-items-center">
          <AlertTriangle className="size-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">{titulo}</h1>
          <p className="text-sm text-muted-foreground">Tente novamente. Se continuar, avise o suporte.</p>
        </div>
        <Button asChild className="w-full">
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>
    </div>
  )
}
