/**
 * Conformidade legal a partir dos caminhos que o site já linka.
 *
 * Não custa coleta nova: `internalPaths` guarda até 40 caminhos por página
 * desde a primeira onda, então a regra responde sobre todo snapshot que já
 * existe, sem recoletar nada.
 *
 * O que ela não enxerga: banner de cookies e cookie disparado antes do
 * consentimento. Os dois dependem do HTML da página, não do caminho dela, e
 * ficam para quando o parse ganhar o sinal.
 */
export type ComplianceIssueId = "no_privacy_policy" | "no_terms"

/**
 * Um post de blog sobre privacidade não é uma política de privacidade. Sem este
 * corte, qualquer site que escreva sobre LGPD passaria no teste.
 */
const EDITORIAL_SEGMENT =
  /^(blog|not[ií]cias|artigos|news|novidades|posts?|categoria|tag)$/

const PRIVACY_WORDS = ["privacidade", "privacy"]
const TERMS_WORDS = ["termos", "terms"]

/** "Uso" sozinho aparece em qualquer lugar; só conta ao lado de "condições". */
const CONDITIONS_WORDS = ["condicoes", "condições"]
const USE_WORDS = ["uso", "use"]

/**
 * Quebra o caminho em segmentos e cada segmento em palavras, para que
 * `politica-de-privacidade`, `privacy-policy` e
 * `politica-de-privacidade-e-cookies` respondam igual.
 */
function contentWords(path: string): string[][] {
  const withoutQuery = path.split("?")[0] ?? path
  const segments = withoutQuery.split("/").filter(Boolean)
  if (segments.some((segment) => EDITORIAL_SEGMENT.test(segment))) return []
  return segments.map((segment) =>
    segment.toLowerCase().split(/[-_.]+/).filter(Boolean),
  )
}

function anyWord(words: string[], candidates: readonly string[]): boolean {
  return words.some((word) => candidates.includes(word))
}

function isPrivacyPath(path: string): boolean {
  return contentWords(path).some((words) => anyWord(words, PRIVACY_WORDS))
}

function isTermsPath(path: string): boolean {
  return contentWords(path).some(
    (words) =>
      anyWord(words, TERMS_WORDS) ||
      (anyWord(words, CONDITIONS_WORDS) && anyWord(words, USE_WORDS)),
  )
}

/**
 * Recebe os caminhos já normalizados do crawl — os mesmos que alimentam
 * `no_service_pages` e `no_blog`.
 */
export function complianceIssuesForPaths(
  paths: readonly string[],
): ComplianceIssueId[] {
  const issues: ComplianceIssueId[] = []
  if (!paths.some(isPrivacyPath)) issues.push("no_privacy_policy")
  if (!paths.some(isTermsPath)) issues.push("no_terms")
  return issues
}
