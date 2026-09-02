const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

export function formatarMoeda(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === '') return '—'
  return moeda.format(Number(v))
}

export function formatarNumero(v: number | string | null | undefined, sufixo = '') {
  if (v === null || v === undefined || v === '') return '—'
  return numero.format(Number(v)) + sufixo
}

/** Datas "YYYY-MM-DD" (colunas date) sem conversão de fuso. */
export function formatarData(iso: string | null | undefined) {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export function formatarDataHora(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

export function somenteDigitos(s: string | null | undefined) {
  return (s ?? '').replace(/\D/g, '')
}

export function formatarDocumento(d: string | null | undefined) {
  const n = somenteDigitos(d)
  if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return d ?? '—'
}

export function formatarTelefone(t: string | null | undefined) {
  const n = somenteDigitos(t)
  if (n.length === 11) return n.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (n.length === 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return t || '—'
}

export function formatarCep(c: string | null | undefined) {
  const n = somenteDigitos(c)
  return n.length === 8 ? n.replace(/(\d{5})(\d{3})/, '$1-$2') : (c ?? '')
}

export type Endereco = {
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
}

export function enderecoResumo(e: Endereco | null | undefined) {
  if (!e) return ''
  const linha1 = [e.logradouro, e.numero].filter(Boolean).join(', ')
  const linha2 = [e.bairro, e.cidade && e.uf ? `${e.cidade}/${e.uf}` : e.cidade || e.uf].filter(Boolean).join(' · ')
  return [linha1, linha2].filter(Boolean).join(' — ')
}

/** Dias entre hoje e uma data "YYYY-MM-DD" (negativo se já passou). */
export function diasAte(iso: string | null | undefined) {
  if (!iso) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  const alvo = new Date(a, m - 1, d)
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000)
}

export function iniciais(nome?: string | null) {
  if (!nome) return '?'
  const p = nome.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}
