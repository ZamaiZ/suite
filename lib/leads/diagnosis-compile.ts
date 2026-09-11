import type { BrazilStateCode } from "@/lib/br-locations"
import {
  DIAGNOSIS_PILLAR_LABELS,
  DIAGNOSIS_ROADMAP_CAP,
  emptyDiagnosisProse,
  emptyPillarScore,
  scorePillarOpportunities,
  type DiagnosisDocument,
  type DiagnosisFacts,
  type DiagnosisKeyMetric,
  type DiagnosisMeta,
  type DiagnosisOpportunityRef,
  type DiagnosisPillar,
  type DiagnosisProse,
  type DiagnosisRoadmapItem,
  type DiagnosisSourceLabel,
  type DiagnosisStrength,
} from "./diagnosis-document.ts"
import { diagnosisFindingsFromThemes } from "./diagnosis-themes.ts"
import {
  googleStrengths,
  presenceStrengths,
  visibilityStrengths,
  websiteStrengths,
} from "./diagnosis-strengths.ts"
import { DIGITAL_CHANNEL_LABELS } from "./digital-channels.ts"
import { backlinkGapsForSnapshot } from "./backlinks-audit.ts"
import { seedDiagnosisProse } from "./diagnosis-templates.ts"
import type { LeadDigitalChannel } from "./digital-channels.ts"
import { resolveLeadLocation, type LeadLocation } from "./resolve-location.ts"
import {
  mergeDigitalPresenceOpportunities,
  type DigitalPresenceOpportunityItem,
} from "./digital-presence-opportunities.ts"
import type { DigitalPresenceReview } from "./digital-presence-review.ts"
import type { LeadGbpProfile } from "./gbp.ts"
import { gbpGapsForProfile } from "./gbp.ts"
import { gbpReputation } from "./gbp-reputation.ts"
import {
  mergeGbpOpportunities,
  type GbpOpportunityItem,
} from "./gbp-opportunities.ts"
import {
  formatGbpCount,
  formatGbpRating,
  bestMapsPosition,
} from "./gbp-presenters.ts"
import { type LeadVisibilityAudit } from "./visibility-audit.ts"
import { mergeVisibilityOpportunities } from "./visibility-opportunities.ts"
import { mergeGeoOpportunities } from "./geo-opportunities.ts"
import type { LeadGeoAudit } from "./geo-audit.ts"
import { emptyGeoReview, type GeoReview } from "./geo-review.ts"
import { type VisibilityReview } from "./visibility-review.ts"
import type { BacklinkSnapshot } from "./backlinks-audit.ts"
import { backlinkOpportunitiesFromSnapshot } from "./backlinks-opportunities.ts"
import { formatVisibilityMetric } from "./visibility-presenters.ts"
import {
  napCheckForCrawl,
  websiteGapsForAudit,
  type LeadWebsiteAudit,
} from "./website-audit.ts"
import {
  mergeWebsiteOpportunities,
  missingSecurityHeaderLabels,
  napMismatchLabels,
} from "./website-opportunities.ts"
import { websiteMinPerformance } from "./website-pagespeed.ts"
import { gbpJobQueued } from "./gbp-audit.ts"

export { diagnosisFactsFingerprint } from "./diagnosis-document.ts"

export type DiagnosisCompileInput = {
  companyName: string
  domain: string
  channels: ReadonlyArray<LeadDigitalChannel>
  gbpProfile: LeadGbpProfile | null
  websiteAudit: LeadWebsiteAudit | null
  presenceReview: DigitalPresenceReview
  presenceToday: string
  visibilityAudit: LeadVisibilityAudit | null
  /** `null` = etapa nao coletada. O pilar entra como **nao medido**. */
  geoAudit: LeadGeoAudit | null
  geoReview: GeoReview
  /**
   * Julgamento do analista da etapa de Visibilidade. Opcional porque nasce
   * ausente em todo lead já auditado antes da tabela existir.
   */
  visibilityReview?: VisibilityReview
  /** Autoridade externa. Opcional: nasce ausente em todo lead já auditado. */
  backlinkSnapshot?: BacklinkSnapshot | null
  generatedAt: string
  previousProse?: DiagnosisProse | null
  leadCity: string | null
  leadStateCode: BrazilStateCode | null
  segmentName: string | null
}

function metric(id: string, label: string, value: string): DiagnosisKeyMetric {
  return { id, label, value }
}

