import {
  type VisibilityGapId,
  type VisibilityKeywordRow,
  type VisibilitySnapshot,
  type VisibilitySource,
  visibilityGapsForSnapshot,
  VISIBILITY_GAP_LABELS,
} from "./visibility-audit.ts"

export type VisibilityCheckStatus = "ok" | "warn" | "pending" | "error"

export type VisibilityCheckItem = {
  id: string
  label: string
  detail: string
  status: VisibilityCheckStatus
}

export type VisibilityCheckSection = {
  id: "overview" | "keywords"
  title: string
  items: VisibilityCheckItem[]
}

export function visibilitySourceLabel(source: VisibilitySource): string {
  if (source === "dataforseo_labs") return "DataForSEO · índice"
  return "SerpAPI · checagem ao vivo"
}

export function formatVisibilityMetric(
  value: number | null,
  digits = 0,
): string {
  if (value === null) return "—"
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  })
}

export function visibilityKeywordIntentLabel(intent: string | null): string {
  if (!intent) return "—"
  if (intent === "informational") return "I"
  if (intent === "commercial") return "C"
  if (intent === "transactional") return "T"
  if (intent === "navigational") return "N"
  return intent.slice(0, 1).toUpperCase()
}

function gapDetail(id: VisibilityGapId): string {
  if (id === "brand_only_visibility") {
    return "No top 10 só aparecem termos de marca"
  }
  if (id === "no_local_top20") {
    return "Nenhuma busca local relevante no top 20"
  }
  if (id === "homepage_only") {
    return "As URLs ranqueadas apontam só para a home"
  }
  if (id === "not_ranking") {
    return "Nenhuma posição orgânica encontrada"
  }
  if (id === "low_organic_traffic") {
    return "Tráfego estimado abaixo do limiar comercial"
  }
  return "Poucas keywords no índice do domínio"
}

export function visibilityCheckSections(input: {
  snapshot: VisibilitySnapshot | null
  companyName: string
  city: string | null
}): VisibilityCheckSection[] {
  if (!input.snapshot) {
    return [
      {
        id: "overview",
        title: "Visibilidade orgânica",
        items: [
          {
            id: "awaiting",
            label: "Coleta",
            detail: "Aguardando análise de visibilidade",
            status: "pending",
          },
        ],
      },
    ]
  }

  const gaps = new Set(
    visibilityGapsForSnapshot({
      snapshot: input.snapshot,
      companyName: input.companyName,
      city: input.city,
    }),
  )
  const overviewIds: VisibilityGapId[] = [
    "not_ranking",
    "brand_only_visibility",
    "no_local_top20",
    "homepage_only",
    "low_organic_traffic",
    "thin_keyword_footprint",
  ]

  return [
    {
      id: "overview",
      title: "Visibilidade orgânica",
      items: overviewIds
        .filter((id) => {
          if (id === "low_organic_traffic" || id === "thin_keyword_footprint") {
            return input.snapshot?.source === "dataforseo_labs" || gaps.has(id)
          }
          return true
        })
        .map((id) => ({
          id,
          label: VISIBILITY_GAP_LABELS[id],
          detail: gapDetail(id),
          status: gaps.has(id) ? ("warn" as const) : ("ok" as const),
        })),
    },
  ]
}

export function sortVisibilityKeywords(
  keywords: ReadonlyArray<VisibilityKeywordRow>,
): VisibilityKeywordRow[] {
  return keywords.slice().sort((left, right) => {
    const leftPos = left.position ?? 9999
    const rightPos = right.position ?? 9999
    if (leftPos !== rightPos) return leftPos - rightPos
    const leftTraffic = left.traffic ?? -1
    const rightTraffic = right.traffic ?? -1
    if (leftTraffic !== rightTraffic) return rightTraffic - leftTraffic
    return left.keyword.localeCompare(right.keyword, "pt-BR")
  })
}
