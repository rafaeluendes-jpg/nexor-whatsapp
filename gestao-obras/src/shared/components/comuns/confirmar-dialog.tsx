import { useState, type ReactNode } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog'

type Props = {
  gatilho: ReactNode
  titulo: string
  descricao: string
  textoConfirmar?: string
  destrutivo?: boolean
  aoConfirmar: () => Promise<unknown> | void
}

export function ConfirmarDialog({ gatilho, titulo, descricao, textoConfirmar = 'Confirmar', destrutivo, aoConfirmar }: Props) {
  const [aberto, setAberto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  async function confirmar() {
    setOcupado(true)
    try {
      await aoConfirmar()
      setAberto(false)
    } finally {
      setOcupado(false)
    }
  }
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>{gatilho}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAberto(false)} disabled={ocupado}>
            Cancelar
          </Button>
          <Button variant={destrutivo ? 'destructive' : 'default'} onClick={confirmar} disabled={ocupado}>
            {ocupado ? 'Aguarde…' : textoConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