function toRef(item: {
  id: string
  title: string
  impact: "high" | "medium"
  source?: "machine" | "analyst"
  detail?: string
}): DiagnosisOpportunityRef {
  return {
    id: item.id,
    title: item.title,
    impact: item.impact,
    source: item.source ?? "machine",
    ...(item.detail ? { detail: item.detail } : {}),
  }
}

function roadmapFrom(
  pillar: DiagnosisPillar,
  items: ReadonlyArray<DiagnosisOpportunityRef>,
): DiagnosisRoadmapItem[] {
  return items.map((item) => ({
    id: `${pillar}:${item.id}`,
    pillar,
    title: item.title,
    impact: item.impact,
    evidence: item.detail?.trim() || DIAGNOSIS_PILLAR_LABELS[pillar],
  }))
}

function buildSources(input: DiagnosisCompileInput): DiagnosisSourceLabel[] {
  const sources: DiagnosisSourceLabel[] = []
  if (input.gbpProfile) {
    sources.push("Google Places")
    const vendor = input.gbpProfile.enrichment?.source
    if (vendor === "dataforseo") sources.push("DataForSEO")
    if (vendor === "serpapi") sources.push("SerpAPI")
  }
  if (input.websiteAudit) {
    sources.push("Coleta do site")
    if (input.websiteAudit.pagespeed) sources.push("PageSpeed Insights")
    sources.push("Revisão do analista")
  }
  if (input.visibilityAudit) {
    if (input.visibilityAudit.snapshot.source === "dataforseo_labs") {
      if (!sources.includes("DataForSEO")) sources.push("DataForSEO")
    } else if (!sources.includes("SerpAPI")) {
      sources.push("SerpAPI")
    }
  }
  return sources
}

function buildLimitations(input: DiagnosisCompileInput): string[] {
  const lines = [
    "A coleta do site analisa um conjunto limitado de páginas e não substitui uma auditoria técnica completa.",
    "Métricas de tráfego e volume de keywords são estimativas do provedor e podem variar.",
  ]
  if (input.websiteAudit) {
    lines.push(
      "Tags de marketing instaladas apenas via GTM podem não aparecer no HTML bruto.",
    )
  }
  if (input.gbpProfile) {
    lines.push(
      "Contagens de fotos e campos enriquecidos dependem do provedor configurado (Places / DataForSEO / SerpAPI).",
    )
  }
  lines.push(
    "Achados de revisão visual refletem o julgamento do analista no momento da coleta.",
  )
  return lines
}

function googleOpportunities(
  profile: LeadGbpProfile,
  companyName: string,
  today: string,
  location: LeadLocation,
): GbpOpportunityItem[] {
  const gaps = gbpGapsForProfile(
    profile.payload,
    companyName,
    profile.matched_website_key,
    profile.enrichment,
    {
      posts: profile.posts,
      postsReady:
        profile.posts !== null && !gbpJobQueued(profile.jobs, "updates"),
      reviews: profile.reviews,
      reviewsReady:
        profile.reviews !== null && !gbpJobQueued(profile.jobs, "reviews"),
      qna: profile.qna,
      rankKeywords: profile.rank_keywords,
      rankChecks: profile.rankChecks,
      analystReview: profile.analyst_review,
      today,
      reviewsDelta: profile.reviews_delta,
      location,
    },
  )
  const reputation = gbpReputation({
    reviews: profile.reviews,
    distribution: profile.enrichment?.ratingDistribution ?? null,
    today,
  })
  return mergeGbpOpportunities({
    gaps,
    reputation,
    reviewsDelta: profile.reviews_delta,
    analystReview: profile.analyst_review,
    rankChecks: profile.rankChecks,
    keywords: profile.rank_keywords,
    reputationNote: profile.reputation_note,
    enrichment: profile.enrichment,
    location,
  })
}

function googleMetrics(profile: LeadGbpProfile): DiagnosisKeyMetric[] {
  const rating = formatGbpRating(profile.payload.rating)
  const reviews = formatGbpCount(profile.payload.userRatingCount)
  const mapsPos = bestMapsPosition(profile.rank_keywords, profile.rankChecks)
  return [
    metric("rating", "Nota", rating ?? "—"),
    metric("reviews", "Avaliações", reviews ?? "—"),
    metric(
      "maps",
      "Melhor posição Maps",
      mapsPos != null ? String(mapsPos) : "—",
    ),
  ]
}

