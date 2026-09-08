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
}

function pillarLine(pillar: DiagnosisPillar, facts: DiagnosisFacts): string {
  const score = facts.scorecard[pillar]
  const label = DIAGNOSIS_PILLAR_LABELS[pillar]
  const top = facts.pillars[pillar].opportunities[0]
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

  const executiveSummary = [
    `Diagnóstico digital de ${meta.companyName}${place} (${meta.domain}).`,
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

  const pillarNarratives = Object.fromEntries(
    DIAGNOSIS_PILLARS.map((pillar) => [pillar, pillarLine(pillar, facts)]),
  ) as Record<DiagnosisPillar, string>

  return {
    executiveSummary,
    commercialHook,
    pillarNarratives,
  }
}
