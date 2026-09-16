import "server-only"

import { postDataForSeo } from "@/lib/dataforseo/client"
import {
  extractWebsitePsiStrategy,
  PSI_FETCH_TIMEOUT_MS,
  type WebsitePsiStrategy,
  type WebsitePsiStrategyId,
} from "@/lib/leads/website-pagespeed"

/**
 * Lighthouse pelo DataForSEO, no lugar do PageSpeed Insights.
 *
 * Medido em 2026-09-15: US$ 0,005 por estratégia, Lighthouse 13.4.0, com
 * `audits` e `categories` na raiz da resposta.
 *
 * **O que se perde está declarado:** o PSI anexava `loadingExperience`, que é
 * campo do Chrome UX Report. O Lighthouse não produz isso — nem o do DataForSEO
 * nem nenhum outro —, então `fieldLcpMs`, `fieldInpMs` e `fieldCls` passam a
 * ser sempre nulos, e o INP some dos dois eixos, porque o de laboratório também
 * não é emitido. A tela diz isso; o silêncio se pareceria com aprovação.
 */

export const PAGESPEED_FAILED =
  "Não foi possível obter o PageSpeed. Tente novamente."

export type LighthouseFetchResult =
  | { status: "ok"; strategy: WebsitePsiStrategy }
  | { status: "error"; message: string }

export async function fetchPagespeedStrategy(
  url: string,
  strategy: WebsitePsiStrategyId,
): Promise<LighthouseFetchResult> {
  const posted = await postDataForSeo<Record<string, unknown>>(
    "/on_page/lighthouse/live/json",
    {
      url,
      for_mobile: strategy === "mobile",
      categories: ["performance", "accessibility", "best_practices", "seo"],
      language_code: "pt",
    },
    // Uma execução de Lighthouse não cabe no teto padrão de 20s do cliente.
    PSI_FETCH_TIMEOUT_MS,
  )
  if (posted.status === "error") {
    return { status: "error", message: PAGESPEED_FAILED }
  }

  const extracted = extractWebsitePsiStrategy(posted.data)
  if (!extracted) {
    return { status: "error", message: PAGESPEED_FAILED }
  }
  return { status: "ok", strategy: extracted }
}