function websiteMetrics(audit: LeadWebsiteAudit): DiagnosisKeyMetric[] {
  const minPerf = websiteMinPerformance(audit.pagespeed)
  return [
    metric("pages", "Páginas coletadas", String(audit.crawl.pages.length)),
    metric("https", "HTTPS", audit.crawl.https ? "Sim" : "Não"),
    metric(
      "performance",
      "Performance (mín.)",
      minPerf != null ? String(minPerf) : "—",
    ),
  ]
}

function presenceMetrics(
  items: ReadonlyArray<DigitalPresenceOpportunityItem>,
  channelCount: number,
): DiagnosisKeyMetric[] {
  return [
    metric("channels", "Redes cadastradas", String(channelCount)),
    metric("alerts", "Alertas", String(items.length)),
  ]
}

function visibilityMetrics(audit: LeadVisibilityAudit): DiagnosisKeyMetric[] {
  const snap = audit.snapshot
  return [
    metric(
      "keywords",
      "Keywords",
      // Sem footprint medido o documento cala. O `?? keywords.length` de
      // antes fazia a amostra virar footprint no PDF que o cliente recebe.
      formatVisibilityMetric(snap.metrics.keywordCount),
    ),
    metric(
      "traffic",
      "Tráfego estimado",
      formatVisibilityMetric(snap.metrics.estimatedTraffic),
    ),
    metric(
      "top3",
      "Top 3",
      formatVisibilityMetric(snap.metrics.positionBuckets?.top3 ?? null),
    ),
  ]
}

/**
 * As tres metricas que respondem "como esta a presenca em IA" num numero.
 *
 * Nenhuma delas inventa: crawler bloqueado e contagem, citacao em AI Overview
 * so existe quando a visibilidade foi coletada, e o llms.txt so e afirmado
 * quando o crawl e da coleta ampliada — no crawl antigo o arquivo nunca foi
 * buscado, e dizer "ausente" seria afirmar o que ninguem mediu.
 */
function geoMetrics(audit: LeadGeoAudit): DiagnosisKeyMetric[] {
  const snap = audit.snapshot
  const bloqueados = snap.accessibility.blockedAiCrawlers
  return [
    metric(
      "ai_crawlers",
      "Robôs de IA liberados",
      snap.accessibility.aiCrawlers.length === 0
        ? "—"
        : `${snap.accessibility.aiCrawlers.length - bloqueados}/${snap.accessibility.aiCrawlers.length}`,
    ),
    metric(
      "ai_overview",
      "Citações em IA do Google",
      snap.aiOverview === null ? "—" : String(snap.aiOverview.count),
    ),
    metric(
      "llms_txt",
      "llms.txt",
      snap.sources.websiteCrawlExtended
        ? snap.accessibility.llmsTxt.found
          ? "Publicado"
          : "Ausente"
        : "—",
    ),
  ]
}

function mergeRoadmap(
  batches: ReadonlyArray<ReadonlyArray<DiagnosisRoadmapItem>>,
): DiagnosisRoadmapItem[] {
  const seen = new Set<string>()
  const merged: DiagnosisRoadmapItem[] = []
  const flat = batches.flat().slice()
  flat.sort((left, right) => {
    if (left.impact !== right.impact) return left.impact === "high" ? -1 : 1
    return left.title.localeCompare(right.title, "pt-BR")
  })
  for (const item of flat) {
    const key = item.title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(item)
    if (merged.length >= DIAGNOSIS_ROADMAP_CAP) break
  }
  return merged
}

