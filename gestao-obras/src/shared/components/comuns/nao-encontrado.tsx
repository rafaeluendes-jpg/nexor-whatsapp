import { Link } from 'react-router'
import { SearchX } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'

export function NaoEncontrado({ titulo, texto, voltarPara, voltarRotulo }: { titulo: string; texto: string; voltarPara: string; voltarRotulo: string }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-dashed p-10 text-center space-y-3">
      <div className="mx-auto size-12 rounded-xl bg-muted grid place-items-center">
        <SearchX className="size-6 text-muted-foreground" />
      </div>
      <p className="font-medium">{titulo}</p>
      <p className="text-sm text-muted-foreground">{texto}</p>
      <Button asChild variant="outline">
        <Link to={voltarPara}>{voltarRotulo}</Link>
      </Button>
    </div>
  )
}
