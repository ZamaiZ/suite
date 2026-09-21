/**
 * Pool de candidatas: junta as fontes de expansão num conjunto só. Puro.
 *
 * As duas fontes se sobrepõem, mas **não medem a mesma coisa**:
 * `keywords_for_keywords` aceita `location_code` de cidade e
 * `keyword_ideas` só aceita país. Medido, `suvinil tintas` dá 60.500 no Brasil
 * — número que não diz nada sobre quanta gente busca isso numa cidade do
 * interior. Por isso o merge não escolhe "o maior volume": ele escolhe o
 * **local**, e guarda o nacional à parte.
 *
 * Duas regras que vêm do desenho da fase, não da conveniência:
 *
 * 1. **Seed do briefing nunca é descartada.** Mesmo sem volume, mesmo sem
 *    aparecer em nenhuma expansão. Ela precisa chegar à Task 11 para receber
 *    veredito — e o veredito é o que volta para o profissional.
 * 2. **A origem de cada candidata é guardada.** É dela que sai o número que a
 *    Fase 4 usa: quantas palavras-chave o cliente não conhecia.
 */

import type { ExpandedKeyword } from "../dataforseo/keyword-expansion.ts"
import type { CandidateSource, ResearchCandidate } from "./types.ts"

export type CandidatePoolStats = {
  total: number
  /** Vieram do briefing, com ou sem confirmação da expansão. */
  fromBriefing: number
  /** Descobertas — não estavam no briefing. O valor da fase, em número. */
  discovered: number
  /** Têm volume medido na cidade, não só no país. */
  withLocalVolume: number
  /** Sem intenção ainda; precisam de `search_intent`. */
  needingIntent: number
  /** Seeds do briefing que nenhuma expansão confirmou. */
  unconfirmedSeeds: string[]
}

export type CandidatePool = {
  candidates: ResearchCandidate[]
  stats: CandidatePoolStats
}

/** Minúsculas, sem acento, espaços colapsados. Só para comparar. */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

/** Tem diacrítico? Desempata grafia quando o volume empata. */
function hasDiacritics(value: string): boolean {
  return /[̀-ͯ]/.test(value.normalize("NFD"))
}

type Acumulado = {
  keyword: string
  sources: Set<CandidateSource>
  local: ExpandedKeyword | null
  national: ExpandedKeyword | null
}

/**
 * Escolhe a grafia quando duas formas colidem no `fold`.
 *
 * Maior volume ganha, como manda o plano. No empate — comum, porque o Google
 * costuma reportar o mesmo número para as duas —, ganha a que tem acento, que
 * é a forma correta em português e a que vai para a tela.
 */
function melhorGrafia(
  atual: string,
  atualVolume: number | null,
  nova: string,
  novoVolume: number | null,
): string {
  const a = atualVolume ?? -1
  const b = novoVolume ?? -1
  if (b > a) return nova
  if (b < a) return atual
  if (hasDiacritics(nova) && !hasDiacritics(atual)) return nova
  return atual
}