export function compileDiagnosisFacts(
  input: DiagnosisCompileInput,
): DiagnosisFacts {
  const location = resolveLeadLocation(
    {
      city: input.leadCity,
      state_code: input.leadStateCode,
      segment: input.segmentName ? { name: input.segmentName } : null,
    },
    input.gbpProfile
      ? { formattedAddress: input.gbpProfile.payload.formattedAddress ?? null }
      : null,
  )
  const city = location.city

  const googleItems: DiagnosisOpportunityRef[] = input.gbpProfile
    ? googleOpportunities(
        input.gbpProfile,
        input.companyName,
        input.presenceToday,
        location,
      ).map(toRef)
    : []
  const nap = input.gbpProfile
    ? {
        phone: input.gbpProfile.payload.nationalPhoneNumber,
        address: input.gbpProfile.payload.formattedAddress,
      }
    : null
  const websiteGaps = input.websiteAudit
    ? websiteGapsForAudit(
        input.websiteAudit.crawl,
        input.companyName,
        nap,
        input.websiteAudit.pagespeed,
        input.gbpProfile?.enrichment?.services?.map((item) => item.title) ?? [],
      )
    : []
  // Backlinks entra no pilar de Website, ao lado do crawl e da revisão do
  // analista. É a mesma junção que já existe entre máquina e analista — o
  // catálogo é separado porque `websiteGapsForAudit` não recebe backlinks.
  const websiteItems: DiagnosisOpportunityRef[] = [
    ...(input.websiteAudit
      ? mergeWebsiteOpportunities(
          websiteGaps,
          {
            minPerformance: websiteMinPerformance(input.websiteAudit.pagespeed),
            missingSecurityHeaders: missingSecurityHeaderLabels(
              input.websiteAudit.crawl,
            ),
            napMismatches: napMismatchLabels(
              napCheckForCrawl(input.websiteAudit.crawl, nap),
            ),
          },
          input.websiteAudit.review,
        ).map(toRef)
      : []),
    ...backlinkOpportunitiesFromSnapshot(input.backlinkSnapshot ?? null).map(
      toRef,
    ),
  ].sort((left, right) => {
    if (left.impact !== right.impact) return left.impact === "high" ? -1 : 1
    return 0
  })

  const presenceRaw = mergeDigitalPresenceOpportunities({
    signals: input.websiteAudit?.crawl.signals ?? null,
    channels: input.channels,
    review: input.presenceReview,
    today: input.presenceToday,
  })
  const presenceItems = presenceRaw.map(toRef)

  const visibilityItems: DiagnosisOpportunityRef[] = input.visibilityAudit
    ? mergeVisibilityOpportunities({
        snapshot: input.visibilityAudit.snapshot,
        companyName: input.companyName,
        city,
      }).map(toRef)
    : []

  const geoItems: DiagnosisOpportunityRef[] = input.geoAudit
    ? mergeGeoOpportunities({
        snapshot: input.geoAudit.snapshot,
        review: input.geoReview ?? emptyGeoReview(),
      }).map(toRef)
    : []

  const idSet = new Set<string>([
    ...googleItems.map((item) => item.id),
    ...websiteItems.map((item) => item.id),
    ...presenceItems.map((item) => item.id),
    ...visibilityItems.map((item) => item.id),
    ...geoItems.map((item) => item.id),
  ])

  const socialCount = input.channels.filter((channel) =>
    [
      "instagram",
      "facebook",
      "linkedin",
      "youtube",
      "tiktok",
      "pinterest",
      "twitter",
    ].includes(channel.type),
  ).length

  // Pontos fortes. Fora do scorecard de propósito: entram no documento, não na
  // nota. Cada um traz o número que o sustenta — elogio sem medida é enfeite.
  const strengths: DiagnosisStrength[] = [
    ...(input.gbpProfile
      ? googleStrengths({
          rating: input.gbpProfile.payload.rating,
          userRatingCount: input.gbpProfile.payload.userRatingCount,
          weekdayDescriptions: input.gbpProfile.payload.weekdayDescriptions,
          enrichment: input.gbpProfile.enrichment,
          reputation: gbpReputation({
            reviews: input.gbpProfile.reviews,
            distribution:
              input.gbpProfile.enrichment?.ratingDistribution ?? null,
            today: input.presenceToday,
          }),
          rankChecks: input.gbpProfile.rankChecks,
        })
      : []),
    ...(input.websiteAudit
      ? websiteStrengths({
          pagespeed: input.websiteAudit.pagespeed,
          https: input.websiteAudit.crawl.https,
          missingSecurityHeaders: missingSecurityHeaderLabels(
            input.websiteAudit.crawl,
          ),
          gaps: websiteGaps,
          backlinkGaps: input.backlinkSnapshot
            ? backlinkGapsForSnapshot(input.backlinkSnapshot)
            : null,
        })
      : []),
    ...presenceStrengths({
      networks: input.channels
        .filter((channel) => channel.type !== "website")
        .map((channel) => ({
          label: DIGITAL_CHANNEL_LABELS[channel.type],
          // Canal sem id é estado real (o cadastro aceita canal ainda não
          // gravado), e a revisão de presença é indexada por id — sem id não há
          // entrada para achar.
          lastPostedOn: channel.id
            ? (input.presenceReview.networks[channel.id]?.lastPostedOn ?? null)
            : null,
        })),
      today: input.presenceToday,
      measurementIds: input.websiteAudit?.crawl.signals.measurementIds ?? null,
    }),
    ...visibilityStrengths(input.visibilityAudit?.snapshot ?? null),
  ]

  return {
    strengths,
    scorecard: {
      google: scorePillarOpportunities(googleItems),
      website: scorePillarOpportunities(websiteItems),
      presence: scorePillarOpportunities(presenceItems),
      visibility: scorePillarOpportunities(visibilityItems),
      // Sem coleta o pilar e **nao medido**, nunca nota cheia: e a diferenca
      // entre "medimos e esta limpo" e "ninguem olhou".
      geo: input.geoAudit
        ? scorePillarOpportunities(geoItems)
        : emptyPillarScore(),
    },
    findings: diagnosisFindingsFromThemes({ opportunityIds: idSet }),
    roadmap: mergeRoadmap([
      roadmapFrom("google", googleItems),
      roadmapFrom("website", websiteItems),
      roadmapFrom("presence", presenceItems),
      roadmapFrom("visibility", visibilityItems),
      roadmapFrom("geo", geoItems),
    ]),
    pillars: {
      google: {
        opportunities: googleItems,
        keyMetrics: input.gbpProfile ? googleMetrics(input.gbpProfile) : [],
      },
      website: {
        opportunities: websiteItems,
        keyMetrics: input.websiteAudit
          ? websiteMetrics(input.websiteAudit)
          : [],
      },
      presence: {
        opportunities: presenceItems,
        keyMetrics: presenceMetrics(presenceRaw, socialCount),
      },
      visibility: {
        opportunities: visibilityItems,
        keyMetrics: input.visibilityAudit
          ? visibilityMetrics(input.visibilityAudit)
          : [],
      },
      geo: {
        opportunities: geoItems,
        keyMetrics: input.geoAudit ? geoMetrics(input.geoAudit) : [],
      },
    },
  }
}

