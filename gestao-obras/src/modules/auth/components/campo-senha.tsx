import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/shared/components/ui/input'
import { cn } from '@/shared/lib/utils'

type Props = React.ComponentProps<typeof Input> & { mostrarForca?: boolean }

function forcaSenha(s: string) {
  let pontos = 0
  if (s.length >= 8) pontos++
  if (s.length >= 12) pontos++
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) pontos++
  if (/[0-9]/.test(s)) pontos++
  if (/[^A-Za-z0-9]/.test(s)) pontos++
  return Math.min(pontos, 4)
}
const rotulos = ['', 'Fraca', 'Razoável', 'Boa', 'Forte']
const cores = ['', 'bg-destructive', 'bg-warning', 'bg-info', 'bg-success']

export function CampoSenha({ mostrarForca, className, value, ...props }: Props) {
  const [visivel, setVisivel] = useState(false)
  const forca = mostrarForca ? forcaSenha(String(value ?? '')) : 0
  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          type={visivel ? 'text' : 'password'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={cn('pr-10', className)}
          value={value}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          className="absolute inset-y-0 right-0 px-3 text-muted-foreground hover:text-foreground"
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          tabIndex={-1}
        >
          {visivel ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {mostrarForca && String(value ?? '').length > 0 && (
        <div className="space-y-1">
          <div className="grid grid-cols-4 gap-1">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className={cn('h-1 rounded-full bg-muted transition-colors', n <= forca && cores[forca])} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Senha {rotulos[forca] || 'muito fraca'}</p>
        </div>
      )}
    </div>
  )
}