export function buildCandidatePool(params: {
  /** As seeds do briefing, como o profissional escreveu. */
  seeds: string[]
  /** De `keywords_for_keywords` — medido na cidade. */
  local: ExpandedKeyword[]
  /** De `keyword_ideas` — medido no país. */
  national: ExpandedKeyword[]
}): CandidatePool {
  const porChave = new Map<string, Acumulado>()
  const chavesSeed = new Set<string>()

  const garantir = (keyword: string): Acumulado => {
    const chave = fold(keyword)
    const existente = porChave.get(chave)
    if (existente) return existente
    const novo: Acumulado = {
      keyword,
      sources: new Set<CandidateSource>(),
      local: null,
      national: null,
    }
    porChave.set(chave, novo)
    return novo
  }

  // 1. As seeds entram primeiro e sempre, mesmo que nenhuma expansão as
  //    confirme. Sem isso, seed sem volume sumiria antes do veredito.
  for (const seed of params.seeds) {
    const texto = typeof seed === "string" ? seed.trim() : ""
    if (!texto) continue
    chavesSeed.add(fold(texto))
    garantir(texto).sources.add("briefing")
  }

  // 2. Expansão local.
  for (const kw of params.local) {
    const acc = garantir(kw.keyword)
    acc.sources.add("keywords_for_keywords")
    // Entre duas medidas locais do mesmo termo, fica a que tem volume.
    if (!acc.local || (acc.local.searchVolume === null && kw.searchVolume !== null)) {
      acc.local = kw
    }
  }

  // 3. Expansão nacional.
  for (const kw of params.national) {
    const acc = garantir(kw.keyword)
    acc.sources.add("keyword_ideas")
    if (!acc.national || (acc.national.searchVolume === null && kw.searchVolume !== null)) {
      acc.national = kw
    }
  }

  // 4. Grafia, depois de todas as medidas estarem no lugar.
  //
  // A comparação é entre volumes da **mesma granularidade**: local com local,
  // nacional com nacional. Misturar faria o número nacional, que é ordens de
  // grandeza maior, decidir a grafia sozinho.
  for (const acc of porChave.values()) {
    const medidas = acc.local
      ? params.local.filter((k) => fold(k.keyword) === fold(acc.keyword))
      : params.national.filter((k) => fold(k.keyword) === fold(acc.keyword))

    let escolhida = acc.keyword
    let volumeEscolhido: number | null = null
    for (const medida of medidas) {
      escolhida = melhorGrafia(
        escolhida,
        volumeEscolhido,
        medida.keyword,
        medida.searchVolume,
      )
      if (escolhida === medida.keyword) volumeEscolhido = medida.searchVolume
    }
    acc.keyword = escolhida
  }

  // 5. Montagem.
  const candidates: ResearchCandidate[] = []
  const unconfirmedSeeds: string[] = []

  for (const [chave, acc] of porChave) {
    const { local, national } = acc
    const ehSeed = chavesSeed.has(chave)

    if (ehSeed && !local && !national) unconfirmedSeeds.push(acc.keyword)

    // O volume local manda. O nacional nunca o substitui — ele responde outra
    // pergunta.
    const base = local ?? national
    const volumeLocal = local?.searchVolume ?? null

    candidates.push({
      keyword: acc.keyword,
      sources: [...acc.sources],
      searchVolume: local ? volumeLocal : (national?.searchVolume ?? null),
      volumeLocationCode: local
        ? local.locationCode
        : (national?.locationCode ?? null),
      nationalVolume: national?.searchVolume ?? null,
      monthlySearches: base?.monthlySearches ?? null,
      competition: local?.competition ?? national?.competition ?? null,
      competitionIndex:
        local?.competitionIndex ?? national?.competitionIndex ?? null,
      cpc: local?.cpc ?? national?.cpc ?? null,
      // Só o `keyword_ideas` traz estes dois; aproveita sempre que existirem.
      difficulty: national?.difficulty ?? local?.difficulty ?? null,
      intent: national?.mainIntent
        ? { label: national.mainIntent as never, probability: 1 }
        : null,
      secondaryIntents: null,
      serpUrls: null,
      serpStatus: "pending",
      serpLocationCode: null,
    })
  }

  const stats: CandidatePoolStats = {
    total: candidates.length,
    fromBriefing: candidates.filter((c) => c.sources.includes("briefing")).length,
    discovered: candidates.filter((c) => !c.sources.includes("briefing")).length,
    withLocalVolume: candidates.filter(
      (c) => c.sources.includes("keywords_for_keywords") && c.searchVolume !== null,
    ).length,
    needingIntent: candidates.filter((c) => c.intent === null).length,
    unconfirmedSeeds,
  }

  return { candidates, stats }
}

/**
 * As candidatas que ainda precisam de `search_intent`, em lotes de 20 — o teto
 * medido do endpoint.
 *
 * O `keyword_ideas` já traz `main_intent`, então quem veio dele fica de fora e
 * a conta de chamadas encolhe sozinha.
 */
export function intentBatches(
  candidates: ResearchCandidate[],
  batchSize = 20,
): string[][] {
  const pendentes = candidates
    .filter((c) => c.intent === null)
    .map((c) => c.keyword)

  const lotes: string[][] = []
  for (let i = 0; i < pendentes.length; i += batchSize) {
    lotes.push(pendentes.slice(i, i + batchSize))
  }
  return lotes
}