export function compileDiagnosisDocument(
  input: DiagnosisCompileInput,
): DiagnosisDocument {
  const location = resolveLeadLocation(
    {
      city: input.leadCity,
      state_code: input.leadStateCode,
      segment: input.segmentName ? { name: input.segmentName } : null,
    },
    input.gbpProfile
      ? { formattedAddress: input.gbpProfile.payload.formattedAddress ?? null }
      : null,
  )
  const city = location.city
  const facts = compileDiagnosisFacts(input)
  const meta: DiagnosisMeta = {
    companyName: input.companyName,
    domain: input.domain,
    city,
    generatedAt: input.generatedAt,
    sources: buildSources(input),
  }
  const seeded = seedDiagnosisProse({ meta, facts })
  const prose: DiagnosisProse = input.previousProse
    ? {
        executiveSummary:
          input.previousProse.executiveSummary.trim() ||
          seeded.executiveSummary,
        commercialHook:
          input.previousProse.commercialHook.trim() || seeded.commercialHook,
        pillarNarratives: {
          google:
            input.previousProse.pillarNarratives.google.trim() ||
            seeded.pillarNarratives.google,
          website:
            input.previousProse.pillarNarratives.website.trim() ||
            seeded.pillarNarratives.website,
          presence:
            input.previousProse.pillarNarratives.presence.trim() ||
            seeded.pillarNarratives.presence,
          visibility:
            input.previousProse.pillarNarratives.visibility.trim() ||
            seeded.pillarNarratives.visibility,
          // Rascunho salvo antes do pilar nao tem a chave. `?? ""` deixa a
          // semente entrar, em vez de quebrar o `.trim()` num `undefined`.
          geo:
            (input.previousProse.pillarNarratives.geo ?? "").trim() ||
            seeded.pillarNarratives.geo,
        },
      }
    : seeded

  return {
    version: 1,
    meta,
    facts,
    prose: prose.executiveSummary ? prose : seeded,
    limitations: buildLimitations(input),
  }
}

export function mergeDiagnosisProse(
  base: DiagnosisProse,
  patch: Partial<DiagnosisProse> | null | undefined,
): DiagnosisProse {
  if (!patch) return base
  return {
    executiveSummary: patch.executiveSummary ?? base.executiveSummary,
    commercialHook: patch.commercialHook ?? base.commercialHook,
    pillarNarratives: {
      ...emptyDiagnosisProse().pillarNarratives,
      ...base.pillarNarratives,
      ...(patch.pillarNarratives ?? {}),
    },
  }
}
