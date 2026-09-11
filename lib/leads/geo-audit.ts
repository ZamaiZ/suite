/**
 * Etapa de Presença em IA — tipos, leitor e catálogo de gaps.
 *
 * A etapa **lê** as coletas que já existem em vez de coletar de novo: o
 * snapshot de website responde acessibilidade e conteúdo, o de visibilidade
 * responde citação em AI Overview, e o de backlinks responde citação em fonte
 * de autoridade. Por isso `sources` guarda a data de cada origem: carimbar
 * `collectedAt` como se fosse a hora da medida foi exatamente o defeito que a
 * onda 0 da visibilidade encontrou, onde o índice tinha mediana de 59 dias.
 *
 * Nenhuma LLM julga o que está aqui. Nesta etapa a LLM é objeto de medição,
 * nunca instrumento de análise.
 */

export const GEO_NOTES_MAX = 2000

/**
 * Abaixo disto a home é casca de SPA, não site enxuto.
 *
 * Não reusa `WEBSITE_THIN_CONTENT_WORDS = 300` porque as duas perguntas são
 * diferentes: 300 mede conteúdo raso, e aqui a pergunta é se existe conteúdo
 * no HTML cru — casca de SPA costuma entregar menos de cinquenta palavras.
 */
export const GEO_SERVER_RENDERED_MIN_WORDS = 120

/** Abaixo disto a página não tem conteúdo em formato de pergunta e resposta. */
export const GEO_QUESTION_HEADINGS_MIN = 3

export const GEO_TITLE_MIN = 50
export const GEO_TITLE_MAX = 60
export const GEO_META_MIN = 120
export const GEO_META_MAX = 160

export type GeoAccessibility = {
  llmsTxt: { found: boolean; status: number | null }
  aiCrawlers: Array<{ agent: string; blocked: boolean }>
  blockedAiCrawlers: number
  searchCrawlersBlocked: boolean
  sitemap: { found: boolean; urlCount: number | null }
  noindexTag: boolean
  noindexHeader: boolean
  serverRenderedWords: number
  contentRequiresJs: boolean
}

export type GeoFreshness = {
  datePublished: string | null
  dateModified: string | null
  sitemapLastmod: string | null
  /**
   * `false` quando o snapshot de website é anterior à extensão do parser.
   *
   * Sem este campo, crawl antigo pareceria página sem data nenhuma, e todo
   * lead já auditado ganharia um gap de frescor que nunca foi medido.
   */
  collected: boolean
}

export type GeoContent = {
  identitySchema: string[]
  hasFaqSchema: boolean
  questionHeadings: number
  headingDepth: { levels: number; skips: boolean }
  contactPoints: {
    phone: boolean
    email: boolean
    address: boolean
    whatsapp: boolean
  }
  freshness: GeoFreshness
  titleLength: number | null
  metaDescriptionLength: number | null
}

export type GeoCitationSource = {
  domain: string
  links: number
  firstUrl: string | null
}

export type GeoCitations = {
  catalogVersion: number
  sources: GeoCitationSource[]
  truncated: boolean
}

export type GeoAiOverviewKeyword = {
  keyword: string
  url: string | null
  position: number | null
  volume: number | null
  etv: number | null
}

export type GeoAiOverview = {
  keywords: GeoAiOverviewKeyword[]
  count: number
  etv: number | null
  /**
   * O lead ranqueia organicamente?
   *
   * Sem isto, um domínio invisível no orgânico ganharia o gap de ausência em
   * AI Overview **e** o `not_ranking` da visibilidade — duas cobranças pela
   * mesma causa.
   */
  hasOrganicFootprint: boolean
}

export type GeoAiDemand = {
  keywords: Array<{ keyword: string; aiSearchVolume: number | null }>
  totalAiSearchVolume: number | null
  locationLabel: string
  languageCode: string
}

export type GeoPromptFamily = "discovery" | "problem" | "comparison" | "brand"

export type GeoPromptRun = {
  promptId: string
  provider: string
  modelName: string | null
  at: string
  mentioned: boolean
  /**
   * Ordem da primeira ocorrência entre as marcas detectadas na resposta.
   * **Não** é posição em lista numerada, e a tela precisa dizer isso.
   */
  position: number | null
  /** Sai de `annotations`, e é determinístico: o domínio aparece ou não. */
  domainCited: boolean
  brands: Array<{ name: string; position: number }>
  costUsd: number | null
}

