import { GBP_GAP_LABELS, type GbpGapId } from "@/lib/leads/gbp"
import type { GbpRankCheck } from "@/lib/leads/gbp-audit"
import {
  emptyGbpAnalystReview,
  GBP_REPLY_TIME_LABELS,
  gbpDirectoriesInState,
  gbpDirectoryLabel,
  type GbpAnalystReview,
} from "@/lib/leads/gbp-analyst-review"

export type GbpOpportunityImpact = "high" | "medium"

export type GbpOpportunitySource = "machine" | "analyst"

export type GbpOpportunityItem = {
  id: string
  title: string
  impact: GbpOpportunityImpact
  source?: GbpOpportunitySource
  detail?: string
}

export const GBP_REPUTATION_OPPORTUNITY_ID = "reputation_note"

/**
 * A leitura humana da reputação vira oportunidade quando preenchida — mesmo
 * padrão do critério `other` da revisão de site, que é só texto e chega ao
 * diagnóstico pelo conteúdo, sem veredito.
 */
export function gbpReputationOpportunity(
  reputationNote: string | null,
): GbpOpportunityItem[] {
  const note = reputationNote?.trim()
  if (!note) return []
  return [
    {
      id: GBP_REPUTATION_OPPORTUNITY_ID,
      title: "Tratar a reputação nas avaliações",
      impact: "high",
      source: "analyst",
      detail: note,
    },
  ]
}

const HIGH_IMPACT = new Set<GbpGapId>([
  "missing_description",
  "unclaimed",
  "closed",
  "not_in_map_top3",
  "low_rating",
  "unreplied_negative_reviews",
  // Ausente é oportunidade; divergente é dano ativo — um cadastro com NAP
  // errado espalha o erro em vez de apenas não existir.
  "directory_nap_mismatch",
])

const OPPORTUNITY_TITLES: Partial<Record<GbpGapId, string>> = {
  no_secondary_categories: "Adicionar categorias secundárias",
  missing_description: "Criar descrição otimizada",
  thin_description: "Ampliar descrição do perfil",
  unclaimed: "Reivindicar o perfil no Google",
  closed: "Corrigir status de funcionamento",
  low_rating: "Melhorar a nota no Google",
  few_reviews: "Conseguir mais avaliações",
  no_posts: "Publicar no perfil",
  stale_posts: "Atualizar as postagens",
  weak_review_replies: "Responder avaliações recentes",
  few_photos: "Adicionar fotos ao perfil",
  no_photos: "Adicionar fotos ao perfil",
  missing_website: "Incluir o site no perfil",
  website_unmatched: "Alinhar o site do perfil com o cadastro",
  missing_hours: "Informar o horário de funcionamento",
  no_services: "Cadastrar serviços no perfil",
  name_mismatch: "Alinhar o nome com o cadastro",
  unanswered_questions: "Responder as perguntas do perfil",
  unreplied_negative_reviews: "Responder as avaliações negativas",
  slow_review_replies: "Reduzir o tempo de resposta às avaliações",
  missing_directory_listings: "Cadastrar o negócio nos diretórios locais",
  directory_nap_mismatch: "Corrigir o NAP divergente nos diretórios",
}

/**
 * As três respostas do analista chegam com `source: "analyst"` e com o detalhe
 * dizendo de onde saíram. Nenhuma é medida — quem preencheu foi uma pessoa, e o
 * diagnóstico precisa deixar isso visível.
 */
const ANALYST_GAPS = new Set<GbpGapId>([
  "slow_review_replies",
  "missing_directory_listings",
  "directory_nap_mismatch",
])

function analystDetail(
  id: GbpGapId,
  review: GbpAnalystReview,
): string | undefined {
  if (id === "slow_review_replies") {
    const band = review.replyTime.band
    return band ? GBP_REPLY_TIME_LABELS[band] : undefined
  }
  if (id === "missing_directory_listings") {
    const names = gbpDirectoriesInState(review, "absent").map(gbpDirectoryLabel)
    return names.length > 0 ? `Ausente em: ${names.join(", ")}` : undefined
  }
  if (id === "directory_nap_mismatch") {
    const names = gbpDirectoriesInState(review, "nap_mismatch").map(
      gbpDirectoryLabel,
    )
    return names.length > 0 ? `Divergente em: ${names.join(", ")}` : undefined
  }
  return undefined
}

function worstRankKeyword(
  checks: GbpRankCheck[],
  keywords: string[],
): string | null {
  const current = new Set(keywords.map((keyword) => keyword.toLowerCase()))
  const relevant = checks.filter((check) =>
    current.has(check.keyword.toLowerCase()),
  )
  if (relevant.length === 0) return null
  const worst = relevant.reduce((leader, check) => {
    const leaderPos = leader.maps_position ?? Number.POSITIVE_INFINITY
    const nextPos = check.maps_position ?? Number.POSITIVE_INFINITY
    return nextPos > leaderPos ? check : leader
  })
  return worst.keyword
}

export function gbpOpportunitiesFromGaps(
  gaps: GbpGapId[],
  rankChecks: GbpRankCheck[] = [],
  keywords: string[] = [],
  analystReview: GbpAnalystReview = emptyGbpAnalystReview(),
): GbpOpportunityItem[] {
  const items = gaps.map((id) => {
    if (id === "not_in_map_top3") {
      const keyword = worstRankKeyword(rankChecks, keywords)
      return {
        id,
        title: keyword
          ? `Melhorar posição para “${keyword}”`
          : "Melhorar posição no Maps",
        impact: "high" as const,
      }
    }
    const detail = ANALYST_GAPS.has(id)
      ? analystDetail(id, analystReview)
      : undefined
    return {
      id,
      title: OPPORTUNITY_TITLES[id] ?? GBP_GAP_LABELS[id],
      impact: HIGH_IMPACT.has(id) ? ("high" as const) : ("medium" as const),
      ...(ANALYST_GAPS.has(id) ? { source: "analyst" as const } : {}),
      ...(detail ? { detail } : {}),
    }
  })
  items.sort((left, right) => {
    if (left.impact !== right.impact) return left.impact === "high" ? -1 : 1
    return 0
  })
  return items
}

export function mergeGbpOpportunities(input: {
  gaps: GbpGapId[]
  rankChecks?: GbpRankCheck[]
  keywords?: string[]
  reputationNote: string | null
  /**
   * Obrigatório: sem ele o detalhe dos gaps do analista sairia vazio em
   * silêncio, e os dois montadores divergiriam sem ninguém notar.
   */
  analystReview: GbpAnalystReview
}): GbpOpportunityItem[] {
  const items = [
    ...gbpOpportunitiesFromGaps(
      input.gaps,
      input.rankChecks ?? [],
      input.keywords ?? [],
      input.analystReview,
    ),
    ...gbpReputationOpportunity(input.reputationNote),
  ]
  items.sort((left, right) => {
    if (left.impact !== right.impact) return left.impact === "high" ? -1 : 1
    const leftSource = left.source ?? "machine"
    const rightSource = right.source ?? "machine"
    if (leftSource !== rightSource) return leftSource === "machine" ? -1 : 1
    return 0
  })
  return items
}

export const GBP_IMPACT_LABEL: Record<GbpOpportunityImpact, string> = {
  high: "Alto impacto",
  medium: "Médio impacto",
}
