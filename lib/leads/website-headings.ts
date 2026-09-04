/**
 * Headings coletados de H1 a H6 na ordem do documento.
 *
 * A coleta antiga guardava `h1` e `h2` como listas separadas, o que perdia a
 * ordem entre niveis e impedia validar hierarquia. Aqui a lista e unica e
 * ordenada; `h1` e `h2` continuam existindo no snapshot, derivados desta.
 */
export type WebsiteHeading = {
  level: number
  text: string
}

export const HEADING_TEXT_MAX = 300

export function readHeadings(value: unknown): WebsiteHeading[] {
  if (!Array.isArray(value)) return []
  const headings: WebsiteHeading[] = []
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    const level = row.level
    const text = row.text
    if (typeof level !== "number" || !Number.isFinite(level)) continue
    if (level < 1 || level > 6) continue
    if (typeof text !== "string") continue
    const trimmed = text.trim()
    if (!trimmed) continue
    headings.push({
      level: Math.trunc(level),
      text: trimmed.slice(0, HEADING_TEXT_MAX),
    })
  }
  return headings
}

export function headingsAtLevel(
  headings: readonly WebsiteHeading[],
  level: number,
): string[] {
  return headings
    .filter((heading) => heading.level === level)
    .map((heading) => heading.text)
}

/**
 * Verdadeiro quando a pagina comeca abaixo de H1 ou pula um nivel — H1 seguido
 * de H3, por exemplo. Uma pagina sem heading nenhum nao conta aqui: isso e
 * `missing_h1`, nao problema de hierarquia.
 */
export function headingsSkipLevel(
  headings: readonly WebsiteHeading[],
): boolean {
  if (headings.length === 0) return false
  const first = headings[0]
  if (!first) return false
  if (first.level !== 1) return true
  let previous = first.level
  for (const heading of headings.slice(1)) {
    if (heading.level > previous + 1) return true
    previous = heading.level
  }
  return false
}
