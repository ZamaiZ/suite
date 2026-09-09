import type { DiagnosisPillar, DiagnosisStrength } from "./diagnosis-document.ts"
import type { BacklinkGapId } from "./backlinks-audit.ts"

import type { GbpEnrichment } from "./gbp-enrichment.ts"
import type { GbpRankCheck } from "./gbp-audit.ts"
import type { GbpReputation } from "./gbp-reputation.ts"
import type { VisibilitySnapshot } from "./visibility-audit.ts"
import type { WebsiteGapId } from "./website-audit.ts"
import type { WebsiteMeasurementIds } from "./website-audit.ts"
import type { WebsitePagespeedSnapshot } from "./website-pagespeed.ts"

/**
 * Pontos fortes do diagnóstico.
 *
 * O documento de referência **abre** a consolidação com eles, agrupados por
 * dimensão, e é isso que faz o relatório soar como diagnóstico em vez de lista
 * de defeitos. O sistema inteiro era orientado a gap e não sabia elogiar.
 *
 * **Não é o inverso do gap.** `low_rating` dispara abaixo de 4; o inverso seria
 * "nota ≥ 4", que não é elogio — é ausência de problema. Limiar de excelência é
 * outro número, e por isso mora aqui e não lá.
 *
 * **Não entra na nota.** `scorePillarOpportunities()` não sabe da existência
 * deste módulo: somar duas escalas mudaria o score de todo lead já auditado, e
 * o número deixaria de significar o que significa hoje.
 */

/** Nota a partir da qual a reputação vira argumento de venda, não alívio. */
export const STRENGTH_RATING = 4.5

/** Abaixo disto a nota alta não tem lastro: 5,0 com duas avaliações não é nada. */
export const STRENGTH_RATING_MIN_REVIEWS = 10

export const STRENGTH_REPLY_RATE = 0.8

/** Mediana de resposta em dias que separa "responde" de "responde rápido". */
export const STRENGTH_REPLY_DAYS = 2

/** Score do PageSpeed a partir do qual a página é boa, e não apenas aceitável. */
export const STRENGTH_PERFORMANCE = 90

export const STRENGTH_LCP_MS = 2500
export const STRENGTH_CLS = 0.1

/** Dias desde a última publicação que ainda contam como rede ativa. */
export const STRENGTH_SOCIAL_FRESH_DAYS = 30

/** Keywords posicionadas a partir das quais o footprint deixa de ser residual. */
export const STRENGTH_KEYWORD_FOOTPRINT = 50

function strength(
  pillar: DiagnosisPillar,
  id: string,
  title: string,
  detail: string,
): DiagnosisStrength {
  return { id, pillar, title, detail }
}

const count = (value: number) => value.toLocaleString("pt-BR")
const percent = (value: number) => `${Math.round(value * 100)}%`

export function googleStrengths(input: {
  rating: number | null
  userRatingCount: number | null
  weekdayDescriptions: ReadonlyArray<string>
  enrichment: GbpEnrichment | null | undefined
  reputation: GbpReputation | null
  rankChecks: ReadonlyArray<GbpRankCheck>
}): DiagnosisStrength[] {
  const found: DiagnosisStrength[] = []
  const { rating, userRatingCount, enrichment, reputation } = input

  if (
    rating !== null &&
    rating >= STRENGTH_RATING &&
    userRatingCount !== null &&
    userRatingCount >= STRENGTH_RATING_MIN_REVIEWS
  ) {
    found.push(
      strength(
        "google",
        "strong_rating",
        "Reputação sólida no Google",
        `Nota ${rating.toFixed(1)} em ${count(userRatingCount)} avaliações`,
      ),
    )
  }

  const sample = reputation?.sample
  if (sample?.replyRate != null && sample.replyRate >= STRENGTH_REPLY_RATE) {
    found.push(
      strength(
        "google",
        "high_reply_rate",
        "Avaliações respondidas",
        `${percent(sample.replyRate)} da amostra de ${count(sample.size)} respondida`,
      ),
    )
  }
  if (
    sample?.replyMedianDays != null &&
    sample.replyMedianDays <= STRENGTH_REPLY_DAYS
  ) {
    found.push(
      strength(
        "google",
        "fast_replies",
        "Resposta rápida às avaliações",
        `Mediana de ${count(Math.round(sample.replyMedianDays))} dia(s)`,
      ),
    )
  }

  const top3 = input.rankChecks.filter((check) => check.in_top3)
  if (top3.length > 0) {
    found.push(
      strength(
        "google",
        "top3_local",
        "Presença no top 3 do Maps",
        `Top 3 em ${count(top3.length)} de ${count(input.rankChecks.length)} termos monitorados`,
      ),
    )
  }

  // Perfil completo é a soma de quatro ausências de gap. Vale como elogio único
  // porque é o estado que a referência chama de "bem configurado" — e listar
  // quatro elogios separados diria a mesma coisa quatro vezes.
  const complete =
    Boolean(enrichment?.description) &&
    (enrichment?.services?.length ?? 0) > 0 &&
    (enrichment?.additionalCategories.length ?? 0) > 0 &&
    input.weekdayDescriptions.length > 0
  if (complete) {
    found.push(
      strength(
        "google",
        "complete_profile",
        "Ficha completa",
        "Descrição, serviços, categorias secundárias e horários preenchidos",
      ),
    )
  }

  return found
}

