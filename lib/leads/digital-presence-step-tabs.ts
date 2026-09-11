/**
 * Aba e tema são o mesmo eixo: o contador da aba é a contagem do grupo da
 * coluna. Um tipo só evita a tradução no meio do caminho — que é por onde a
 * trilha e a lista da tela já divergiram uma vez no GBP.
 *
 * Duas abas, não quatro. O alinhamento de cada rede com o site vira chip no
 * card daquela rede, então "redes no site" deixa de ser uma seção própria —
 * sobra para a aba do site apenas o que não tem card: rastreamento, redes
 * encontradas sem cadastro, e o veredito de marca.
 *
 * Sem campo `icon`: a barra de abas não renderiza ícone, nem aqui nem nas
 * outras duas etapas.
 */
export type DigitalPresenceStepTabId = "redes" | "site"

export const DIGITAL_PRESENCE_STEP_TABS: ReadonlyArray<{
  id: DigitalPresenceStepTabId
  label: string
}> = [
  { id: "redes", label: "Redes" },
  { id: "site", label: "Site e marca" },
]
