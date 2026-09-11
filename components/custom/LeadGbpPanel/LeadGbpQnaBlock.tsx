"use client"

import { formatDateTimeShort } from "@/lib/date-time"
import type { GbpQna } from "@/lib/leads/gbp-audit"
import { StepCard } from "@/components/custom/LeadStepShell"

export function LeadGbpQnaBlock({ qna }: { qna: GbpQna | null }) {
  if (!qna || qna.questionCount === 0) {
    return (
      <StepCard title="Perguntas">
        <p className="text-xs/relaxed text-muted-foreground">
          Nenhuma pergunta coletada.
        </p>
      </StepCard>
    )
  }

  return (
    <StepCard title="Perguntas">
      <p className="text-xs/relaxed text-foreground">
        {qna.questionCount.toLocaleString("pt-BR")} perguntas
        {qna.unansweredCount > 0
          ? ` · ${qna.unansweredCount.toLocaleString("pt-BR")} sem resposta`
          : ""}
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {qna.items.slice(0, 5).map((item, index) => (
          <li
            key={`${item.question}:${index}`}
            className="rounded-lg border border-border/70 bg-background px-3 py-2"
          >
            <p className="text-xs/relaxed font-medium text-foreground">
              {item.question}
            </p>
            {item.askedAt ? (
              <p className="text-xs/relaxed text-muted-foreground">
                {formatDateTimeShort(item.askedAt)}
              </p>
            ) : null}
            {item.answers.length > 0 ? (
              <ul className="mt-1 flex flex-col gap-0.5">
                {item.answers.slice(0, 3).map((answer, answerIndex) => (
                  <li
                    key={`${answer.text}:${answerIndex}`}
                    className="text-xs/relaxed text-muted-foreground"
                  >
                    {answer.isOwner ? "Dono: " : ""}
                    {answer.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs/relaxed text-warning">Sem resposta</p>
            )}
          </li>
        ))}
      </ul>
    </StepCard>
  )
}