export function websiteStrengths(input: {
  pagespeed: WebsitePagespeedSnapshot | null
  https: boolean
  missingSecurityHeaders: ReadonlyArray<string>
  gaps: ReadonlyArray<WebsiteGapId>
  backlinkGaps: ReadonlyArray<BacklinkGapId> | null
}): DiagnosisStrength[] {
  const found: DiagnosisStrength[] = []
  const mobile = input.pagespeed?.mobile ?? null
  const desktop = input.pagespeed?.desktop ?? null

  // Exige as duas estratégias: um site rápido só no desktop é o caso que a
  // referência descreve como problema, não como qualidade.
  if (
    mobile &&
    desktop &&
    mobile.performance >= STRENGTH_PERFORMANCE &&
    desktop.performance >= STRENGTH_PERFORMANCE
  ) {
    found.push(
      strength(
        "website",
        "fast_site",
        "Site rápido",
        `PageSpeed ${mobile.performance} no mobile e ${desktop.performance} no desktop`,
      ),
    )
  }

  const lcp = mobile?.fieldLcpMs ?? mobile?.lcpMs ?? null
  const cls = mobile?.fieldCls ?? mobile?.cls ?? null
  if (lcp !== null && lcp <= STRENGTH_LCP_MS && cls !== null && cls <= STRENGTH_CLS) {
    found.push(
      strength(
        "website",
        "healthy_cwv",
        "Core Web Vitals no verde",
        `LCP ${(lcp / 1000).toFixed(1)}s e CLS ${cls.toFixed(2)} no mobile`,
      ),
    )
  }

  if (input.https && input.missingSecurityHeaders.length === 0) {
    found.push(
      strength(
        "website",
        "secure_site",
        "Site seguro e com headers completos",
        "HTTPS ativo e os seis headers de segurança presentes",
      ),
    )
  }

  const gaps = new Set(input.gaps)
  if (!gaps.has("no_blog") && !gaps.has("no_service_pages")) {
    found.push(
      strength(
        "website",
        "rich_content",
        "Estrutura de conteúdo montada",
        "Há blog e páginas de serviço",
      ),
    )
  }

  // `null` é coleta de backlinks ausente. Sem ela não há perfil limpo a
  // afirmar — só ausência de medida, que não é elogio.
  if (input.backlinkGaps) {
    const backlink = new Set(input.backlinkGaps)
    if (
      !backlink.has("toxic_backlinks") &&
      !backlink.has("link_scheme_detected") &&
      !backlink.has("no_backlinks")
    ) {
      found.push(
        strength(
          "website",
          "clean_link_profile",
          "Perfil de links sem sinal de spam",
          "Sem indício de rede artificial nem de toxicidade",
        ),
      )
    }
  }

  return found
}

export function presenceStrengths(input: {
  networks: ReadonlyArray<{ label: string; lastPostedOn: string | null }>
  today: string
  measurementIds: WebsiteMeasurementIds | null
}): DiagnosisStrength[] {
  const found: DiagnosisStrength[] = []
  const todayMs = Date.parse(input.today)

  const fresh = Number.isFinite(todayMs)
    ? input.networks.filter((network) => {
        const ms = network.lastPostedOn ? Date.parse(network.lastPostedOn) : NaN
        if (!Number.isFinite(ms)) return false
        return (todayMs - ms) / 86_400_000 <= STRENGTH_SOCIAL_FRESH_DAYS
      })
    : []
  if (fresh.length > 0) {
    found.push(
      strength(
        "presence",
        "active_networks",
        "Redes sociais ativas",
        `Publicação recente em: ${fresh.map((item) => item.label).join(", ")}`,
      ),
    )
  }

  const ids = input.measurementIds
  if (ids?.ga4 && ids.gtm) {
    found.push(
      strength(
        "presence",
        "measurement_ready",
        "Medição instalada",
        `GA4 ${ids.ga4} e GTM ${ids.gtm} presentes no HTML`,
      ),
    )
  }

  return found
}

export function visibilityStrengths(
  snapshot: VisibilitySnapshot | null,
): DiagnosisStrength[] {
  if (!snapshot) return []
  const found: DiagnosisStrength[] = []
  const top3 = snapshot.metrics.positionBuckets?.top3 ?? null
  if (top3 !== null && top3 > 0) {
    found.push(
      strength(
        "visibility",
        "organic_top3",
        "Posições no top 3 orgânico",
        `${count(top3)} keyword(s) no top 3`,
      ),
    )
  }
  const keywords = snapshot.metrics.keywordCount ?? null
  if (keywords !== null && keywords >= STRENGTH_KEYWORD_FOOTPRINT) {
    found.push(
      strength(
        "visibility",
        "broad_footprint",
        "Footprint de keywords relevante",
        `${count(keywords)} keywords posicionadas`,
      ),
    )
  }
  return found
}

export const DIAGNOSIS_STRENGTH_EMPTY =
  "Nenhum ponto forte destacado nesta coleta."
