import { Input } from '@/shared/components/ui/input'

type Props = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: number | null | undefined
  onChange: (v: number | null) => void
}

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Digita-se só números; o valor vai preenchendo os centavos, como em app de banco. */
export function InputMoeda({ value, onChange, ...props }: Props) {
  const texto = value === null || value === undefined ? '' : fmt.format(value)
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">R$</span>
      <Input
        inputMode="numeric"
        className="pl-10 tabular-nums"
        placeholder="0,00"
        {...props}
        value={texto}
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, '')
          onChange(d ? Number(d) / 100 : null)
        }}
      />
    </div>
  )
}
