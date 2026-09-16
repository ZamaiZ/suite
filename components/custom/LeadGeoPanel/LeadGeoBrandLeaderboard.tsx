"use client"

import { StepCard, StepSectionLabel } from "@/components/custom/LeadStepShell"
import { LeadVisibilityRankedList } from "@/components/custom/LeadVisibilityPanel/LeadVisibilityRankedList"
import type { GeoPromptVisibility } from "@/lib/leads/geo-audit"
import { fold } from "@/lib/leads/geo-answer-list"
import { brandVariants } from "@/lib/leads/geo-prompts"
import { pct } from "./geo-format"

/**
 * Quem mais apareceu nas respostas da sondagem.
 *
 * Linha ranqueada, e não lista cinza: a pergunta aqui é "quem domina", e a
 * barra é o que faz o maior saltar antes da leitura. Normaliza pelo líder — a
 * base é o topo, não o total, porque é isso que dá resolução às linhas de
 * baixo.
 *
 * **A marca do lead é a ênfase, o resto é contexto.** Ela sai em `primary` e as
 * outras em `neutral`: sem isso, o analista procura o nome dele numa lista de
 * catorze em vez de encontrá-lo.
 */
export function LeadGeoBrandLeaderboard({
  probe,
  companyName,
}: {
  probe: GeoPromptVisibility
  companyName: string
}) {
  const variantes = brandVariants(companyName).map(fold)
  const isLead = (name: string) => {
    const dobrado = fold(name)
    return variantes.some(
      (variante) => dobrado === variante || dobrado.includes(variante),
    )
  }

  return (
    <StepCard title="Marcas citadas junto">
      <StepSectionLabel aside="barra relativa à mais citada">
        Marcas detectadas
      </StepSectionLabel>
      <LeadVisibilityRankedList
        rows={probe.metrics.competitors.slice(0, 14).map((row) => ({
          id: row.name,
          label: isLead(row.name) ? (
            <span className="font-medium text-primary">
              {row.name} · este lead
            </span>
          ) : (
            row.name
          ),
          title: row.name,
          value: row.mentionRate,
          note:
            row.averagePosition === null
              ? undefined
              : `ordem ${row.averagePosition.toFixed(1)}`,
          tone: isLead(row.name) ? "primary" : "neutral",
        }))}
        formatValue={pct}
        emptyLabel="Nenhuma marca conhecida foi detectada nas respostas."
      />
      {/* A lista de casamento é o nome do lead mais os concorrentes da malha
          do Google. Quem está fora dela não foi detectado — e silêncio sobre
          o que ficou de fora não é afirmação de que não há nada lá. */}
      <p className="mt-3 text-xs/relaxed text-muted-foreground">
        {probe.metrics.dominance === null
          ? "Nenhum concorrente estava na lista de marcas conhecidas, então a participação da marca não foi medida — só o que aparece acima foi detectado."
          : `${pct(probe.metrics.dominance)} das menções detectadas são da marca do lead. Quem está fora da lista de marcas conhecidas não foi medido.`}
      </p>
    </StepCard>
  )
}
