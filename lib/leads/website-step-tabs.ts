/**
 * Aba e tema são o mesmo eixo: o contador da aba é a contagem do grupo da
 * coluna. Um tipo só evita a tradução no meio do caminho — que é por onde a
 * trilha e a lista da tela já divergiram uma vez no GBP.
 *
 * Sem campo `icon`: a barra de abas não renderiza ícone. A do GBP também não,
 * e duas barras de etapa que diferem custam mais do que o ícone entrega.
 */
export type WebsiteStepTabId =
  | "auditoria"
  | "pagespeed"
  | "validacao"
  | "autoridade"

export const WEBSITE_STEP_TABS: ReadonlyArray<{
  id: WebsiteStepTabId
  label: string
}> = [
  { id: "auditoria", label: "Auditoria" },
  { id: "pagespeed", label: "PageSpeed" },
  { id: "validacao", label: "Validação visual" },
  { id: "autoridade", label: "Autoridade externa" },
]
