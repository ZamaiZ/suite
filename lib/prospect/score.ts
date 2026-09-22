/**
 * A temperatura do prospect — puro, calculado na leitura.
 *
 * **Não é etapa de fila.** Como etapa, seria uma linha que não compra nada e
 * um número que envelhece no instante em que a etapa seguinte assenta. É
 * função sobre o que as outras etapas gravaram, e roda toda vez que a lista é
 * lida.
 *
 * Dois eixos, deliberadamente separados:
 *
 *   ADERÊNCIA   esse negócio é cliente para nós?
 *   ALCANCE     temos como falar com quem decide?
 *
 * Somá-los num número só esconderia a diferença entre "ótimo cliente que não
 * sei como abordar" e "fácil de falar e não serve" — que pedem ações opostas
 * do SDR.
 */

import type { ProspectContact, ProspectIdentity, ProspectListing } from "./types.ts"

export type ScoreInput = {
  listing: Pick<
    ProspectListing,
    "isClaimed" | "rating" | "votesCount" | "domain" | "phoneE164"
  >
  identity: ProspectIdentity | null
  contacts: ProspectContact[]
  /** Confiança do CNPJ, 0 a 100. Zero quando não há CNPJ. */
  taxIdConfidence: number
}

export type ScoreReason = { points: number; label: string }

export type ProspectScore = {
  /** 0 a 100. */
  fit: number
  /** 0 a 100. */
  reach: number
  fitReasons: ScoreReason[]
  reachReasons: ScoreReason[]
  /** Rótulo para a tela. */
  temperature: "quente" | "morno" | "frio"
}

/* -------------------------------------------------------------------------- */
/*  Aderência                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * O que faz um negócio local ser cliente de uma agência de SEO e perfil no
 * Google: ele está mal servido hoje, e tem com que pagar.
 *
 * Os pesos vêm do que a sondagem de 2026-09-21 mostrou ser raro o suficiente
 * para discriminar. Perfil não reivindicado aparece em 32% a 52% da amostra —
 * é comum, mas é o problema que a agência resolve em uma reunião, então vale
 * muito. Nota abaixo de 4 aparece em 3% a 10%: é raro, e é dor aguda.
 */
export function scoreFit(input: ScoreInput): {
  fit: number
  reasons: ScoreReason[]
} {
  const reasons: ScoreReason[] = []
  let fit = 0
  const add = (points: number, label: string) => {
    fit += points
    reasons.push({ points, label })
  }

  const { listing, identity } = input

  if (listing.isClaimed === false) add(30, "perfil do Google não reivindicado")
  if (!listing.domain) add(25, "não tem site")
  if (typeof listing.rating === "number" && listing.rating < 4) {
    add(20, `nota ${listing.rating.toFixed(1)}`)
  }
  if (!listing.votesCount) add(10, "sem nenhuma avaliação")
  else if (listing.votesCount < 20) add(10, "poucas avaliações")

  // Capital social é a pergunta "tem com que pagar?". As faixas são grosseiras
  // de propósito: capital social declarado não é caixa, e fingir precisão aqui
  // levaria o SDR a descartar cliente bom.
  const capital = identity?.shareCapital ?? null
  if (capital !== null) {
    if (capital >= 100_000) add(15, "capital social acima de R$ 100 mil")
    else if (capital >= 20_000) add(10, "capital social acima de R$ 20 mil")
    else if (capital > 0) add(3, "capital social pequeno")
  }

  // Empresa jovem demais raramente tem verba; velha demais sem site é inércia,
  // não oportunidade. Nenhum dos dois é bloqueio, só peso.
  if (identity?.openedAt) {
    const anos =
      (Date.now() - Date.parse(identity.openedAt)) / (365.25 * 86_400_000)
    if (Number.isFinite(anos) && anos >= 2) add(5, "mais de dois anos de casa")
  }

  if (identity?.mei) add(-15, "MEI — verba costuma ser curta")

  return { fit: Math.max(0, Math.min(100, fit)), reasons }
}

/* -------------------------------------------------------------------------- */
/*  Alcance                                                                   */
/* -------------------------------------------------------------------------- */

/** Quanto vale cada canal para chegar em quem decide. */
const REACH_WEIGHT: Record<ProspectContact["kind"], number> = {
  // Onde o negócio local já atende cliente. É o canal mais quente que existe.
  whatsapp: 35,
  phone: 20,
  email: 15,
  instagram: 12,
  linkedin: 18,
  facebook: 5,
}

export function scoreReach(input: ScoreInput): {
  reach: number
  reasons: ScoreReason[]
} {
  const reasons: ScoreReason[] = []
  let reach = 0
  const add = (points: number, label: string) => {
    reach += points
    reasons.push({ points, label })
  }

  // Um por tipo, e o de maior confiança: cinco telefones não valem cinco
  // vezes um telefone.
  const melhorPorTipo = new Map<ProspectContact["kind"], ProspectContact>()
  for (const c of input.contacts) {
    const atual = melhorPorTipo.get(c.kind)
    if (!atual || c.confidence > atual.confidence) melhorPorTipo.set(c.kind, c)
  }

  for (const [kind, contato] of melhorPorTipo) {
    // A confiança do contato escala o peso: telefone solto no texto de uma
    // página vale menos que um `tel:` declarado.
    const pontos = Math.round((REACH_WEIGHT[kind] * contato.confidence) / 100)
    if (pontos > 0) add(pontos, `${kind} (${contato.confidence}%)`)
  }

  // Saber QUEM decide é metade do alcance. Sem o QSA, o SDR liga e pede para
  // falar com o responsável.
  const socios = input.identity?.partners.filter((p) => !p.isCompany) ?? []
  if (socios.length === 1) add(15, `sócio identificado: ${socios[0].name}`)
  else if (socios.length > 1) add(10, `${socios.length} sócios identificados`)

  // CNPJ incerto não ajuda a abordar ninguém, e o QSA que veio dele pode ser
  // de outra empresa.
  if (input.taxIdConfidence > 0 && input.taxIdConfidence < 60) {
    add(-10, "CNPJ ainda não confirmado")
  }

  return { reach: Math.max(0, Math.min(100, reach)), reasons }
}

/* -------------------------------------------------------------------------- */

export function scoreProspect(input: ScoreInput): ProspectScore {
  const { fit, reasons: fitReasons } = scoreFit(input)
  const { reach, reasons: reachReasons } = scoreReach(input)

  // Quente exige os dois. Aderência alta sem alcance é uma boa empresa que
  // ninguém consegue abordar — trabalho de pesquisa, não de ligação.
  const temperature =
    fit >= 50 && reach >= 40 ? "quente" : fit >= 35 || reach >= 50 ? "morno" : "frio"

  return { fit, reach, fitReasons, reachReasons, temperature }
}

export const TEMPERATURE_LABEL: Record<ProspectScore["temperature"], string> = {
  quente: "Quente",
  morno: "Morno",
  frio: "Frio",
}
