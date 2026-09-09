import {
  gbpDescriptionCoverage,
  GBP_GAP_LABELS,
  type GbpGapId,
} from "@/lib/leads/gbp"
import type { GbpEnrichment } from "@/lib/leads/gbp-enrichment"
import type { LeadLocation } from "@/lib/leads/resolve-location"
import { segmentCategoryDetail } from "@/lib/leads/segment-categories"
import { missingTermsDetail, type TermCoverage } from "@/lib/leads/term-coverage"
import type { GbpRankCheck } from "@/lib/leads/gbp-audit"
import type { GbpReputation } from "@/lib/leads/gbp-reputation"
import type { GbpReputationDelta } from "@/lib/leads/gbp-reputation-compare"
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
  // Perder avaliação e ignorar crítica machucam mais que responder devagar.
  "reviews_removed",
  "negative_replies_ignored",
  "latest_review_unanswered",
  // Categoria errada não é omissão, é o perfil concorrendo na busca errada.
  "category_off_segment",
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
  review_burst: "Distribuir a captação de avaliações no tempo",
  latest_review_unanswered: "Responder a avaliação mais recente",
  negative_replies_ignored: "Responder também as avaliações negativas",
  dormant_reviews: "Retomar a captação de avaliações",
  reviews_removed: "Investigar as avaliações que sumiram",
  category_off_segment: "Revisar a categoria do perfil",
  description_missing_services: "Citar os serviços na descrição",
  description_missing_region: "Citar a região atendida na descrição",
  description_missing_category: "Citar o ramo de atuação na descrição",
}

/**
 * O detalhe nomeia os termos que faltam. "Descrição não cita os serviços" é
 * rótulo; "Não menciona: Cremação, Embalsamamento, Planos funerários" é o texto
 * que o analista cola no relatório.
 */
function coverageDetail(
  id: GbpGapId,
  coverage: TermCoverage | null,
): string | undefined {
  if (!coverage) return undefined
  if (id === "description_missing_services") {
    return missingTermsDetail(coverage.services) ?? undefined
  }
  if (id === "description_missing_region") {
    return missingTermsDetail(coverage.region) ?? undefined
  }
  if (id === "description_missing_category") {
    return missingTermsDetail(coverage.category) ?? undefined
  }
  return undefined
}

/**
 * As três respostas do analista chegam com `source: "analyst"` e com o detalhe
 * dizendo de onde saíram. Nenhuma é medida — quem preencheu foi uma pessoa, e o
 * diagnóstico precisa deixar isso visível.
 */
const percent = (value: number) => `${Math.round(value * 100)}%`
const count = (value: number) => value.toLocaleString("pt-BR")

/**
 * O detalhe carrega o número que originou o achado. "Avaliações concentradas"
 * sem "36 de 46 em dois dias" é rótulo; com ele é diagnóstico.
 */
function reputationDetail(
  id: GbpGapId,
  reputation: GbpReputation | null,
  delta: GbpReputationDelta,
): string | undefined {
  const sample = reputation?.sample
  if (id === "review_burst" && sample?.burst) {
    const dias = sample.burst.days.length
    return (
      `${count(sample.burst.count)} de ${count(sample.size)} em` +
      ` ${count(dias)} ${dias === 1 ? "dia" : "dias"}` +
      ` (${percent(sample.burst.share)} da amostra)`
    )
  }
  if (id === "dormant_reviews" && sample?.daysSinceLast != null) {
    return `Sem avaliação nova há ${count(sample.daysSinceLast)} dias`
  }
  if (id === "weak_review_replies" && sample?.replyRate != null) {
    return `${percent(sample.replyRate)} das avaliações da amostra respondidas`
  }
  if (id === "slow_review_replies" && sample?.replyMedianDays != null) {
    return `Mediana de ${count(Math.round(sample.replyMedianDays))} dias`
  }
  if (id === "negative_replies_ignored" && sample) {
    const high = sample.replyByBand.find((band) => band.band === "high")
    const low = sample.replyByBand.find((band) => band.band === "low")
    if (high?.replyRate != null && low?.replyRate != null) {
      return (
        `${percent(low.replyRate)} das notas baixas respondidas,` +
        ` contra ${percent(high.replyRate)} das altas`
      )
    }
  }
  if (id === "reviews_removed" && delta.status === "ok") {
    return `${count(delta.removed)} sumiram desde a coleta anterior`
  }
  return undefined
}

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

export type GbpOpportunityContext = {
  rankChecks?: GbpRankCheck[]
  keywords?: string[]
  analystReview?: GbpAnalystReview
  reputation?: GbpReputation | null
  reviewsDelta?: GbpReputationDelta
  /** De `gbpDescriptionCoverage`. `null` quando não havia o que medir. */
  descriptionCoverage?: TermCoverage | null
  /** De `segmentCategoryDetail`: os dois lados do desalinhamento. */
  categoryDetail?: string
}

/**
 * Objeto em vez de seis posicionais: a lista cresceu a cada onda, e trocar dois
 * argumentos de mesmo tipo é um erro que nada aqui pegaria.
 */
export function gbpOpportunitiesFromGaps(
  gaps: GbpGapId[],
  context: GbpOpportunityContext = {},
): GbpOpportunityItem[] {
  const rankChecks = context.rankChecks ?? []
  const keywords = context.keywords ?? []
  const analystReview = context.analystReview ?? emptyGbpAnalystReview()
  const reputation = context.reputation ?? null
  const reviewsDelta = context.reviewsDelta ?? {
    status: "blocked" as const,
    reason: "no_previous" as const,
  }
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
    const detail =
      (ANALYST_GAPS.has(id) ? analystDetail(id, analystReview) : undefined) ??
      reputationDetail(id, reputation, reviewsDelta) ??
      coverageDetail(id, context.descriptionCoverage ?? null) ??
      (id === "category_off_segment" ? context.categoryDetail : undefined)
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
   * Obrigatórios: sem eles o detalhe dos achados sairia vazio em silêncio, e os
   * dois montadores divergiriam sem ninguém notar.
   */
  analystReview: GbpAnalystReview
  reputation: GbpReputation | null
  reviewsDelta: GbpReputationDelta
  /**
   * Enriquecimento e localização, para os achados de descrição e categoria
   * nomearem o que falta. Obrigatórios pelo mesmo motivo dos vizinhos: sem
   * eles o detalhe sairia vazio em silêncio.
   */
  enrichment: GbpEnrichment | null | undefined
  location: LeadLocation | null | undefined
}): GbpOpportunityItem[] {
  const items = [
    ...gbpOpportunitiesFromGaps(input.gaps, {
      rankChecks: input.rankChecks,
      keywords: input.keywords,
      analystReview: input.analystReview,
      reputation: input.reputation,
      reviewsDelta: input.reviewsDelta,
      descriptionCoverage: gbpDescriptionCoverage(
        input.enrichment,
        input.location,
      ),
      categoryDetail: segmentCategoryDetail({
        segmentName: input.location?.segmentName,
        category: input.enrichment?.category,
      }),
    }),
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
