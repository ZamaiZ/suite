/**
 * Localidade: o eixo é próprio ou herdado? Puro.
 *
 * A fase clusteriza o **tema** uma vez, sem lugar, e trata localidade como
 * dimensão ortogonal. Isso só se sustenta se houver prova — e a prova é barata:
 * comparar a SERP do tema com a SERP do tema mais o lugar.
 *
 * - **SERPs convergem** → o lugar não muda a disputa, e uma página serve.
 * - **SERPs divergem** → o lugar tem SERP própria, e pede página própria.
 *
 * A mesma sonda serve para cidade e para bairro, com uma diferença de política:
 * cidade quase sempre existe e vale medir; **bairro só entra se o briefing o
 * enumerar**, e aí por amostra de 3 a 5 por cidade. A matriz completa de
 * bairros passa de mil combos num cliente com poucas cidades — a sonda
 * descobre a mesma coisa por uma fração do custo.
 */

import { overlapBetween } from "./cluster.ts"
import type { LocalityFindings, LocalityProbe } from "./types.ts"

/**
 * URLs em comum para considerar que o lugar **não** tem SERP própria.
 *
 * Mais alto que o limiar de cluster de propósito: aqui a pergunta não é "são
 * parecidas o bastante para uma página?", é "são a mesma disputa?". Errar para
 * o lado de declarar eixo próprio custa páginas a mais; errar para o outro lado
 * faz o cliente não existir na busca com cidade, que é a busca que converte.
 */
export const LOCALITY_CONVERGENCE_MIN = 5

/** Quantos bairros sondar por cidade antes de decidir se o eixo é próprio. */
export const NEIGHBORHOOD_SAMPLE_SIZE = 5

export type LocalityProbeInput = {
  /** Cluster ou tema sondado, pelo rótulo. */
  cluster: string
  place: string
  kind: "city" | "neighborhood"
  /** URLs da SERP do tema sem lugar. */
  baseUrls: string[]
  /** URLs da SERP do tema com o lugar. `null` = sonda não coletada. */
  placeUrls: string[] | null
}

export function probeLocality(
  input: LocalityProbeInput,
  convergenceMin = LOCALITY_CONVERGENCE_MIN,
): LocalityProbe | null {
  // Sonda não coletada não vira "divergiu": ausência de medida não é medida.
  if (input.placeUrls === null) return null

  const overlapWithBase = overlapBetween(input.baseUrls, input.placeUrls)
  return {
    cluster: input.cluster,
    place: input.place,
    kind: input.kind,
    overlapWithBase,
    converged: overlapWithBase >= convergenceMin,
  }
}

/**
 * Consolida as sondas num veredito por eixo.
 *
 * `null` é **não medido** e nunca `false`. Bairro ausente do briefing não vira
 * "bairro não tem eixo próprio" — vira "ninguém perguntou".
 */
export function summarizeLocality(
  probes: LocalityProbe[],
): LocalityFindings {
  const decidir = (kind: "city" | "neighborhood"): boolean | null => {
    const doTipo = probes.filter((p) => p.kind === kind)
    if (doTipo.length === 0) return null
    // Eixo é próprio quando a maioria das sondas divergiu. Uma sonda isolada
    // que convergiu não desfaz o padrão, e vice-versa.
    const divergiram = doTipo.filter((p) => !p.converged).length
    return divergiram > doTipo.length / 2
  }

  return {
    cityAxisOwn: decidir("city"),
    neighborhoodAxisOwn: decidir("neighborhood"),
    probes,
  }
}

/**
 * Quais combos sondar, dado o que o briefing enumerou.
 *
 * Cidade: todas, contra os clusters âncora. Bairro: só se houver, e por
 * amostra. É aqui que o custo do pilar H deixa de ser proporcional ao tamanho
 * da matriz e passa a ser proporcional à resposta.
 */
export function planLocalityProbes(params: {
  /** Rótulos dos clusters a sondar — normalmente 1 ou 2 âncoras. */
  clusters: string[]
  cities: string[]
  neighborhoods?: { name: string; city: string }[]
  sampleSize?: number
}): { cluster: string; place: string; kind: "city" | "neighborhood" }[] {
  const amostra = params.sampleSize ?? NEIGHBORHOOD_SAMPLE_SIZE
  const plano: { cluster: string; place: string; kind: "city" | "neighborhood" }[] =
    []

  for (const cluster of params.clusters) {
    for (const city of params.cities) {
      plano.push({ cluster, place: city, kind: "city" })
    }
  }

  const bairros = params.neighborhoods ?? []
  if (bairros.length > 0) {
    // Amostra por cidade, não no total: uma cidade com trinta bairros não pode
    // consumir a cota de outra que tem três.
    const porCidade = new Map<string, string[]>()
    for (const bairro of bairros) {
      const lista = porCidade.get(bairro.city)
      if (lista) lista.push(bairro.name)
      else porCidade.set(bairro.city, [bairro.name])
    }

    for (const cluster of params.clusters) {
      for (const nomes of porCidade.values()) {
        for (const nome of nomes.slice(0, amostra)) {
          plano.push({ cluster, place: nome, kind: "neighborhood" })
        }
      }
    }
  }

  return plano
}

/**
 * A matriz tema × local que a Fase 4 recebe.
 *
 * Só é gerada quando o eixo se provou próprio. Se a cidade não muda a SERP,
 * multiplicar tema por cidade produziria páginas que competem entre si pelo
 * mesmo resultado — canibalização desenhada de propósito.
 */
export function localityMatrix(params: {
  clusters: string[]
  cities: string[]
  findings: LocalityFindings
}): { cluster: string; city: string }[] {
  if (params.findings.cityAxisOwn !== true) return []
  const matriz: { cluster: string; city: string }[] = []
  for (const cluster of params.clusters) {
    for (const city of params.cities) matriz.push({ cluster, city })
  }
  return matriz
}
