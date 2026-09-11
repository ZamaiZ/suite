import {
  DIAGNOSIS_PILLAR_LABELS,
  DIAGNOSIS_PILLARS,
  type DiagnosisFacts,
  type DiagnosisMeta,
  type DiagnosisPillar,
  type DiagnosisProse,
} from "./diagnosis-document.ts"

export type SeedDiagnosisProseInput = {
  meta: DiagnosisMeta
  facts: DiagnosisFacts
  /**
   * Prosa pronta do pilar de Presença em IA, composta do snapshot.
   *
   * Vem de fora porque `DiagnosisFacts` guarda oportunidades e indicadores, não
   * o snapshot — e o parágrafo daquele pilar precisa distinguir três coletas de
   * naturezas diferentes. Vazia, cai na linha genérica como os outros pilares.
   */
  geoNarrative?: string
}

function pillarLine(pillar: DiagnosisPillar, facts: DiagnosisFacts): string {
  const score = facts.scorecard[pillar]
  const label = DIAGNOSIS_PILLAR_LABELS[pillar]
  const top = facts.pillars[pillar].opportunities[0]
  // Sem coleta não há o que narrar, e "está em boa forma" seria elogio a uma
  // dimensão que ninguém mediu.
  if (!score.measured) {
    return `${label} ainda não foi coletada nesta auditoria.`
  }
  if (score.highCount + score.mediumCount === 0) {
    return `${label} está em boa forma nesta coleta (nota ${score.score}).`
  }
  if (top) {
    return `${label} (nota ${score.score}): prioridade em “${top.title}”.`
  }
  return `${label} apresenta ${score.highCount + score.mediumCount} pontos de atenção (nota ${score.score}).`
}

export function seedDiagnosisProse(
  input: SeedDiagnosisProseInput,
): DiagnosisProse {
  const { meta, facts } = input
  const place = meta.city ? ` em ${meta.city}` : ""
  const findings = facts.findings.slice(0, 3)
  const findingText =
    findings.length > 0
      ? findings.map((item) => item.title).join("; ")
      : "oportunidades pontuais em presença digital e busca"

  const weakest = DIAGNOSIS_PILLARS.slice().sort(
    (left, right) => facts.scorecard[left].score - facts.scorecard[right].score,
  )[0]

  // O resumo abre pelo que já funciona, quando há. O documento de referência faz
  // isso, e é o que separa diagnóstico de lista de defeitos. Sem ponto forte a
  // frase some, em vez de virar texto vazio dizendo que não há nada de bom.
  const strengths = facts.strengths ?? []
  const strengthText =
    strengths.length > 0
      ? `Do lado positivo: ${strengths
          .slice(0, 2)
          .map((item) => item.title.toLowerCase())
          .join(" e ")}.`
      : ""

  const executiveSummary = [
    `Diagnóstico digital de ${meta.companyName}${place} (${meta.domain}).`,
    strengthText,
    `Os principais temas observados são: ${findingText}.`,
    weakest
      ? `O pilar com maior espaço de ganho imediato é ${DIAGNOSIS_PILLAR_LABELS[weakest]}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ")

  const topRoadmap = facts.roadmap.slice(0, 3).map((item) => item.title)
  const commercialHook =
    topRoadmap.length > 0
      ? `Foco sugerido para o ciclo comercial: ${topRoadmap.join("; ")}.`
      : `Presença digital de ${meta.companyName} está estável nesta coleta — o próximo passo é aprofundar conteúdo e autoridade local.`

  const geoProse = input.geoNarrative?.trim() ?? ""
  const pillarNarratives = Object.fromEntries(
    DIAGNOSIS_PILLARS.map((pillar) => [
      pillar,
      pillar === "geo" && geoProse ? geoProse : pillarLine(pillar, facts),
    ]),
  ) as Record<DiagnosisPillar, string>

  return {
    executiveSummary,
    commercialHook,
    pillarNarratives,
  }
}
