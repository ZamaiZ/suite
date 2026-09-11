import "server-only"

import { postDataForSeo } from "@/lib/dataforseo/client"
import { dataForSeoTimeToIso } from "@/lib/dataforseo/time"

/** O endpoint aceita até 1.000 keywords por chamada. */
const SEARCH_INTENT_MAX = 1000

export type SearchIntentEntry = {
  label: string
  probability: number
  secondary: Array<{ label: string; probability: number }>
  updatedAt: string | null
}

export type FetchSearchIntentResult =
  | { status: "ok"; intents: Map<string, SearchIntentEntry>; cost: number }
  | { status: "error" }

type SearchIntentLiveResult = {
  items?: Array<Record<string, unknown>>
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function asFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readSecondary(
  value: unknown,
): Array<{ label: string; probability: number }> {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const row = asRecord(item)
    const label = asString(row?.label)
    const probability = asFinite(row?.probability)
    return label && probability !== null ? [{ label, probability }] : []
  })
}

function readSearchIntentItems(
  items: Array<Record<string, unknown>> | undefined,
): Map<string, SearchIntentEntry> {
  const out = new Map<string, SearchIntentEntry>()
  if (!Array.isArray(items)) return out
  for (const item of items) {
    const keyword = asString(item?.keyword)
    const intent = asRecord(item?.keyword_intent)
    const label = asString(intent?.label)
    const probability = asFinite(intent?.probability)
    // Sem probabilidade a linha não serve para nada aqui: o que esta chamada
    // compra é justamente a confiança, não o rótulo — o `ranked_keywords` já
    // trazia um rótulo, e os dois discordam em 23% dos casos.
    if (!keyword || !label || probability === null) continue
    out.set(keyword, {
      label,
      probability,
      secondary: readSecondary(item?.secondary_keyword_intents),
      updatedAt: dataForSeoTimeToIso(item?.last_updated_time),
    })
  }
  return out
}

/**
 * Intenção de busca pela fonte dedicada.
 *
 * Medido em 2026-09-10 contra `buscaorganica.com.br`: este endpoint discorda do
 * `search_intent_info` embutido no `ranked_keywords` em 25 das 110 keywords, e
 * um terço das classificações tem probabilidade abaixo de 0,60. Não existe
 * verdade de referência para intenção — Semrush, Ahrefs e Ubersuggest têm
 * modelos próprios e discordam entre si. O que esta chamada compra não é
 * correção: é a probabilidade que permite a tela calar em vez de estampar uma
 * letra com cara de fato.
 *
 * Preço: US$ 0,012 por requisição + US$ 0,00012 por keyword devolvida.
 */
export async function fetchSearchIntentLive(input: {
  keywords: ReadonlyArray<string>
  languageCode: string
}): Promise<FetchSearchIntentResult> {
  const keywords = [...new Set(input.keywords)].slice(0, SEARCH_INTENT_MAX)
  if (keywords.length === 0) {
    return { status: "ok", intents: new Map(), cost: 0 }
  }
  const posted = await postDataForSeo<SearchIntentLiveResult>(
    "/dataforseo_labs/google/search_intent/live",
    { keywords, language_code: input.languageCode },
  )
  if (posted.status === "error") return { status: "error" }
  return {
    status: "ok",
    intents: readSearchIntentItems(posted.data?.items),
    cost: posted.cost ?? 0,
  }
}
