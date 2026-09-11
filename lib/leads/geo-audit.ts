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
  mentions: number
  aiSearchVolume: number | null
  /** Está em `GEO_AUTHORITY_DOMAINS` — Wikipédia, Reddit ou YouTube. */
  isAuthority: boolean
}

export type GeoCitationPrompt = {
  question: string
  aiSearchVolume: number | null
  /** `last_response_at`: quando a IA respondeu isso pela última vez. */
  at: string | null
  sources: Array<{
    domain: string
    url: string | null
    title: string | null
    rank: number | null
  }>
  /** O domínio do lead está entre as fontes desta resposta. */
  leadCited: boolean
}

/**
 * Citações em IA, lidas de `llm_mentions` com `platform: google`.
 *
 * **Trocou de via em 2026-09-11.** Antes eram domínios de um catálogo casados
 * por backlink; a onda 0 reprovou aquela via com controle positivo — três
 * formas de filtro, zero nas três, contra um domínio com dez links provados em
 * Reddit e YouTube. O índice de backlinks funciona e simplesmente não tem essas
 * fontes.
 *
 * Trocar a forma foi seguro porque `citations` nunca foi gravada diferente de
 * `null`: a coleta base não coleta este campo.
 */
export type GeoCitations = {
  /**
   * Procedência fixada no próprio dado.
   *
   * Um segundo valor vindo de outra via não pode ser comparado com este sem a
   * tela dizer que o método mudou — é a lição do `maps-task.ts`, onde métodos
   * divergentes na mesma série temporal produziram número sem significado.
   */
  source: "llm_mentions_google"
  /** `total.mentions` do alvo: em quantas respostas de IA o lead aparece. */
  mentions: number
  aiSearchVolume: number | null
  /**
   * Os domínios que a IA cita **nas respostas em que o lead aparece**.
   *
   * Não é "quem linka para o lead". É o que a IA lê quando fala do espaço dele
   * — e a tela precisa dizer isso com essas palavras, porque as duas leituras
   * levam a ações opostas.
   */
  sources: GeoCitationSource[]
  /** O domínio do lead aparece entre as fontes que a IA citou. */
  domainCitedAsSource: boolean
  /**
   * `null` = **não pedido**. A leitura por pergunta é uma segunda chamada paga
   * e só roda quando `mentions > 0` — lead sem menção não paga US$ 0,107 por
   * uma chamada que não pode trazer nada.
   */
  prompts: GeoCitationPrompt[] | null
  truncated: boolean
}

/**
 * Por qual critério o alvo foi medido.
 *
 * As duas listas de concorrentes que já pagamos são complementares e nenhuma
 * está completa: `/backlinks/competitors/live` traz **domínio sem nome**, e os
 * concorrentes da malha trazem **nome sem domínio**. Derivar o nome do domínio
 * funciona em `conversion.com.br` → "Conversion" e falha em
 * `agenciamestre.com` → "agenciamestre", que não casa com "Agência Mestre".
 *
 * Medir alvos por critérios diferentes sem dizer qual **distorce a comparação
 * para o lado do lead**, que é o único com nome garantido. Então o critério
 * vai gravado, e a tela marca quem foi medido só pelo domínio.
 */
export type GeoMentionMeasuredBy = "brand_and_domain" | "domain"

export type GeoMentionTarget = {
  key: string
  label: string
  isLead: boolean
  measuredBy: GeoMentionMeasuredBy
  mentions: number
  aiSearchVolume: number | null
}

/**
 * Concorrência em IA — quem mais a IA cita **nas mesmas respostas**.
 *
 * **Derivada, não comprada.** A versão anterior chamava `multi_target_metrics`
 * e comparava o total de cada domínio no dataset inteiro contra o do lead.
 * Medido em 2026-09-11, aquilo trouxe `mobills.com.br` com 17.919 menções,
 * `hostgator` com 4.507 e `hostinger` com 3.060 contra as 2 do lead — e o
 * "share" caiu para **0,007%**. Finanças pessoais e hospedagem não competem
 * com uma agência de SEO; elas entraram porque um único prompt poluidor
 * ("como ganhar dinheiro na internet rápido") trouxe 22 fontes genéricas, e
 * porque o endpoint mede **outro universo**: o dataset inteiro, não as
 * respostas do lead.
 *
 * A conta certa já estava nas fontes das perguntas medidas, de graça. Ela dá
 * **10,6%** para este lead — a mesma ordem de grandeza dos 9% que o relatório
 * de referência dá para a PuroClean, medida do mesmo jeito.
 *
 * Economia: US$ 0,10 por lead, e um número que deixa de ser lisonjeiro ou
 * esmagador conforme os portais grandes que entrarem na amostra.
 */
