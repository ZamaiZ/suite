/**
 * Regras sobre a cadeia de redirect de cada página da amostra.
 *
 * O crawler sempre seguiu a cadeia — precisava, para chegar ao HTML — mas
 * descartava o caminho. Guardar os saltos não custa requisição nenhuma e
 * responde de uma vez a três perguntas que antes não tinham resposta: quantos
 * saltos, temporário ou permanente, e se volta para onde já passou.
 */

export type WebsiteRedirectHop = {
  /** A URL pedida neste salto. */
  url: string
  /** O status com que ela respondeu (301, 302, 307, 308…). */
  status: number
}

export type RedirectIssueId =
  | "redirect_chain"
  | "temporary_redirect"
  | "redirect_loop"

/** Mais que isto e o salto deixa de ser um ajuste e vira perda de sinal. */
export const REDIRECT_CHAIN_MAX = 1

/** 301 e 308 dizem "mudou de casa"; os outros dizem "volte amanhã". */
const TEMPORARY_STATUS = new Set([302, 303, 307])

export type RedirectPage = {
  redirects: WebsiteRedirectHop[] | null
}

function hasLoop(hops: readonly WebsiteRedirectHop[]): boolean {
  const seen = new Set<string>()
  for (const hop of hops) {
    if (seen.has(hop.url)) return true
    seen.add(hop.url)
  }
  return false
}

/**
 * Páginas com `redirects: null` são ignoradas: elas vêm de coleta anterior a
 * este campo, e tratar ausência como "sem redirect" aprovaria todo snapshot
 * antigo sem ter medido nada.
 */
export function redirectIssuesForPages(
  pages: readonly RedirectPage[],
): RedirectIssueId[] {
  const issues = new Set<RedirectIssueId>()
  for (const page of pages) {
    const hops = page.redirects
    if (!hops || hops.length === 0) continue
    if (hasLoop(hops)) issues.add("redirect_loop")
    if (hops.length > REDIRECT_CHAIN_MAX) issues.add("redirect_chain")
    if (hops.some((hop) => TEMPORARY_STATUS.has(hop.status))) {
      issues.add("temporary_redirect")
    }
  }
  return [...issues]
}
