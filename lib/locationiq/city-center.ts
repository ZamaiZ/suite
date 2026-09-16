import "server-only"

/**
 * Centroide da cidade do lead, para centrar a busca de estabelecimento.
 *
 * **Por que isto existe:** o `serp/google/maps` exige uma localização, e a onda
 * 0 mediu em 2026-09-15 que `location_code` não serve — nem o do país, que
 * devolveu Bahia para uma busca de São Paulo, nem o de tipo `City`, que
 * devolveu o interior. Pôr a cidade na keyword também não salva:
 * `"Otica Diniz Guarulhos SP"` voltou uma ótica no Rio de Janeiro. Só
 * `location_coordinate` centra. Ver
 * `docs/auditoria/evidencias/2026-09-15-migracao-dataforseo/README.md`, P5.
 *
 * **O cache é do processo, e basta.** Centroide de município não muda, a chave
 * é cidade + UF, e a alternativa — tabela das 5.570 sedes no repositório —
 * pagaria em manutenção o que economiza numa chamada gratuita.
 */

import {
  geocodeAddressText,
  type Coordinates,
  type LocationIqResult,
} from "@/lib/locationiq/client"
import { cityCenterCacheKey, cityCenterQuery } from "@/lib/locationiq/city-key"

const cache = new Map<string, Coordinates>()

const CITY_REQUIRED =
  "Preencha cidade e estado do lead para buscar o estabelecimento."

export async function cityCenter(
  city: string | null,
  stateCode: string | null,
): Promise<LocationIqResult<Coordinates>> {
  if (!city?.trim() || !stateCode?.trim()) {
    return { status: "error", message: CITY_REQUIRED }
  }

  const key = cityCenterCacheKey(city, stateCode)
  const cached = cache.get(key)
  if (cached) return { status: "ok", data: cached }

  const geocoded = await geocodeAddressText(cityCenterQuery(city, stateCode))
  if (geocoded.status === "error") return geocoded

  cache.set(key, geocoded.data)
  return geocoded
}