export type GeoAiMentions = {
  source: "prompt_sources"
  /**
   * Quantas respostas de IA entraram na conta. **É o universo declarado**, e a
   * tela precisa mostrá-lo junto do percentual: "10,6% das citações nas 7
   * respostas em que este negócio aparece" é uma frase verdadeira; "10,6% de
   * participação de mercado" não é.
   */
  promptCount: number
  targets: GeoMentionTarget[]
  /**
   * Citações do lead ÷ todas as citações nas respostas medidas.
   *
   * Denominador conhecido e universo declarado. **Não é taxa de citação nem
   * participação de mercado.**
   */
  share: number | null
}

export type GeoAiOverviewKeyword = {
  keyword: string
  url: string | null
  /**
   * Posição **entre as fontes citadas** pela visão geral de IA — `rank_group`.
   *
   * Não é `rank_absolute`: medido em 2026-09-11 contra 100 linhas reais,
   * `rank_absolute` vale 1 em 93 delas porque é a posição do bloco na SERP, e
   * o bloco é quase sempre o primeiro elemento da página. Ver
   * `docs/auditoria/evidencias/2026-09-10-presenca-em-ia/23-rank-group-vs-absolute.json`.
   */
  position: number | null
  volume: number | null
  etv: number | null
  /**
   * A frase que a visão geral de IA citou do site.
   *
   * `null` significa **não coletado** — snapshot de visibilidade anterior a
   * 2026-09-11 não tem o campo. Nunca "a IA citou sem texto".
   */
  citedText: string | null
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
  /**
   * Soma mensal de todas as keywords, doze meses, do mais recente ao mais
   * antigo.
   *
   * Guarda o agregado e **não** a série por keyword: 110 keywords × 12 meses
   * engordariam o snapshot para responder uma pergunta que ninguém faz por
   * keyword. A pergunta que importa é do mercado — a busca em IA está
   * crescendo neste nicho? —, e ela cabe em doze números.
   */
  monthlyTotals: Array<{ year: number; month: number; volume: number }>
  locationLabel: string
  languageCode: string
}

export type GeoPromptFamily = "discovery" | "problem" | "comparison" | "brand"

/**
 * O que aconteceu com uma execução da sondagem.
 *
 * **`provider_unavailable` não é `mentioned: false`.** Medido em 2026-09-11:
 * os modelos `gemini-3.x` devolveram `50301 rate_limit_exceeded` em três
 * tentativas seguidas, **com custo zero**, do lado do provider. Gravar isso
 * como não-menção **inventa ausência** — é o que `fetchBacklinkSchemeLive`
 * recusa ao não devolver leitura zerada quando a chamada não trouxe nada.
 *
 * `rejected` é `40501 Invalid Field`: bug nosso de corpo, não ausência de
 * dado. Também não cobra, e por isso também some do custo se ninguém marcar.
 *
 * Só `ok` entra no denominador da taxa de menção.
 */
export type GeoPromptRunStatus = "ok" | "provider_unavailable" | "rejected"

