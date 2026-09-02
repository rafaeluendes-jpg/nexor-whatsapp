import { useEffect, useState } from 'react'
import splash from '/splash.jpg?url'
import { useAuth } from '@/modules/auth/hooks/use-auth'
import { cn } from '@/shared/lib/utils'

const CHAVE = 'r2on:abertura-vista'
const TEMPO_MINIMO_MS = 1400
const DURACAO_FADE_MS = 700

/**
 * Tela de abertura: a arte da marca cobre a tela ao abrir o app e some aos poucos,
 * revelando o login (ou o painel, se já houver sessão).
 * - Mostra uma vez por sessão do navegador (não repete a cada navegação).
 * - Só começa a sumir quando a sessão foi lida E passou o tempo mínimo, para a
 *   transição nunca "piscar" entre telas.
 */
export function Abertura() {
  const { carregando } = useAuth()
  const [estado, setEstado] = useState<'visivel' | 'saindo' | 'oculta'>(() => {
    try {
      return sessionStorage.getItem(CHAVE) ? 'oculta' : 'visivel'
    } catch {
      return 'visivel'
    }
  })
  const [tempoMinimoOk, setTempoMinimoOk] = useState(false)

  // Remove a abertura estática do index.html assim que o React assume.
  useEffect(() => {
    document.getElementById('abertura')?.remove()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setTempoMinimoOk(true), TEMPO_MINIMO_MS)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (estado !== 'visivel' || carregando || !tempoMinimoOk) return
    setEstado('saindo')
    try {
      sessionStorage.setItem(CHAVE, '1')
    } catch {
      /* modo privado: tudo bem, só repete a abertura */
    }
    const t = setTimeout(() => setEstado('oculta'), DURACAO_FADE_MS)
    return () => clearTimeout(t)
  }, [estado, carregando, tempoMinimoOk])

  if (estado === 'oculta') return null

  return (
    <div
      aria-hidden="true"
      /* enquanto sai, os cliques já atravessam para a tela de baixo */
      className={cn(
        'fixed inset-0 z-[9999] bg-carvao transition-opacity ease-out',
        estado === 'saindo' && 'pointer-events-none',
      )}
      style={{ opacity: estado === 'saindo' ? 0 : 1, transitionDuration: `${DURACAO_FADE_MS}ms` }}
    >
      <img
        src={splash}
        alt=""
        className="h-full w-full object-cover portrait:object-cover landscape:object-contain"
        style={{ transform: estado === 'saindo' ? 'scale(1.04)' : 'scale(1)', transition: `transform ${DURACAO_FADE_MS}ms ease-out` }}
      />
    </div>
  )
}
