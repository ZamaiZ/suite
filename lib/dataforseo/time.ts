/**
 * Parser de timestamp do DataForSEO. Puro e sem imports, como `limits.ts`.
 *
 * Morava em `lib/leads/gbp-audit.ts`. Saiu de lá quando a visibilidade passou a
 * precisar do mesmo parser: os dois domínios não podem arrastar um ao outro só
 * para converter uma data, e `gbp-audit.ts` é grande.
 *
 * A API devolve `YYYY-MM-DD HH:MM:SS +00:00`. O formato foi conferido contra
 * payload real duas vezes — avaliações em 2026-09-04, visibilidade em
 * 2026-09-10 —, o que é mais do que a suposição original tinha.
 */
export function dataForSeoTimeToIso(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) /, "$1T$2")
  const ms = Date.parse(normalized)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}
