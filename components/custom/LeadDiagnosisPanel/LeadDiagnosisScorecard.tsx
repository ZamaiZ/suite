"use client"

import {
  DIAGNOSIS_PILLAR_LABELS,
  DIAGNOSIS_PILLARS,
  type DiagnosisDocument,
  type DiagnosisPillar,
} from "@/lib/leads/diagnosis-document"
import { cn } from "cn"
import { Card } from "@/components/ui/card"

function toneForScore(score: number): string {
  if (score >= 80) return "text-success"
  if (score >= 55) return "text-warning"
  return "text-destructive"
}

export function LeadDiagnosisScorecard({
  document,
}: {
  document: DiagnosisDocument
}) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {DIAGNOSIS_PILLARS.map((pillar: DiagnosisPillar) => {
        const cell = document.facts.scorecard[pillar]
        return (
          <Card key={pillar} render={<article />} className="p-3">
            <p className="text-xs/relaxed text-muted-foreground">
              {DIAGNOSIS_PILLAR_LABELS[pillar]}
            </p>
            <p
              className={cn(
                "mt-1 font-heading text-xl font-semibold tabular-nums",
                toneForScore(cell.score),
              )}
            >
              {cell.score}
            </p>
            <p className="mt-1 text-xs/relaxed text-muted-foreground">
              {cell.highCount + cell.mediumCount === 0
                ? "Sem alertas"
                : `${cell.highCount.toLocaleString("pt-BR")} altos · ${cell.mediumCount.toLocaleString("pt-BR")} médios`}
            </p>
          </Card>
        )
      })}
    </div>
  )
}
