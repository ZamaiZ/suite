/**
 * Tipos da Fase 3 (Pesquisa).
 *
 * Modulo **puro**: sem `server-only` e sem alias, para os testes `.mjs`
 * importarem direto. Nao importa nada.
 *
 * A forma dos campos veio da sondagem da Task 1, medida contra payload real —
 * `docs/auditoria/evidencias/2026-09-18-fase3-pesquisa/README.md`. Nada aqui
 * foi suposto a partir de documentacao.
 */

// --- entrada ------------------------------------------------------------------

/**
 * Uma cidade do briefing.
 *
 * `serpLocationCode` existe porque SERP e Labs **nao tem a mesma
 * granularidade**: a SERP aceita cidade (`1031728` = Itu/SP), o Labs so aceita
 * pais — sao 94 localidades no mundo e uma para o Brasil. Cidade que nao existe
 * na tabela da SERP fica `null` e cai para o pais, e quem le precisa saber
 * disso em vez de descobrir com um `40501`.
 */
export type ResearchCity = {
  name: string
  stateCode: string
  serpLocationCode: number | null
  isPrimary: boolean
}

export type ResearchNeighborhood = {
  name: string
  /** Nome da cidade a que pertence, como veio do briefing. */
  city: string
}

/**
 * Entrada validada. So existe se o briefing passou nas regras da Task 3 —
 * cidades enumeradas, `primaryKeyword` presente, no maximo 50 seeds.
 */
export type ResearchInput = {
  primaryKeyword: string
  /** Ate 50. Sao **seeds**, nao o conjunto final. */
  seeds: string[]
  cities: ResearchCity[]
  /** Vazio e o caso normal: bairro e raro, e o eixo so custa quando ha dado. */
  neighborhoods: ResearchNeighborhood[]
  /** De `client_briefing_exports.content_fingerprint`. */
  briefingFingerprint: string
}

// --- metricas de keyword ------------------------------------------------------

/** Forma medida: `{"year": 2026, "month": 8, "search_volume": 20}`. */
export type MonthlyVolume = {
  year: number
  month: number
  searchVolume: number
}

export type IntentLabel =
  | "informational"
  | "navigational"
  | "commercial"
  | "transactional"

export type KeywordIntent = {
  label: IntentLabel
  probability: number
}

/**
 * De onde a candidata veio. Guardado porque alimenta o relatorio: quantas
 * keywords o cliente **nao conhecia** e um numero que a Fase 4 usa.
 *
 * Uma candidata pode ter varias origens — a lista nao e exclusiva.
 */
export type CandidateSource =
  | "briefing"
  | "keywords_for_keywords"
  | "keyword_suggestions"
  | "keyword_ideas"
  | "related_keywords"
  | "competitor_gap"

/**
 * Estado da coleta de SERP daquela candidata.
 *
 * `failed` e `done` com lista vazia sao **coisas diferentes**: a primeira e
 * coleta que nao aconteceu, a segunda e SERP legitimamente sem resultado
 * organico. Confundir as duas faz o clustering tratar a keyword como orfa e
 * inventar cluster de um item so.
 */
export type SerpStatus = "pending" | "queued" | "done" | "failed"

export type ResearchCandidate = {
  keyword: string
  sources: CandidateSource[]
  /**
   * O melhor volume disponivel; `volumeLocationCode` diz de onde ele veio.
   *
   * Vem junto da expansao — nao ha chamada separada de volume.
   */
  searchVolume: number | null
  /**
   * Em qual localidade `searchVolume` foi medido.
   *
   * Existe porque as duas fontes medem em granularidades diferentes e os
   * numeros **nao sao comparaveis**: `keywords_for_keywords` aceita cidade, e
   * `keyword_ideas` so aceita pais. Medido, `suvinil tintas` da 60.500 no
   * Brasil; o mesmo termo numa cidade do interior da uma fracao disso. Somar ou
   * ordenar os dois juntos produziria prioridade inventada.
   */
  volumeLocationCode: number | null
  /**
   * Volume nacional, quando a candidata veio (tambem) do `keyword_ideas`.
   *
   * Nao substitui o local: serve para ordenar tema, nao para estimar trafego.
   */
  nationalVolume: number | null
  /** 12 meses, no mesmo payload da expansao. E daqui que sai a sazonalidade. */
  monthlySearches: MonthlyVolume[] | null
  competition: string | null
  competitionIndex: number | null
  cpc: number | null
  /** So o `keyword_ideas` traz. `null` nas que vieram da outra fonte. */
  difficulty: number | null
  intent: KeywordIntent | null
  secondaryIntents: KeywordIntent[] | null
  /**
   * URLs do top 10 organico. `null` = SERP nao coletada; `[]` = coletada e sem
   * organico. Nenhum dos dois vira zero.
   */
  serpUrls: string[] | null
  serpStatus: SerpStatus
  /** Em qual localidade esta SERP foi consultada. `null` = pais. */
  serpLocationCode: number | null
}

