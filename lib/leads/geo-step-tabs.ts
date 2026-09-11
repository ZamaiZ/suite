/**
 * Aba e tema são o mesmo eixo: o contador da aba é a contagem do grupo da
 * coluna. Um tipo só evita a tradução no meio do caminho — que é por onde a
 * trilha e a lista da tela já divergiram uma vez no GBP.
 *
 * Sem campo `icon`: nenhuma barra de etapa deste pipeline renderiza ícone, e
 * uma barra que diferisse das outras custaria mais do que o ícone entrega.
 */
export type GeoStepTabId = "acesso" | "conteudo" | "citacoes" | "sondagem"

export const GEO_STEP_TABS: ReadonlyArray<{
  id: GeoStepTabId
  label: string
}> = [
  { id: "acesso", label: "Acesso" },
  { id: "conteudo", label: "Conteúdo" },
  { id: "citacoes", label: "Citações" },
  { id: "sondagem", label: "Sondagem" },
]
