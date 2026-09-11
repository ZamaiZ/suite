/**
 * Aba e tema são o mesmo eixo: o contador da aba é a contagem do grupo da
 * coluna. Um tipo só evita a tradução no meio do caminho — que é por onde a
 * trilha e a lista da tela já divergiram uma vez no GBP.
 *
 * Sem campo `icon`: nem a barra do Website nem a do GBP renderizam ícone, e
 * três barras de etapa que diferem custam mais do que o ícone entrega.
 */
export type VisibilityStepTabId =
  "panorama" | "keywords" | "paginas" | "validacao"

export const VISIBILITY_STEP_TABS: ReadonlyArray<{
  id: VisibilityStepTabId
  label: string
}> = [
  { id: "panorama", label: "Panorama" },
  { id: "keywords", label: "Keywords" },
  { id: "paginas", label: "Páginas" },
  { id: "validacao", label: "Validação" },
]
