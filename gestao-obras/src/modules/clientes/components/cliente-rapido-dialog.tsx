import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog'
import { traduzirErro } from '@/shared/lib/erros'
import { useSalvarCliente, type Cliente } from '../api/clientes-api'
import { ClienteForm } from './cliente-form'

/** Cadastro rápido de cliente sem sair da tela da obra. */
export function ClienteRapidoDialog({ aoCriar }: { aoCriar: (c: Cliente) => void }) {
  const [aberto, setAberto] = useState(false)
  const salvar = useSalvarCliente()
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <UserPlus /> Novo cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
          <DialogDescription>Só o essencial agora. O endereço e as observações podem ser completados depois.</DialogDescription>
        </DialogHeader>
        <ClienteForm
          compacto
          salvando={salvar.isPending}
          aoCancelar={() => setAberto(false)}
          aoSalvar={(v) =>
            salvar.mutate(
              { valores: v },
              {
                onSuccess: (c) => {
                  toast.success('Cliente cadastrado.')
                  aoCriar(c)
                  setAberto(false)
                },
                onError: (e) => toast.error(traduzirErro(e, 'Não foi possível salvar o cliente.')),
              },
            )
          }
        />
      </DialogContent>
    </Dialog>
  )
}