// --- clusters -----------------------------------------------------------------

/**
 * Cluster tematico: componente conexo do grafo de sobreposicao de SERP.
 *
 * O **nome** do cluster nao mora aqui — ele fica em
 * `client_research_reviews.cluster_names`, porque nomear e leitura humana e
 * recoletar nao pode apaga-la. `headKeyword` e o rotulo automatico ate alguem
 * nomear.
 */
export type ResearchCluster = {
  id: string
  keywords: string[]
  /** A de maior volume do cluster. */
  headKeyword: string
  totalVolume: number
  /** URLs que sustentaram o agrupamento — a evidencia do "por que juntos". */
  sharedUrls: string[]
}

// --- concorrentes -------------------------------------------------------------

/**
 * `serp` e a fonte primaria: quem ocupa o top 10 das keywords-alvo.
 *
 * `competitors_domain` e segunda fonte e precisa de filtro. Medido na sondagem,
 * ele devolveu `instagram.com`, `cnpj.biz` e o **proprio dominio do cliente**
 * entre os dez, sem nenhuma loja do ramo — porque parte do perfil organico do
 * alvo, e alvo que rankeia so para termo de marca tem por vizinhos rede social
 * e base de CNPJ.
 */
export type CompetitorSource =
  | "serp"
  | "competitors_domain"
  | "local_pack"
  | "geo_answers"
  | "briefing"

export type ResearchCompetitor = {
  domain: string
  sources: CompetitorSource[]
  /** Em quantas keywords-alvo aparece no top 10. So para a fonte `serp`. */
  serpAppearances: number | null
  /** Do `competitors_domain`. `null` quando veio de outra fonte. */
  intersections: number | null
  avgPosition: number | null
  /**
   * Plataforma generica — rede social, diretorio, agregador de CNPJ. Marcada,
   * nao descartada: some da lista de referencia, mas continua no relatorio,
   * porque "quem ocupa a SERP da minha marca" e informacao.
   */
  isPlatform: boolean
  /** O proprio dominio do cliente ou variacao dele. */
  isSelf: boolean
}

// --- veredito -----------------------------------------------------------------

export type VerdictLabel =
  | "viavel"
  | "sem_volume"
  | "serp_incompativel"
  | "canibalizada"

/**
 * Veredito de uma keyword **do briefing**, devolvido ao profissional.
 *
 * A pesquisa nao corrige o briefing: ela devolve isto, o profissional edita se
 * concordar, e a edicao gera fingerprint novo que marca a pesquisa como
 * defasada. E assim que "enriquece, nunca altera" se fecha.
 */
export type KeywordVerdict = {
  keyword: string
  label: VerdictLabel
  /** Em portugues, pronto para leitura. Cita o numero que sustenta o veredito. */
  reason: string
  /** Substitutas do mesmo cluster, quando houver. */
  alternatives: string[]
}

// --- localidade ---------------------------------------------------------------

export type LocalityProbe = {
  cluster: string
  place: string
  kind: "city" | "neighborhood"
  /** Quantas URLs a SERP local compartilha com a SERP do tema sem lugar. */
  overlapWithBase: number
  converged: boolean
}

/**
 * `null` em `cityAxisOwn` ou `neighborhoodAxisOwn` significa **nao medido** —
 * bairro ausente no briefing nunca vira `false`.
 */
export type LocalityFindings = {
  cityAxisOwn: boolean | null
  neighborhoodAxisOwn: boolean | null
  probes: LocalityProbe[]
}

// --- snapshot -----------------------------------------------------------------

export type ClientResearchSnapshot = {
  version: 1
  collectedAt: string
  input: ResearchInput
  candidates: ResearchCandidate[]
  clusters: ResearchCluster[]
  competitors: ResearchCompetitor[]
  /** So das keywords do briefing. Candidata descoberta nao recebe veredito. */
  verdicts: KeywordVerdict[]
  locality: LocalityFindings | null
  /** Perguntas do `people_also_ask`, que vem no mesmo payload da SERP. */
  peopleAlsoAsk: string[]
  costUsd: number
}
