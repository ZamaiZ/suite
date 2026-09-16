import "server-only"

import {
  dataForSeoLocationCoordinate,
  postDataForSeo,
} from "@/lib/dataforseo/client"
import {
  mapDataForSeoInfoItem,
  type GbpEnrichment,
} from "@/lib/leads/gbp-enrichment"

const NOT_FOUND = "Não foi possível encontrar este perfil no Google."

/**
 * O Brasil. Medido em 2026-09-15: o endpoint exige uma localidade, mas o
 * `place_id` já identifica o lugar sozinho — a chamada devolveu `Ok.` com o
 * código do país e **sem coordenada nenhuma**, trazendo `latitude` e
 * `longitude` no próprio item. É o que faz o perfil antigo, gravado sem
 * coordenada, ser recoletável sem consultar o Places.
 */
const DATAFORSEO_BRAZIL_LOCATION_CODE = 2076

type GoogleInfoLiveResult = {
  items?: Array<Record<string, unknown>>
}

/**
 * O item cru sobe junto do enrichment.
 *
 * A mesma resposta carrega o que vira `GbpSnapshot` e o que vira
 * `GbpEnrichment`, e devolver só o segundo obrigaria uma segunda chamada paga
 * para obter o primeiro. É este campo que sustenta a etapa única de vínculo.
 */
export type FetchGoogleBusinessInfoResult =
  | { status: "ok"; enrichment: GbpEnrichment; item: Record<string, unknown> }
  | { status: "not_found"; message: string }
  | { status: "error"; message: string }

export async function fetchGoogleBusinessInfo(input: {
  placeId: string
  latitude: number | null
  longitude: number | null
}): Promise<FetchGoogleBusinessInfoResult> {
  const posted = await postDataForSeo<GoogleInfoLiveResult>(
    "/business_data/google/my_business_info/live",
    {
      language_code: "pt",
      keyword: `place_id:${input.placeId}`,
      // Coordenada quando existe, código do país quando não. Perfil recém-
      // buscado tem lat/long vinda do item do Maps; perfil antigo, não — e era
      // o Places que resolvia isso.
      ...(input.latitude !== null && input.longitude !== null
        ? {
            location_coordinate: dataForSeoLocationCoordinate(
              input.latitude,
              input.longitude,
            ),
          }
        : { location_code: DATAFORSEO_BRAZIL_LOCATION_CODE }),
    },
  )
  if (posted.status === "error") return posted

  const item = posted.data?.items?.[0]
  if (!item || item.type !== "google_business_info") {
    return { status: "not_found", message: NOT_FOUND }
  }

  return {
    status: "ok",
    enrichment: mapDataForSeoInfoItem(item, new Date().toISOString()),
    item,
  }
}