export type GeoPromptVisibility = {
  promptSetVersion: number
  runs: GeoPromptRun[]
  metrics: {
    mentionRate: number
    averagePosition: number | null
    dominance: number | null
    byProvider: Array<{
      provider: string
      mentionRate: number
      averagePosition: number | null
    }>
    competitors: Array<{
      name: string
      mentionRate: number
      averagePosition: number | null
    }>
  }
}

export type GeoSnapshot = {
  version: 1
  domain: string
  collectedAt: string
  costUsd: number | null
  sources: {
    websiteAuditAt: string | null
    visibilityAuditAt: string | null
    backlinkAuditAt: string | null
    /**
     * O crawl lido é da coleta ampliada?
     *
     * `llmsTxt`, `robots.groups`, `robots.aiAgents`, `headings` e `variants`
     * chegaram juntos. `readWebsiteCrawl` normaliza os ausentes para vazio —
     * `readLlmsTxt(undefined)` devolve `{found: false}`, **indistinguível de
     * "checamos e não tem"**. Sem esta bandeira, todo lead auditado antes
     * daquela entrega ganharia `no_llms_txt` e `no_faq_content` por campos que
     * nunca foram medidos.
     *
     * Medido em 2026-09-10 contra os cinco snapshots que existem: os três
     * anteriores a 2026-09-01 têm `variants` ausente e `groups` vazio; os dois
     * posteriores têm ambos preenchidos.
     */
    websiteCrawlExtended: boolean
  }
  accessibility: GeoAccessibility
  content: GeoContent
  /** `null` = onda 2 não rodou neste lead. Lista vazia seria afirmação. */
  citations: GeoCitations | null
  aiOverview: GeoAiOverview | null
  aiDemand: GeoAiDemand | null
  /** `null` = **não sondado**. Os três gaps de sondagem não existem. */
  promptVisibility: GeoPromptVisibility | null
}

export type LeadGeoAudit = {
  id: string
  lead_id: string
  domain: string
  snapshot: GeoSnapshot
  fetched_at: string
  fetched_by: string
}

export const GEO_GAP_IDS = [
  "ai_crawlers_blocked",
  "content_requires_js",
  "no_ai_overview_presence",
  "no_llms_txt",
  "no_faq_content",
  "no_identity_schema",
  "no_freshness_signals",
  "no_machine_readable_contact",
  "no_authority_citations",
  "brand_unknown_to_llms",
  "absent_from_discovery_prompts",
  "outranked_by_competitors",
] as const

export type GeoGapId = (typeof GEO_GAP_IDS)[number]

export const GEO_GAP_LABELS: Record<GeoGapId, string> = {
  ai_crawlers_blocked: "Robôs de IA bloqueados no robots.txt",
  content_requires_js: "Conteúdo só aparece depois do JavaScript",
  no_ai_overview_presence: "Sem citação na visão geral de IA do Google",
  no_llms_txt: "Sem arquivo llms.txt",
  no_faq_content: "Sem conteúdo em formato de pergunta e resposta",
  no_identity_schema: "Sem schema que identifique a empresa",
  no_freshness_signals: "Sem sinal de conteúdo atualizado",
  no_machine_readable_contact: "Contato não legível por máquina",
  no_authority_citations: "Sem citação em fontes que a IA consulta",
  brand_unknown_to_llms: "As IAs não reconhecem a marca",
  absent_from_discovery_prompts: "Ausente quando pedem recomendação",
  outranked_by_competitors: "Citada depois dos concorrentes",
}