export type GeoPromptRun = {
  promptId: string
  provider: string
  modelName: string | null
  at: string
  status: GeoPromptRunStatus
  /** O motivo, quando `status` não é `ok`. Vai para a tela, não para o log. */
  statusMessage: string | null
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
  /** `null` = a comparação com concorrentes não foi coletada neste lead. */
  aiMentions: GeoAiMentions | null
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
  no_authority_citations: "A IA fala do seu mercado sem citar seu site",
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
    source: "llm_mentions_google",
    mentions: asFinite(row.mentions) ?? 0,
    aiSearchVolume: asFinite(row.aiSearchVolume),
    sources: Array.isArray(row.sources)
      ? row.sources.flatMap((entry) => {
          const item = asRecord(entry)
          const domain = asString(item?.domain)
          if (!domain) return []
          return [
            {
              domain,
              mentions: asFinite(item?.mentions) ?? 0,
              aiSearchVolume: asFinite(item?.aiSearchVolume),
              isAuthority: asBool(item?.isAuthority),
            },
          ]
        })
      : [],
    domainCitedAsSource: asBool(row.domainCitedAsSource),
    // `null` é "não pedido"; `[]` é "pedido e vazio". A leitura por pergunta é
    // uma segunda chamada paga, e um lead sem menção nunca a dispara.
    prompts: Array.isArray(row.prompts)
      ? row.prompts.flatMap((entry) => {
          const item = asRecord(entry)
          const question = asString(item?.question)
          if (!question) return []
          return [
            {
              question,
              aiSearchVolume: asFinite(item?.aiSearchVolume),
              at: asString(item?.at),
              sources: Array.isArray(item?.sources)
                ? item.sources.flatMap((sourceEntry) => {
                    const source = asRecord(sourceEntry)
                    const domain = asString(source?.domain)
                    if (!domain) return []
                    return [
                      {
                        domain,
                        url: asString(source?.url),
                        title: asString(source?.title),
                        rank: asFinite(source?.rank),
                      },
                    ]
                  })
                : [],
              leadCited: asBool(item?.leadCited),
            },
          ]
        })
      : null,
    truncated: asBool(row.truncated),
  }
}

function readGeoAiMentions(value: unknown): GeoAiMentions | null {
  const row = asRecord(value)
  if (!row) return null
  return {
    source: "prompt_sources",
    promptCount: asFinite(row.promptCount) ?? 0,
    targets: Array.isArray(row.targets)
      ? row.targets.flatMap((entry) => {
          const item = asRecord(entry)
          const key = asString(item?.key)
          const label = asString(item?.label)
          if (!key || !label) return []
          return [
            {
              key,
              label,
              isLead: asBool(item?.isLead),
              measuredBy:
                item?.measuredBy === "domain" ? "domain" : "brand_and_domain",
              mentions: asFinite(item?.mentions) ?? 0,
              aiSearchVolume: asFinite(item?.aiSearchVolume),
            },
          ]
        })
      : [],
    share: asFinite(row.share),
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
              // Snapshot anterior a 2026-09-11 não tem o campo: `null` é não
              // coletado, e a tela mostra `—`, nunca "citada sem texto".
              citedText: asString(item?.citedText),
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
    monthlyTotals: Array.isArray(row.monthlyTotals)
      ? row.monthlyTotals.flatMap((entry) => {
          const item = asRecord(entry)
          const year = asFinite(item?.year)
          const month = asFinite(item?.month)
          const volume = asFinite(item?.volume)
          if (year === null || month === null || volume === null) return []
          return [{ year, month, volume }]
        })
      : [],
    locationLabel: asString(row.locationLabel) ?? "",
    languageCode: asString(row.languageCode) ?? "",
  }
}

function readGeoPromptRunStatus(value: unknown): GeoPromptRunStatus {
  return value === "provider_unavailable" || value === "rejected"
    ? value
    : "ok"
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
              // Execução gravada antes deste campo existir só podia ser `ok`:
              // a sondagem ainda não distinguia falha de ausência.
              status: readGeoPromptRunStatus(item?.status),
              statusMessage: asString(item?.statusMessage),
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
    aiMentions: readGeoAiMentions(row.aiMentions),
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

  // `null` é "não coletado". Só dado presente afirma.
  //
  // A regra mede **menção sem citação**: a IA fala do espaço do lead e nunca
  // usa o site dele como fonte. Não dispara quando `mentions === 0`, e isso é
  // deliberado — ausência total já é `no_ai_overview_presence`, lida do
  // `ranked_keywords`, e acusar aqui seria a segunda cobrança pela mesma
  // causa. É a mesma regra que faz `no_ai_overview_presence` exigir footprint
  // orgânico.
  if (
    citations !== null &&
    citations.mentions > 0 &&
    !citations.domainCitedAsSource
  ) {
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
