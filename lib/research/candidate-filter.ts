/**
 * Filtro e teto — o que entra na SERP. Puro.
 *
 * **Este é o único ponto que governa o custo da fase.** A SERP custa US$ 0,004
 * por candidata e é ~60% do preço da pesquisa; tudo o mais é lote barato. Por
 * isso o corte acontece **antes** de coletar, nunca depois: filtrar o que já
 * foi pago não devolve dinheiro.
 *
 * Duas incomparabilidades que o filtro precisa respeitar em vez de achatar:
 *
 * 1. **Volume local e volume nacional não se ordenam juntos.** Medido,
 *    `suvinil tintas` dá 60.500 no país e `tinta emborrachada` dá 170 em Itu.
 *    Ordenar os dois na mesma lista colocaria o número nacional no topo por
 *    ser maior, não por ser melhor. Daí as faixas.
 * 2. **`null` e `0` não são a mesma coisa.** 1.514 candidatas vieram sem
 *    volume medido e 1.274 com volume zero. Zero é "ninguém busca"; nulo é
 *    "não sabemos". Tratar nulo como zero descartaria 31% do conjunto por um
 *    motivo que não é verdade.
 */

import type { ResearchCandidate } from "./types.ts"

/** Padrão do teto de SERPs. É o número que define o preço da pesquisa. */
export const DEFAULT_SERP_LIMIT = 200

export type RejectReason =
  | "volume_zero"
  | "irrelevante"
  | "termo_excluido"
  | "acima_do_teto"

export type FilterResult = {
  /** O que vai para a SERP, na ordem em que foi escolhido. */
  selected: ResearchCandidate[]
  rejected: { keyword: string; reason: RejectReason }[]
  stats: {
    total: number
    selected: number
    seedsForced: number
    withLocalVolume: number
    nationalOnly: number
    byReason: Record<RejectReason, number>
  }
}

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas", "para", "por",
  "com", "sem", "a", "o", "as", "os", "e", "ou", "um", "uma", "que", "ao", "aos",
  "the", "of", "for",
])

function fold(value: string): string {
  return String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

/** Plural simples. Sem isto, `tintas` e `tinta` não se reconhecem. */
function stem(token: string): string {
  return token.length > 3 ? token.replace(/s$/, "") : token
}

function tokens(value: string): Set<string> {
  const saida = new Set<string>()
  for (const bruto of fold(value).split(/[\s\-/]+/)) {
    const limpo = bruto.replace(/[^a-z0-9]/g, "")
    if (limpo.length < 3 || STOPWORDS.has(limpo)) continue
    saida.add(stem(limpo))
  }
  return saida
}

/**
 * Relevância é sobreposição de token com **algum** seed, não com todos.
 *
 * Medido: `suvinil tintas` compartilha `tinta` com `loja de tintas` e passa —
 * é marca do ramo, que é justamente o que a expansão nacional foi buscar.
 * `psicologia das cores`, que veio no mesmo lote com 22.200 de volume, não
 * compartilha nada com nenhum seed e cai. Sem este corte, volume alto e
 * assunto errado ocupariam as vagas mais caras da fase.
 */
function isRelevant(keyword: string, seedTokens: Set<string>[]): boolean {
  const meus = tokens(keyword)
  if (meus.size === 0) return false
  return seedTokens.some((seed) => {
    for (const token of meus) if (seed.has(token)) return true
    return false
  })
}

export function filterCandidates(params: {
  candidates: ResearchCandidate[]
  /** As seeds do briefing. Passam sempre, e fora do teto. */
  seeds: string[]
  limit?: number
  /**
   * Termos que descartam a candidata — cidade de outra praça, marca alheia.
   *
   * Assumidamente manual: não há lista de municípios aqui, e adivinhar
   * localidade por heurística erraria nos dois sentidos. Medido no dump real,
   * `loja de tintas porto alegre` aparece entre as candidatas de um cliente de
   * Itu; o chamador que sabe disso passa `porto alegre`.
   */
  excludeTerms?: string[]
}): FilterResult {
  const limit = params.limit ?? DEFAULT_SERP_LIMIT
  const seedKeys = new Set(params.seeds.map(fold).filter(Boolean))
  const seedTokens = params.seeds.map(tokens).filter((t) => t.size > 0)
  const excluir = (params.excludeTerms ?? []).map(fold).filter(Boolean)

  const rejected: { keyword: string; reason: RejectReason }[] = []
  const forcadas: ResearchCandidate[] = []
  const comLocal: ResearchCandidate[] = []
  const soNacional: ResearchCandidate[] = []

  for (const c of params.candidates) {
    const chave = fold(c.keyword)

    // 1. Seed do briefing entra sempre e fora do teto. Sem a SERP dela não há
    //    veredito, e o veredito é o que volta para o profissional.
    if (seedKeys.has(chave) || c.sources.includes("briefing")) {
      forcadas.push(c)
      continue
    }

    if (excluir.some((termo) => chave.includes(termo))) {
      rejected.push({ keyword: c.keyword, reason: "termo_excluido" })
      continue
    }

    // 2. Zero medido é "ninguém busca". Nulo não é zero e segue adiante.
    if (c.searchVolume === 0) {
      rejected.push({ keyword: c.keyword, reason: "volume_zero" })
      continue
    }

    if (seedTokens.length > 0 && !isRelevant(c.keyword, seedTokens)) {
      rejected.push({ keyword: c.keyword, reason: "irrelevante" })
      continue
    }

    // 3. As duas faixas. Volume local vale mais que nacional grande, porque
    //    responde a pergunta certa: quanta gente busca isso **aqui**.
    const temLocal =
      c.sources.includes("keywords_for_keywords") && c.searchVolume !== null
    if (temLocal) comLocal.push(c)
    else soNacional.push(c)
  }

  const porVolume = (a: ResearchCandidate, b: ResearchCandidate) =>
    (b.searchVolume ?? -1) - (a.searchVolume ?? -1)

  comLocal.sort(porVolume)
  soNacional.sort(porVolume)

  const espaco = Math.max(0, limit - forcadas.length)
  const candidatasOrdenadas = [...comLocal, ...soNacional]
  const escolhidas = candidatasOrdenadas.slice(0, espaco)

  for (const excedente of candidatasOrdenadas.slice(espaco)) {
    rejected.push({ keyword: excedente.keyword, reason: "acima_do_teto" })
  }

  const byReason: Record<RejectReason, number> = {
    volume_zero: 0,
    irrelevante: 0,
    termo_excluido: 0,
    acima_do_teto: 0,
  }
  for (const r of rejected) byReason[r.reason] += 1

  const selected = [...forcadas, ...escolhidas]

  return {
    selected,
    rejected,
    stats: {
      total: params.candidates.length,
      selected: selected.length,
      seedsForced: forcadas.length,
      withLocalVolume: escolhidas.filter((c) =>
        comLocal.includes(c),
      ).length,
      nationalOnly: escolhidas.filter((c) => soNacional.includes(c)).length,
      byReason,
    },
  }
}

/**
 * O custo da coleta que este filtro autorizou.
 *
 * Existe para a tela poder mostrar o preço **antes** de gastar. O valor
 * unitário não vive no código: vem de `GET /v3/appendix/user_data`, que é
 * gratuito e devolve a tabela da própria conta.
 */
export function serpCallCount(result: FilterResult): number {
  return result.selected.length
}