export function geoGapLabel(id: GeoGapId): string {
  return GEO_GAP_LABELS[id] ?? id
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function asFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asBool(value: unknown): boolean {
  return value === true
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

function readGeoCitations(value: unknown): GeoCitations | null {
  const row = asRecord(value)
  if (!row) return null
  return {
    catalogVersion: asFinite(row.catalogVersion) ?? 1,
    sources: Array.isArray(row.sources)
      ? row.sources.flatMap((entry) => {
          const item = asRecord(entry)
          const domain = asString(item?.domain)
          if (!domain) return []
          return [
            {
              domain,
              links: asFinite(item?.links) ?? 0,
              firstUrl: asString(item?.firstUrl),
            },
          ]
        })
      : [],
    truncated: asBool(row.truncated),
  }
}

function readGeoAiOverview(value: unknown): GeoAiOverview | null {
  const row = asRecord(value)
  if (!row) return null
  return {
    keywords: Array.isArray(row.keywords)
      ? row.keywords.flatMap((entry) => {
          const item = asRecord(entry)
          const keyword = asString(item?.keyword)
          if (!keyword) return []
          return [
            {
              keyword,
              url: asString(item?.url),
              position: asFinite(item?.position),
              volume: asFinite(item?.volume),
              etv: asFinite(item?.etv),
            },
          ]
        })
      : [],
    count: asFinite(row.count) ?? 0,
    etv: asFinite(row.etv),
    hasOrganicFootprint: asBool(row.hasOrganicFootprint),
  }
}

function readGeoAiDemand(value: unknown): GeoAiDemand | null {
  const row = asRecord(value)
  if (!row) return null
  return {
    keywords: Array.isArray(row.keywords)
      ? row.keywords.flatMap((entry) => {
          const item = asRecord(entry)
          const keyword = asString(item?.keyword)
          if (!keyword) return []
          return [{ keyword, aiSearchVolume: asFinite(item?.aiSearchVolume) }]
        })
      : [],
    totalAiSearchVolume: asFinite(row.totalAiSearchVolume),
    locationLabel: asString(row.locationLabel) ?? "",
    languageCode: asString(row.languageCode) ?? "",
  }
}

function readGeoPromptVisibility(value: unknown): GeoPromptVisibility | null {
  const row = asRecord(value)
  if (!row) return null
  const metrics = asRecord(row.metrics)
  return {
    promptSetVersion: asFinite(row.promptSetVersion) ?? 1,
    runs: Array.isArray(row.runs)
      ? row.runs.flatMap((entry) => {
          const item = asRecord(entry)
          const promptId = asString(item?.promptId)
          const provider = asString(item?.provider)
          const at = asString(item?.at)
          if (!promptId || !provider || !at) return []
          return [
            {
              promptId,
              provider,
              modelName: asString(item?.modelName),
              at,
              mentioned: asBool(item?.mentioned),
              position: asFinite(item?.position),
              domainCited: asBool(item?.domainCited),
              brands: Array.isArray(item?.brands)
                ? item.brands.flatMap((brandEntry) => {
                    const brand = asRecord(brandEntry)
                    const name = asString(brand?.name)
                    if (!name) return []
                    return [{ name, position: asFinite(brand?.position) ?? 0 }]
                  })
                : [],
              costUsd: asFinite(item?.costUsd),
            },
          ]
        })
      : [],
    metrics: {
      mentionRate: asFinite(metrics?.mentionRate) ?? 0,
      averagePosition: asFinite(metrics?.averagePosition),
      dominance: asFinite(metrics?.dominance),
      byProvider: Array.isArray(metrics?.byProvider)
        ? metrics.byProvider.flatMap((entry) => {
            const item = asRecord(entry)
            const provider = asString(item?.provider)
            if (!provider) return []
            return [
              {
                provider,
                mentionRate: asFinite(item?.mentionRate) ?? 0,
                averagePosition: asFinite(item?.averagePosition),
              },
            ]
          })
        : [],
      competitors: Array.isArray(metrics?.competitors)
        ? metrics.competitors.flatMap((entry) => {
            const item = asRecord(entry)
            const name = asString(item?.name)
            if (!name) return []
            return [
              {
                name,
                mentionRate: asFinite(item?.mentionRate) ?? 0,
                averagePosition: asFinite(item?.averagePosition),
              },
            ]
          })
        : [],
    },
  }
}

/**
 * Tolerante por dentro, estrito na chave que identifica o formato.
 *
 * Snapshot sem `domain` nem `collectedAt` não é snapshot desta etapa e vira
 * `null`. O resto degrada para o vazio correspondente, porque uma coleta
 * parcial já gravada tem que continuar legível — a tabela é append-only, e
 * leitor que rejeita apaga histórico na leitura.
 */
export function readGeoSnapshot(value: unknown): GeoSnapshot | null {
  const row = asRecord(value)
  if (!row) return null
  const domain = asString(row.domain)
  const collectedAt = asString(row.collectedAt)
  if (!domain || !collectedAt) return null

  const sources = asRecord(row.sources)
  const accessibility = asRecord(row.accessibility)
  const content = asRecord(row.content)
  const llmsTxt = asRecord(accessibility?.llmsTxt)
  const sitemap = asRecord(accessibility?.sitemap)
  const freshness = asRecord(content?.freshness)
  const contactPoints = asRecord(content?.contactPoints)
  const headingDepth = asRecord(content?.headingDepth)

  return {
    version: 1,
    domain,
    collectedAt,
    costUsd: asFinite(row.costUsd),
    sources: {
      websiteAuditAt: asString(sources?.websiteAuditAt),
      visibilityAuditAt: asString(sources?.visibilityAuditAt),
      backlinkAuditAt: asString(sources?.backlinkAuditAt),
      // Ausente lê como `false`, e `false` é o lado do silêncio: a etapa cala
      // sobre os campos da coleta ampliada em vez de acusá-los.
      websiteCrawlExtended: asBool(sources?.websiteCrawlExtended),
    },
    accessibility: {
      llmsTxt: {
        found: asBool(llmsTxt?.found),
        status: asFinite(llmsTxt?.status),
      },
      aiCrawlers: Array.isArray(accessibility?.aiCrawlers)
        ? accessibility.aiCrawlers.flatMap((entry) => {
            const item = asRecord(entry)
            const agent = asString(item?.agent)
            if (!agent) return []
            return [{ agent, blocked: asBool(item?.blocked) }]
          })
        : [],
      blockedAiCrawlers: asFinite(accessibility?.blockedAiCrawlers) ?? 0,
      searchCrawlersBlocked: asBool(accessibility?.searchCrawlersBlocked),
      sitemap: {
        found: asBool(sitemap?.found),
        urlCount: asFinite(sitemap?.urlCount),
      },
      noindexTag: asBool(accessibility?.noindexTag),
      noindexHeader: asBool(accessibility?.noindexHeader),
      serverRenderedWords: asFinite(accessibility?.serverRenderedWords) ?? 0,
      contentRequiresJs: asBool(accessibility?.contentRequiresJs),
    },
    content: {
      identitySchema: asStringList(content?.identitySchema),
      hasFaqSchema: asBool(content?.hasFaqSchema),
      questionHeadings: asFinite(content?.questionHeadings) ?? 0,
      headingDepth: {
        levels: asFinite(headingDepth?.levels) ?? 0,
        skips: asBool(headingDepth?.skips),
      },
      contactPoints: {
        phone: asBool(contactPoints?.phone),
        email: asBool(contactPoints?.email),
        address: asBool(contactPoints?.address),
        whatsapp: asBool(contactPoints?.whatsapp),
      },
      freshness: {
        datePublished: asString(freshness?.datePublished),
        dateModified: asString(freshness?.dateModified),
        sitemapLastmod: asString(freshness?.sitemapLastmod),
        collected: asBool(freshness?.collected),
      },
      titleLength: asFinite(content?.titleLength),
      metaDescriptionLength: asFinite(content?.metaDescriptionLength),
    },
    // Os quatro abaixo continuam `null` na onda 1. `null` é "não coletado";
    // objeto vazio seria "coletado e vazio", e a tela diria coisas opostas.
    citations: readGeoCitations(row.citations),
    aiOverview: readGeoAiOverview(row.aiOverview),
    aiDemand: readGeoAiDemand(row.aiDemand),
    promptVisibility: readGeoPromptVisibility(row.promptVisibility),
  }
}

/**
 * As regras de gap da etapa.
 *
 * Nenhuma delas repete gap que o pilar de Website já emite. `no_schema`,
 * `robots_blocks_search`, `noindex`, `missing_sitemap` e os `canonical_*`
 * **aparecem na tela desta etapa** — porque o relatório de GEO pergunta por
 * eles — e **não geram oportunidade aqui**. Gap contado em dois pilares
 * penaliza o mesmo defeito duas vezes e muda o significado do score em todo
 * lead já auditado.
 *
 * `no_identity_schema` é a única exceção aparente, e não é repetição:
 * `no_schema` diz que não há schema nenhum; este diz que há schema e nenhum
 * deles declara **quem é a empresa** — um site com `Product` e
 * `BreadcrumbList` passa no primeiro e falha neste.
 */
export function geoGapsForSnapshot(input: {
  snapshot: GeoSnapshot
}): GeoGapId[] {
  const { accessibility, content, citations, aiOverview, promptVisibility } =
    input.snapshot
  const gaps: GeoGapId[] = []

  // Medido em 2026-09-10 contra os cinco snapshots que existiam: três são
  // anteriores à coleta ampliada, e neles `llmsTxt` e `headings` chegam vazios
  // porque `readWebsiteCrawl` normaliza o ausente — não porque foram medidos.
  // Sem esta bandeira, dois gaps disparam falso em todo lead antigo.
  const extended = input.snapshot.sources.websiteCrawlExtended

  if (accessibility.blockedAiCrawlers > 0) gaps.push("ai_crawlers_blocked")
  // `wordCount` sempre existiu: esta regra vale no crawl antigo também.
  if (accessibility.contentRequiresJs) gaps.push("content_requires_js")
  if (extended && !accessibility.llmsTxt.found) gaps.push("no_llms_txt")

  // `schemaTypes` sempre existiu, então identidade vale nos dois casos.
  if (content.identitySchema.length === 0) gaps.push("no_identity_schema")
  // `hasFaqSchema` é confiável no crawl antigo; `questionHeadings` não. Sem
  // schema de FAQ e sem headings coletados a resposta é **não sei**, e não
  // saber cala.
  if (
    !content.hasFaqSchema &&
    extended &&
    content.questionHeadings < GEO_QUESTION_HEADINGS_MIN
  ) {
    gaps.push("no_faq_content")
  }
  // Frescor só acusa quando foi medido.
  if (
    content.freshness.collected &&
    !content.freshness.datePublished &&
    !content.freshness.dateModified &&
    !content.freshness.sitemapLastmod
  ) {
    gaps.push("no_freshness_signals")
  }
  if (
    !content.contactPoints.phone &&
    !content.contactPoints.email &&
    !content.contactPoints.address
  ) {
    gaps.push("no_machine_readable_contact")
  }

  // Só acusa quem ranqueia: um domínio invisível no orgânico já tem o gap
  // `not_ranking` da visibilidade, e acusá-lo aqui seria a segunda cobrança
  // pela mesma causa.
  if (
    aiOverview !== null &&
    aiOverview.hasOrganicFootprint &&
    aiOverview.count === 0
  ) {
    gaps.push("no_ai_overview_presence")
  }

  // `null` é "onda 2 não rodou". Só lista vazia é afirmação de ausência.
  if (citations !== null && citations.sources.length === 0) {
    gaps.push("no_authority_citations")
  }

  // Os três de sondagem não existem enquanto ninguém sondou.
  if (promptVisibility !== null) {
    const brandRuns = promptVisibility.runs.filter((run) =>
      run.promptId.startsWith("brand:"),
    )
    if (brandRuns.length > 0 && brandRuns.every((run) => !run.mentioned)) {
      gaps.push("brand_unknown_to_llms")
    }
    const discoveryRuns = promptVisibility.runs.filter(
      (run) => !run.promptId.startsWith("brand:"),
    )
    if (
      discoveryRuns.length > 0 &&
      discoveryRuns.every((run) => !run.mentioned)
    ) {
      gaps.push("absent_from_discovery_prompts")
    }
    const ours = promptVisibility.metrics.averagePosition
    const best = promptVisibility.metrics.competitors
      .map((item) => item.averagePosition)
      .filter((value): value is number => value !== null)
      .sort((left, right) => left - right)[0]
    if (ours !== null && best !== undefined && best < ours) {
      gaps.push("outranked_by_competitors")
    }
  }

  return gaps
}

export function readLeadGeoAuditRow(
  row: Record<string, unknown> | null,
): LeadGeoAudit | null {
  if (!row) return null
  const id = asString(row.id)
  const leadId = asString(row.lead_id)
  const domain = asString(row.domain)
  const fetchedAt = asString(row.fetched_at)
  const fetchedBy = asString(row.fetched_by)
  const snapshot = readGeoSnapshot(row.snapshot)
  if (!id || !leadId || !domain || !fetchedAt || !fetchedBy || !snapshot) {
    return null
  }
  return {
    id,
    lead_id: leadId,
    domain,
    snapshot,
    fetched_at: fetchedAt,
    fetched_by: fetchedBy,
  }
}
