/**
 * Item de `serp/google/maps/live/advanced` → candidato da lista de busca.
 *
 * Puro e sem alias, para rodar no `node --test`.
 *
 * **A lista mostra perfil, não nome.** Medido em 2026-09-09 e registrado em
 * `../../docs/auditoria/2026-09-04-impedimentos-dataforseo.md`: o item traz mais
 * de trinta campos na mesma resposta paga. Escolher o estabelecimento certo
 * entre homônimos é o que evita o vínculo errado, e nome e endereço não bastam
 * para isso em rede de franquia.
 */

export type GbpPlaceCandidate = {
  placeId: string
  title: string
  address: string | null
  category: string | null
  rating: number | null
  votes: number | null
  phone: string | null
  domain: string | null
  isClaimed: boolean | null
  latitude: number | null
  longitude: number | null
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function mapGbpPlaceCandidates(
  result: Record<string, unknown> | null,
): GbpPlaceCandidate[] {
  const items = result?.items
  if (!Array.isArray(items)) return []

  return items.flatMap((entry) => {
    const item = record(entry)
    if (!item || item.type !== "maps_search") return []
    const placeId = asString(item.place_id)
    const title = asString(item.title)
    if (!placeId || !title) return []

    const rating = record(item.rating)
    return [
      {
        placeId,
        title,
        address: asString(item.address),
        category: asString(item.category),
        // Ausente é `null`, nunca zero: a tela pinta faixa por valor, e zero em
        // nota significaria "péssimo" onde não houve medida nenhuma.
        rating: asNumber(rating?.value),
        votes: asNumber(rating?.votes_count),
        phone: asString(item.phone),
        domain: asString(item.domain),
        isClaimed: asBoolean(item.is_claimed),
        latitude: asNumber(item.latitude),
        longitude: asNumber(item.longitude),
      },
    ]
  })
}
