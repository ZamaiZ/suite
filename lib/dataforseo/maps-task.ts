/**
 * Construtor único da tarefa de Maps — puro, para ser testável.
 *
 * Existe porque a malha e a checagem avulsa de ranking montavam a mesma
 * requisição em dois lugares e divergiram: a avulsa pedia zoom 17 e a malha 15.
 * Como o ponto central da malha é gravado no histórico de ranking, a divergência
 * colocava duas metodologias na mesma série temporal. Um construtor só torna
 * isso impossível.
 *
 * Importa por caminho relativo com extensão, como `gbp-grid.ts` já faz, para
 * continuar carregável fora do bundler.
 */

import { GBP_MAPS_DEPTH } from "../leads/gbp-audit.ts"

/**
 * O zoom vai na requisição, não na tela: define a área que o buscador considera
 * naquele ponto, então ele muda quais negócios voltam. 15 é o valor recomendado
 * pela documentação para malha local.
 */
export const GBP_MAPS_ZOOM = 15

/** Sem isto a busca sai no google.com, não no índice que o cliente vê. */
export const GBP_MAPS_SE_DOMAIN = "google.com.br"

export const GBP_MAPS_LANGUAGE_CODE = "pt"

/** `location_coordinate` do Maps é "latitude,longitude,Nz", com N entre 3 e 21. */
export function googleMapsCoordinate(
  latitude: number,
  longitude: number,
  zoom: number,
): string {
  return `${Number(latitude.toFixed(7))},${Number(longitude.toFixed(7))},${zoom}z`
}

export function googleMapsTask(input: {
  keyword: string
  latitude: number
  longitude: number
  zoom: number
  tag?: string
}): Record<string, unknown> {
  return {
    language_code: GBP_MAPS_LANGUAGE_CODE,
    se_domain: GBP_MAPS_SE_DOMAIN,
    keyword: input.keyword,
    location_coordinate: googleMapsCoordinate(
      input.latitude,
      input.longitude,
      input.zoom,
    ),
    depth: GBP_MAPS_DEPTH,
    search_this_area: true,
    ...(input.tag ? { tag: input.tag } : {}),
  }
}
