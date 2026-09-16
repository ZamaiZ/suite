import "server-only"

import { postDataForSeo } from "@/lib/dataforseo/client"
import {
  GBP_MAPS_LANGUAGE_CODE,
  GBP_MAPS_SE_DOMAIN,
  googleMapsCoordinate,
} from "@/lib/dataforseo/maps-task"
import {
  mapGbpPlaceCandidates,
  type GbpPlaceCandidate,
} from "@/lib/leads/gbp-maps-candidate"

/**
 * Profundidade da busca de estabelecimento.
 *
 * Deliberadamente igual ao `GBP_MAPS_DEPTH` do ranking em valor, e separada em
 * nome: são duas perguntas diferentes — "quem aparece para esta keyword" e
 * "qual destes é o meu lead" — e amarrá-las faria uma mudar quando a outra
 * precisasse. `depth: 20` custou US$ 0,002, o preço de tabela, medido.
 */
export const GBP_SEARCH_DEPTH = 20

/**
 * Zoom 12, e não o 15 da malha. Medido em 2026-09-15 com "Otica Diniz" no
 * centroide de Guarulhos: o 15 devolveu 4 resultados, todos na cidade, e o 12
 * devolveu 20 começando por ela. A busca quer candidatos suficientes para o
 * analista reconhecer o certo — recortar cedo esconde a filial que ele procura.
 */
export const GBP_SEARCH_ZOOM = 12

export type SearchGooglePlacesResult =
  | { status: "ok"; candidates: GbpPlaceCandidate[] }
  | { status: "error"; message: string }

export async function searchGooglePlaces(input: {
  query: string
  latitude: number
  longitude: number
}): Promise<SearchGooglePlacesResult> {
  const posted = await postDataForSeo<Record<string, unknown>>(
    "/serp/google/maps/live/advanced",
    {
      language_code: GBP_MAPS_LANGUAGE_CODE,
      se_domain: GBP_MAPS_SE_DOMAIN,
      keyword: input.query,
      depth: GBP_SEARCH_DEPTH,
      // Coordenada, e não `location_code`. A onda 0 mediu que o código do país
      // devolve outro estado e o de cidade devolve o interior — ver P5 em
      // `docs/auditoria/evidencias/2026-09-15-migracao-dataforseo/README.md`.
      //
      // O `googleMapsTask` não serve aqui: ele acrescenta `search_this_area` e a
      // profundidade da malha, e a sondagem que aprovou este desenho rodou sem
      // os dois.
      location_coordinate: googleMapsCoordinate(
        input.latitude,
        input.longitude,
        GBP_SEARCH_ZOOM,
      ),
    },
  )
  if (posted.status === "error") {
    return { status: "error", message: posted.message }
  }
  return { status: "ok", candidates: mapGbpPlaceCandidates(posted.data) }
}
