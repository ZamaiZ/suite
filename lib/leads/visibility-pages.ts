import {
  VISIBILITY_INTENT_LABELS,
  VISIBILITY_INTENT_MIN_PROBABILITY,
  type VisibilityHost,
  type VisibilityKeywordRow,
  type VisibilitySnapshot,
  type VisibilityUrl,
} from "./visibility-audit.ts"

/**
 * Leituras agregadas da visibilidade: por página, por intenção e a participação
 * do host canônico.
 *
 * Tudo aqui já vinha na resposta desde a correção de confiabilidade e não era
 * lido. A agregação é o que transforma mil linhas soltas em três frases que o
 * analista leva para a reunião.
 */

export type VisibilityPageRow = {
  url: VisibilityUrl
  keywords: number
  traffic: number
  bestPosition: number | null
}

/**
 * Agrupa por URL completa. Linha sem URL não entra: sem host não dá para dizer
 * de que página se está falando, e inventar o host é o defeito que a correção
 * de confiabilidade acabou de remover.
 */
export function visibilityPages(
  snapshot: VisibilitySnapshot,
): VisibilityPageRow[] {
  const byUrl = new Map<string, VisibilityPageRow>()
  for (const row of snapshot.keywords) {
    const key = row.url?.full ?? row.url?.path
    if (!row.url || !key) continue
    const found = byUrl.get(key) ?? {
      url: row.url,
      keywords: 0,
      traffic: 0,
      bestPosition: null,
    }
    found.keywords += 1
    found.traffic += row.traffic ?? 0
    const position = row.position.value
    if (
      position !== null &&
      (found.bestPosition === null || position < found.bestPosition)
    ) {
      found.bestPosition = position
    }
    byUrl.set(key, found)
  }
  // Por tráfego, não por contagem: a página que sustenta o domínio nem sempre é
  // a que tem mais termos.
  return [...byUrl.values()].sort((left, right) => right.traffic - left.traffic)
}

export type VisibilityIntentRow = {
  id: string
  label: string
  keywords: number
  traffic: number
}

const UNCLASSIFIED_ID = "unclassified"

function isConfident(row: VisibilityKeywordRow): boolean {
  const intent = row.intent
  if (!intent) return false
  // `probability: null` é linha v1, que não tinha o dado: ela conta com o
  // rótulo que tinha, em vez de virar "sem classificação" num snapshot antigo.
  if (intent.probability === null) return true
  return intent.probability >= VISIBILITY_INTENT_MIN_PROBABILITY
}

/**
 * Distribuição de intenção.
 *
 * As keywords sem classificação confiável entram como **uma linha própria**, e
 * não somem da conta: um terço das classificações medidas ficou abaixo do
 * limiar, e escondê-las faria as porcentagens fecharem em menos de 100 sem
 * explicar por quê.
 */
export function visibilityIntentBreakdown(
  snapshot: VisibilitySnapshot,
): VisibilityIntentRow[] {
  const byId = new Map<string, VisibilityIntentRow>()
  for (const row of snapshot.keywords) {
    const confident = isConfident(row)
    const id = confident && row.intent ? row.intent.label : UNCLASSIFIED_ID
    const label =
      confident && row.intent
        ? VISIBILITY_INTENT_LABELS[row.intent.label]
        : "Sem classificação confiável"
    const found = byId.get(id) ?? { id, label, keywords: 0, traffic: 0 }
    found.keywords += 1
    found.traffic += row.traffic ?? 0
    byId.set(id, found)
  }
  return [...byId.values()].sort((left, right) => {
    // A linha de "sem classificação" fica por último mesmo quando é a maior:
    // ela é a ressalva da leitura, não o resultado dela.
    if (left.id !== right.id) {
      if (left.id === UNCLASSIFIED_ID) return 1
      if (right.id === UNCLASSIFIED_ID) return -1
    }
    return right.keywords - left.keywords
  })
}

/**
 * Fração do tráfego orgânico que está no host canônico.
 *
 * `null` sem hosts ou sem tráfego: **trilha sem escala mente pior que trilha
 * ausente**, e quem consome usa o `null` para não desenhar medidor nenhum.
 */
export function visibilityCanonicalTrafficShare(
  hosts: ReadonlyArray<VisibilityHost>,
): number | null {
  if (hosts.length === 0) return null
  const total = hosts.reduce((sum, host) => sum + host.traffic, 0)
  if (total <= 0) return null
  const canonical = hosts
    .filter((host) => host.isCanonical)
    .reduce((sum, host) => sum + host.traffic, 0)
  return canonical / total
}
