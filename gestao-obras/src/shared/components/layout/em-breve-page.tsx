import { useLocation } from 'react-router'
import { Construction } from 'lucide-react'
import { itensNav } from './nav-items'
import { CabecalhoPagina } from './cabecalho-pagina'

export function EmBrevePage() {
  const { pathname } = useLocation()
  const item = itensNav.find((i) => i.para === pathname)
  return (
    <>
      <CabecalhoPagina titulo={item?.rotulo ?? 'Módulo'} />
      <div className="rounded-xl border border-dashed p-10 text-center space-y-3">
        <div className="mx-auto size-12 rounded-xl bg-muted grid place-items-center">
          <Construction className="size-6 text-muted-foreground" />
        </div>
        <p className="font-medium">Módulo em construção</p>
        <p className="text-sm text-muted-foreground">Este módulo será construído na próxima etapa, depois da base aprovada.</p>
      </div>
    </>
  )
}
