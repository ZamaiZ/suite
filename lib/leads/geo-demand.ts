/**
 * Demanda de busca em IA — leitura de `ai_keyword_data/keywords_search_volume`.
 *
 * Puro, sem `server-only`: a mesma leitura roda no fetcher e nas regras de gap,
 * que vivem em componente de cliente.
 *
 * **A forma veio do payload, não da documentação.** Medida em 2026-09-11 contra
 * as 110 keywords de `buscaorganica.com.br`: o item tem exatamente três chaves
 * — `keyword`, `ai_search_volume`, `ai_monthly_searches` —, sem `keyword_info`
 * aninhado. Evidência em
 * `docs/auditoria/evidencias/2026-09-10-presenca-em-ia/10-ai_keyword_data.json`.
 */

import type { GeoAiDemand } from "./geo-audit.ts"

export type AiKeywordVolumeResult = {
  items?: unknown
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Soma mensal de todas as keywords.
 *
 * A chave é `ano-mês` porque as séries por keyword vêm na mesma ordem mas não
 * há garantia disso no contrato — somar por índice casaria janeiro de uma com
 * fevereiro de outra, e o gráfico sairia plausível e errado.
 */
function monthlyTotals(
  items: Array<Record<string, unknown>>,
): GeoAiDemand["monthlyTotals"] {
  const byKey = new Map<string, { year: number; month: number; volume: number }>()
  for (const item of items) {
    const months = Array.isArray(item.ai_monthly_searches)
      ? item.ai_monthly_searches
      : []
    for (const entry of months) {
      const row = asRecord(entry)
      const year = asFinite(row?.year)
      const month = asFinite(row?.month)
      const volume = asFinite(row?.ai_search_volume)
      if (year === null || month === null || volume === null) continue
      const key = `${year}-${String(month).padStart(2, "0")}`
      const current = byKey.get(key)
      if (current) current.volume += volume
      else byKey.set(key, { year, month, volume })
    }
  }
  return [...byKey.values()].sort((left, right) =>
    right.year !== left.year ? right.year - left.year : right.month - left.month,
  )
}

/**
 * `null` significa **não coletado**; `0` significa **medido e sem demanda**.
 *
 * A distinção é a mesma que o `keyword_difficulty` custou caro: 61 das 110
 * keywords vieram com volume positivo e 49 vieram zero, nenhuma nula. Um `0`
 * aqui é resposta, e a tela precisa dizer "sem busca em IA", nunca "—".
 *
 * **O volume de IA não é fração do orgânico.** Medido: `sanitarios` deu 12.559
 * em IA contra 5.400 no Google, e `banheiro químicos` deu 234 contra 18.100.
 * Não há razão constante, e apresentar como percentual do volume orgânico
 * inventaria uma relação que não existe.
 */
export function mapAiDemand(input: {
  result: AiKeywordVolumeResult | null
  locationLabel: string
  languageCode: string
}): GeoAiDemand | null {
  if (!input.result) return null
  const raw = Array.isArray(input.result.items) ? input.result.items : []
  const items = raw.flatMap((entry) => {
    const row = asRecord(entry)
    return row ? [row] : []
  })

  const keywords = items.flatMap((row) => {
    const keyword = asTrimmed(row.keyword)
    if (!keyword) return []
    return [{ keyword, aiSearchVolume: asFinite(row.ai_search_volume) }]
  })

  const medidas = keywords
    .map((row) => row.aiSearchVolume)
    .filter((value): value is number => value !== null)

  return {
    keywords: keywords.sort(
      (left, right) => (right.aiSearchVolume ?? -1) - (left.aiSearchVolume ?? -1),
    ),
    // Lista vazia devolve `null`, não `0`: somar nada e mostrar zero afirmaria
    // ausência de demanda onde não houve medida.
    totalAiSearchVolume:
      medidas.length > 0 ? medidas.reduce((acc, value) => acc + value, 0) : null,
    monthlyTotals: monthlyTotals(items),
    locationLabel: input.locationLabel,
    languageCode: input.languageCode,
  }
}
