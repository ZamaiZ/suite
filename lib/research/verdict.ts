/**
 * Veredito por palavra-chave do briefing. Puro.
 *
 * É a única saída da pesquisa que **volta para o profissional como pedido de
 * decisão**. A pesquisa não corrige o briefing: ela devolve isto, o
 * profissional edita se concordar, a edição gera fingerprint novo, e a
 * pesquisa revalida. É assim que "enriquece, nunca altera" se fecha.
 *
 * Só as keywords do briefing recebem veredito. Candidata descoberta pela
 * expansão não precisa de um: ninguém apostou nela ainda.
 */

import { baseLabel, isPlatform } from "./competitor-sources.ts"
import type {
  KeywordVerdict,
  ResearchCandidate,
  ResearchCluster,
  VerdictLabel,
} from "./types.ts"

/**
 * Fatia do top 10 ocupada por plataforma para a SERP ser incompatível.
 *
 * Metade é deliberadamente conservador. Uma SERP com marketplace e fabricante
 * nacional em metade das posições ainda deixa espaço para loja local; acima
 * disso, a página que o cliente publicar disputa com Mercado Livre e Leroy
 * Merlin pelo mesmo resultado, e o esforço vai para o lugar errado.
 */
export const PLATFORM_SHARE_LIMIT = 0.5

function fold(value: string): string {
  return String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

export type VerdictInput = {
  seeds: string[]
  candidates: ResearchCandidate[]
  clusters: ResearchCluster[]
  /** `keyword` → domínios do top 10 orgânico, na ordem. */
  serpDomains: Record<string, string[]>
  selfDomain: string
  platformShareLimit?: number
}

export function buildVerdicts(params: VerdictInput): KeywordVerdict[] {
  const limite = params.platformShareLimit ?? PLATFORM_SHARE_LIMIT
  const selfLabel = baseLabel(params.selfDomain)
  const seedKeys = new Set(params.seeds.map(fold))

  const porKeyword = new Map<string, ResearchCandidate>()
  for (const c of params.candidates) porKeyword.set(fold(c.keyword), c)

  const clusterDe = new Map<string, ResearchCluster>()
  for (const cluster of params.clusters) {
    for (const keyword of cluster.keywords) clusterDe.set(fold(keyword), cluster)
  }

  const dominiosDe = new Map<string, string[]>()
  for (const [keyword, domains] of Object.entries(params.serpDomains)) {
    dominiosDe.set(fold(keyword), domains)
  }

  const vereditos: KeywordVerdict[] = []

  for (const seed of params.seeds) {
    const chave = fold(seed)
    const candidata = porKeyword.get(chave)
    const cluster = clusterDe.get(chave)
    const dominios = dominiosDe.get(chave) ?? null

    const { label, reason } = julgar({
      seed,
      candidata,
      cluster,
      dominios,
      selfLabel,
      seedKeys,
      limite,
    })

    vereditos.push({
      keyword: seed,
      label,
      reason,
      alternatives:
        label === "viavel" ? [] : alternativas(seed, cluster, porKeyword),
    })
  }

  return vereditos
}

function julgar(ctx: {
  seed: string
  candidata: ResearchCandidate | undefined
  cluster: ResearchCluster | undefined
  dominios: string[] | null
  selfLabel: string
  seedKeys: Set<string>
  limite: number
}): { label: VerdictLabel; reason: string } {
  const { candidata, cluster, dominios, selfLabel, limite } = ctx

  // 1. Zero medido é "ninguém busca". Volume **nulo** não cai aqui: é ausência
  //    de medida, e chamar isso de "sem volume" mandaria o profissional apagar
  //    uma palavra que talvez funcione.
  if (candidata?.searchVolume === 0) {
    return {
      label: "sem_volume",
      reason:
        "O Google reporta zero busca por mês para este termo na localidade do cliente.",
    }
  }

  // 2. SERP dominada por quem uma loja local não desbanca.
  if (dominios && dominios.length > 0) {
    const plataformas = dominios.filter((d) => isPlatform(d))
    const fatia = plataformas.length / dominios.length
    if (fatia >= limite) {
      const pct = Math.round(fatia * 100)
      return {
        label: "serp_incompativel",
        reason: `${pct}% do top ${dominios.length} é marketplace, rede social ou grande varejo (${plataformas
          .slice(0, 3)
          .join(", ")}). Uma loja local não disputa esta página.`,
      }
    }
  }

  // 3. Canibalização, em duas formas.
  if (dominios) {
    const proprias = dominios.filter((d) => baseLabel(d) === selfLabel).length
    if (proprias > 1) {
      return {
        label: "canibalizada",
        reason: `O site do cliente ocupa ${proprias} posições do top ${dominios.length} com páginas diferentes, disputando consigo mesmo.`,
      }
    }
  }

  if (cluster) {
    const outrasSeeds = cluster.keywords.filter(
      (k) => ctx.seedKeys.has(fold(k)) && fold(k) !== fold(ctx.seed),
    )
    if (outrasSeeds.length > 0) {
      return {
        label: "canibalizada",
        reason: `Compartilha a mesma SERP com ${outrasSeeds
          .map((k) => `"${k}"`)
          .join(", ")}, também do briefing. Uma página atende a todas.`,
      }
    }
  }

  // 4. Viável — com a ressalva quando o volume não foi medido, porque a
  //    diferença entre "sem busca" e "sem medida" é a razão de existir do
  //    passo 1.
  if (!candidata || candidata.searchVolume === null) {
    return {
      label: "viavel",
      reason:
        "SERP compatível com negócio local. O Google não informou volume para este termo, então a demanda não pôde ser medida.",
    }
  }

  const onde =
    candidata.volumeLocationCode && candidata.volumeLocationCode !== 2076
      ? "na cidade"
      : "no país"

  return {
    label: "viavel",
    reason: `${candidata.searchVolume} buscas por mês ${onde}, com SERP compatível com negócio local.`,
  }
}

/**
 * Substitutas do mesmo cluster, por volume.
 *
 * Do cluster e não da lista inteira: a substituta precisa resolver a **mesma
 * intenção**, senão não é substituta, é outra ideia.
 */
function alternativas(
  seed: string,
  cluster: ResearchCluster | undefined,
  porKeyword: Map<string, ResearchCandidate>,
  limite = 3,
): string[] {
  if (!cluster) return []
  return cluster.keywords
    .filter((k) => fold(k) !== fold(seed))
    .map((k) => ({ keyword: k, volume: porKeyword.get(fold(k))?.searchVolume ?? -1 }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limite)
    .map((k) => k.keyword)
}

/** Resumo para a tela, sem ela precisar contar. */
export function verdictSummary(
  verdicts: KeywordVerdict[],
): Record<VerdictLabel, number> {
  const resumo: Record<VerdictLabel, number> = {
    viavel: 0,
    sem_volume: 0,
    serp_incompativel: 0,
    canibalizada: 0,
  }
  for (const v of verdicts) resumo[v.label] += 1
  return resumo
}
