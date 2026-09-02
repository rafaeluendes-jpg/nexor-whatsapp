import type { Endereco } from './formatos'
import { somenteDigitos } from './formatos'

/** Busca endereço pelo CEP no ViaCEP. Falha em silêncio: o usuário digita à mão. */
export async function buscarCep(cep: string): Promise<Partial<Endereco> | null> {
  const n = somenteDigitos(cep)
  if (n.length !== 8) return null
  try {
    const r = await fetch(`https://viacep.com.br/ws/${n}/json/`)
    if (!r.ok) return null
    const j = (await r.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string }
    if (j.erro) return null
    return { logradouro: j.logradouro, bairro: j.bairro, cidade: j.localidade, uf: j.uf }
  } catch {
    return null
  }
}
