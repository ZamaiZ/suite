/**
 * Objeto `address` do LocationIQ → campos do endereço brasileiro.
 *
 * Sem import nenhum, de propósito: `lib/briefing/address.ts` importa por alias
 * e não carrega no `node --test`. A conversão para `ParsedBrazilianAddress` e a
 * resolução de UF ficam na action, que já vive no mundo do bundler.
 *
 * O estado sai como **nome**, não como sigla: o LocationIQ devolve "São Paulo",
 * e traduzir aqui exigiria a tabela de estados, que é justamente o import que
 * este arquivo não pode ter.
 */

/** Mínimo para disparar o autocomplete. Vive aqui, e não no cliente, porque a
 * tela precisa dele e o cliente é `server-only`. */
export const LOCATIONIQ_SUGGEST_MIN_CHARS = 3

export type LocationIqAddress = {
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  stateName: string
  postalCode: string
}

function text(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim()
    }
  }
  return ""
}

export function addressFromLocationIq(address: unknown): LocationIqAddress {
  const row =
    address && typeof address === "object" && !Array.isArray(address)
      ? (address as Record<string, unknown>)
      : {}

  return {
    street: text(row, "road", "pedestrian", "footway", "name"),
    number: text(row, "house_number"),
    // O LocationIQ não tem campo de complemento. Fica vazio e o cliente
    // preenche — inventar a partir do `display_name` produziria lixo plausível.
    complement: "",
    // `suburb` primeiro: no recorte brasileiro do OSM é ele que carrega o
    // bairro, e `neighbourhood` costuma trazer a zona, que é mais larga.
    neighborhood: text(row, "suburb", "neighbourhood", "quarter"),
    city: text(row, "city", "town", "village", "municipality", "county"),
    stateName: text(row, "state"),
    postalCode: text(row, "postcode").replace(/\D+/g, ""),
  }
}

/**
 * Candidato de endereço exibido na busca do briefing.
 *
 * O tipo mora no módulo puro junto com o parser que o preenche: a tela precisa
 * dele, e o cliente HTTP que o produz é `server-only`.
 */
export type BriefingAddressCandidate = {
  id: string
  label: string
  secondary: string | null
  latitude: number
  longitude: number
  address: LocationIqAddress
}
