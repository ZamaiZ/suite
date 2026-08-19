"use client"

import { formatDateTimeShort } from "@/lib/date-time"
import type { GbpQna } from "@/lib/leads/gbp-audit"
import { LeadGbpCard } from "./LeadGbpCard"

export function LeadGbpQnaBlock({ qna }: { qna: GbpQna | null }) {
  if (!qna || qna.questionCount === 0) {
    return (
      <LeadGbpCard title="Perguntas">
        <p className="font-sans text-caption text-fg-muted">
          Nenhuma pergunta coletada.
        </p>
      </LeadGbpCard>
    )
  }

  return (
    <LeadGbpCard title="Perguntas">
      <p className="font-sans text-caption text-fg">
        {qna.questionCount.toLocaleString("pt-BR")} perguntas
        {qna.unansweredCount > 0
          ? ` · ${qna.unansweredCount.toLocaleString("pt-BR")} sem resposta`
          : ""}
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {qna.items.slice(0, 5).map((item, index) => (
          <li
            key={`${item.question}:${index}`}
            className="rounded-lg border border-border-subtle bg-canvas px-3 py-2"
          >
            <p className="font-sans text-caption font-medium text-fg">
              {item.question}
            </p>
            {item.askedAt ? (
              <p className="font-sans text-caption text-fg-muted">
                {formatDateTimeShort(item.askedAt)}
              </p>
            ) : null}
            {item.answers.length > 0 ? (
              <ul className="mt-1 flex flex-col gap-0.5">
                {item.answers.slice(0, 3).map((answer, answerIndex) => (
                  <li
                    key={`${answer.text}:${answerIndex}`}
                    className="font-sans text-caption text-fg-secondary"
                  >
                    {answer.isOwner ? "Dono: " : ""}
                    {answer.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 font-sans text-caption text-warning">
                Sem resposta
              </p>
            )}
          </li>
        ))}
      </ul>
    </LeadGbpCard>
  )
}
