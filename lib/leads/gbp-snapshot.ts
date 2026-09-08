import type { GbpEnrichment } from "./gbp-enrichment.ts"
import type { GbpPost, GbpQna, GbpReviewSummary } from "./gbp-audit.ts"

/**
 * Snapshot append-only do perfil do Google.
 *
 * `lead_gbp_profiles` guarda identidade e vinculo e mantem `payload` como
 * estado corrente, porque `lib/briefing/prefill.ts` o le direto. O que varia a
 * cada coleta vive aqui, uma linha por coleta, para que exista historico de
 * nota, de volume de avaliacoes e de reviews removidas.
 *
 * O tipo do payload nao e importado de `gbp.ts` de proposito: aquele modulo
 * importa este, e um import de valor nos dois sentidos criaria ciclo. A
 * leitura do payload fica em `gbp.ts`, que ja tem `readGbpSnapshot`.
 */
export type LeadGbpSnapshot<TPayload> = {
  id: string
  profile_id: string
  captured_at: string
  payload: TPayload
  enrichment: GbpEnrichment | null
  reviews: GbpReviewSummary | null
  posts: GbpPost[] | null
  qna: GbpQna | null
}

export const GBP_SNAPSHOT_COLUMNS =
  "id, profile_id, captured_at, payload, enrichment, reviews, posts, qna"

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

/**
 * Seleciona a linha mais recente do embed de snapshots, sem depender da ordem
 * devolvida pela consulta. Retorna a linha crua para que o chamador a leia com
 * os parsers que ja possui.
 */
export function pickLatestGbpSnapshotRow(
  embed: unknown,
): Record<string, unknown> | null {
  if (!Array.isArray(embed)) return null
  let latest: Record<string, unknown> | null = null
  let latestAt: string | null = null
  for (const item of embed) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    const capturedAt = asString(row.captured_at)
    if (!capturedAt) continue
    if (latestAt !== null && capturedAt <= latestAt) continue
    latest = row
    latestAt = capturedAt
  }
  return latest
}
