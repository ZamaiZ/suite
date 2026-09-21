import type {
  ClientResearchSnapshot,
  KeywordVerdict,
  ResearchCluster,
  ResearchCompetitor,
  VerdictLabel,
} from "@/lib/research/types"
import type { StepTone } from "@/components/custom/LeadStepShell"

/**
 * Presenters da etapa de Pesquisa.
 *
 * Nenhum devolve frase pronta com `·`: quando o detalhe carrega contagem, o
 * presenter devolve **as duas formas**, e quem renderiza decide o que emitir em
 * `tabular-nums`. Frase pronta só pode ser impressa inteira, em cinza.
 *
 * **Ausência é `—`.** Volume não medido não é volume zero, e uma pesquisa sem
 * coleta não tem nenhum cluster — tem nenhuma medida.
 */

/** O traço de ausência. Nunca `0`, nunca `"—"` escrito à mão em cada lugar. */
export const EMPTY_VALUE = "—"

export type ResearchCount = {
  value: number
  total: number
  noun: string
}

export function formatCount(value: number | null): string {
  return value === null ? EMPTY_VALUE : String(value)
}

/**
 * Volume com a localidade junto, porque os dois números não são comparáveis:
 * medido, `suvinil tintas` dá 60.500 no país e `tinta emborrachada` dá 170 em
 * Itu. Mostrar só o número faria o maior parecer a melhor oportunidade.
 */
export function formatVolume(
  value: number | null,
  locationCode: number | null,
): { value: string; scope: string | null } {
  if (value === null) return { value: EMPTY_VALUE, scope: "não medido" }
  const scope = locationCode === 2076 ? "no país" : "na cidade"
  return { value: value.toLocaleString("pt-BR"), scope }
}

export const VERDICT_LABEL: Record<VerdictLabel, string> = {
  viavel: "Viável",
  sem_volume: "Sem busca",
  serp_incompativel: "SERP incompatível",
  canibalizada: "Canibalizada",
}

export const VERDICT_TONE: Record<VerdictLabel, StepTone> = {
  viavel: "success",
  sem_volume: "neutral",
  serp_incompativel: "danger",
  canibalizada: "warning",
}

/**
 * Quantas palavras do briefing continuam de pé.
 *
 * É fração onde **cheio é bom** — todas as palavras que o cliente escolheu
 * seguem utilizáveis —, então a barra de progresso é a forma certa aqui.
 */
export function verdictShare(verdicts: KeywordVerdict[]): {
  share: number | null
  count: ResearchCount | null
} {
  if (verdicts.length === 0) return { share: null, count: null }
  const viaveis = verdicts.filter((v) => v.label === "viavel").length
  return {
    share: viaveis / verdicts.length,
    count: {
      value: viaveis,
      total: verdicts.length,
      noun: `de ${verdicts.length} palavras do briefing`,
    },
  }
}

/**
 * Os concorrentes que alimentam o gap: fora plataforma, fora o próprio
 * domínio. A lista completa continua acessível — "quem ocupa a SERP da minha
 * marca" é informação, às vezes a mais acionável.
 */
export function referenceCompetitors(
  competitors: ResearchCompetitor[],
  limit = 5,
): ResearchCompetitor[] {
  return competitors
    .filter((c) => !c.isPlatform && !c.isSelf)
    .slice(0, limit)
}

export function platformCompetitors(
  competitors: ResearchCompetitor[],
): ResearchCompetitor[] {
  return competitors.filter((c) => c.isPlatform || c.isSelf)
}

/** Origem legível de um concorrente, para a linha não precisar decodificar. */
export function competitorOriginLabel(competitor: ResearchCompetitor): string {
  if (competitor.isSelf) return "o próprio site"
  if (competitor.isPlatform) return "plataforma"
  if (competitor.sources.includes("serp")) return "top 10 das palavras-alvo"
  if (competitor.sources.includes("competitors_domain")) return "perfil orgânico"
  if (competitor.sources.includes("local_pack")) return "local pack"
  return "citado no briefing"
}

/**
 * Clusters com mais de uma palavra — os que de fato agrupam.
 *
 * Cluster de uma palavra só não é descoberta: é uma palavra que não encontrou
 * parentesco na SERP, e contá-lo junto inflaria o número que a Fase 4 usa para
 * dimensionar o site.
 */
export function groupedClusters(clusters: ResearchCluster[]): ResearchCluster[] {
  return clusters.filter((c) => c.keywords.length > 1)
}

export type ResearchHeadline = {
  clusters: { value: string; hint: string }
  competitors: { value: string; hint: string }
  discovered: { value: string; hint: string }
  verdicts: { value: string; hint: string; tone: StepTone }
}

/**
 * Os quatro números do cabeçalho. Cada um é a manchete de uma aba.
 *
 * Sem snapshot, todos são `—` com o motivo — e não zero. Uma pesquisa que não
 * rodou não tem zero cluster; não tem medida nenhuma.
 */
export function researchHeadline(
  snapshot: ClientResearchSnapshot | null,
): ResearchHeadline {
  if (!snapshot) {
    const vazio = { value: EMPTY_VALUE, hint: "sem pesquisa" }
    return {
      clusters: vazio,
      competitors: vazio,
      discovered: vazio,
      verdicts: { ...vazio, tone: "neutral" },
    }
  }

  const agrupados = groupedClusters(snapshot.clusters)
  const referencia = referenceCompetitors(snapshot.competitors)
  const descobertas = snapshot.candidates.filter(
    (c) => !c.sources.includes("briefing"),
  ).length
  const { share, count } = verdictShare(snapshot.verdicts)

  return {
    clusters: {
      value: String(agrupados.length),
      hint:
        agrupados.length === snapshot.clusters.length
          ? "todos com mais de uma palavra"
          : `${snapshot.clusters.length - agrupados.length} sem parentesco na SERP`,
    },
    competitors: {
      value: String(referencia.length),
      hint: "disputam o top 10 das palavras-alvo",
    },
    discovered: {
      value: String(descobertas),
      hint: "não estavam no briefing",
    },
    verdicts: {
      value: count ? `${count.value}/${count.total}` : EMPTY_VALUE,
      hint: count ? count.noun : "sem palavras julgadas",
      tone: share === null ? "neutral" : share >= 0.6 ? "success" : "warning",
    },
  }
}
