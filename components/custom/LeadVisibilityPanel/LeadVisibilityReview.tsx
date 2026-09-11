"use client"

import { StepCard, StepSectionLabel } from "@/components/custom/LeadStepShell"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "cn"
import {
  isBrandKeyword,
  isLocalKeyword,
  type VisibilitySnapshot,
} from "@/lib/leads/visibility-audit"
import {
  VISIBILITY_REVIEW_CATALOG,
  VISIBILITY_REVIEW_NOTE_MAX,
  VISIBILITY_REVIEW_VERDICT_LABEL,
  type VisibilityReviewCriterion,
  type VisibilityReviewCriterionId,
  type VisibilityReviewVerdict,
} from "@/lib/leads/visibility-review"
import type { VisibilityController } from "./use-visibility-controller"

/**
 * Evidência de máquina: chip, não parágrafo cinza indistinguível do rótulo.
 * É o que o dado já sabe — o critério existe justamente para o humano dizer o
 * que o dado não alcança.
 */
function Evidence({ children }: { children: string }) {
  return (
    <span className="mt-1 inline-flex h-[22px] items-center rounded-md bg-accent px-2 text-[11px] text-accent-foreground">
      {children}
    </span>
  )
}

function evidenceFor(
  id: VisibilityReviewCriterionId,
  snapshot: VisibilitySnapshot | null,
  companyName: string,
  city: string | null,
): string | null {
  if (!snapshot) return null
  if (id === "host_intent") {
    const other = snapshot.hosts.filter((host) => !host.isCanonical)
    if (other.length === 0) return "Tudo no host principal"
    return `${other.map((host) => host.host).join(", ")} · ${other.reduce((sum, host) => sum + host.keywords, 0)} keywords`
  }
  if (id === "brand_terms") {
    const top10 = snapshot.keywords.filter(
      (row) => (row.position.value ?? 999) <= 10,
    )
    if (top10.length === 0) return "Nenhuma keyword no top 10"
    const brand = top10.filter((row) =>
      isBrandKeyword(row.keyword, companyName, snapshot.domain),
    ).length
    return `${brand} de ${top10.length} no top 10 casam com a marca`
  }
  if (id === "cannibalization") {
    const byKeyword = new Map<string, Set<string>>()
    for (const row of snapshot.keywords) {
      const url = row.url?.full ?? row.url?.path
      if (!url) continue
      const set = byKeyword.get(row.keyword) ?? new Set<string>()
      set.add(url)
      byKeyword.set(row.keyword, set)
    }
    const disputed = [...byKeyword.values()].filter(
      (set) => set.size > 1,
    ).length
    // A coleta traz uma linha por keyword, então isto quase sempre é zero — e
    // é exatamente por isso que o critério é humano.
    return disputed > 0
      ? `${disputed} keyword(s) com mais de uma URL na amostra`
      : "A coleta traz uma URL por keyword"
  }
  if (id === "local_fit") {
    const local = snapshot.keywords.filter((row) =>
      isLocalKeyword(row.keyword, city),
    ).length
    return `${local} keyword(s) reconhecidas como locais`
  }
  return null
}

function VerdictControl({
  id,
  label,
  value,
  allowsNa,
  disabled,
  onChange,
}: {
  id: string
  label: string
  value: VisibilityReviewVerdict | null
  allowsNa: boolean
  disabled: boolean
  onChange: (verdict: VisibilityReviewVerdict) => void
}) {
  const options: VisibilityReviewVerdict[] = allowsNa
    ? ["ok", "issue", "na"]
    : ["ok", "issue"]
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={label}
      className="flex flex-wrap justify-end gap-1"
    >
      {options.map((option) => {
        const selected = value === option
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cn(
              "inline-flex h-7 cursor-pointer items-center rounded-md border px-2",
              "text-xs/relaxed transition-[colors,transform] duration-150 ease-out",
              "active:scale-[0.97]",
              selected
                ? option === "issue"
                  ? "border-warning/25 bg-warning/10 text-warning"
                  : option === "na"
                    ? "border-border bg-accent text-muted-foreground"
                    : "border-primary bg-primary/10 text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            {VISIBILITY_REVIEW_VERDICT_LABEL[option]}
          </button>
        )
      })}
    </div>
  )
}

function CriterionRow({
  criterion,
  controller,
  editable,
}: {
  criterion: VisibilityReviewCriterion
  controller: VisibilityController
  editable: boolean
}) {
  const answer = controller.review[criterion.id]
  const evidence = evidenceFor(
    criterion.id,
    controller.snapshot,
    controller.companyName,
    controller.city,
  )
  // A nota só abre depois do veredito: campo em branco antes do julgamento é
  // convite a escrever o que a próxima pergunta já ia cobrir.
  const showNote = answer.verdict !== null

  function patch(next: Partial<typeof answer>) {
    controller.handleReviewDraftChange({
      ...controller.review,
      [criterion.id]: { ...answer, ...next },
    })
  }

  return (
    <li className="border-b border-border/60 py-3 last:border-b-0 last:pb-0 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs/relaxed font-medium text-foreground">
            {criterion.label}
          </p>
          <p className="text-xs/relaxed text-muted-foreground">
            {criterion.placeholder}
          </p>
          {evidence ? <Evidence>{evidence}</Evidence> : null}
        </div>
        <VerdictControl
          id={`visibility-verdict-${criterion.id}`}
          label={criterion.label}
          value={answer.verdict}
          allowsNa={criterion.allowsNa}
          disabled={!editable}
          onChange={(verdict) => patch({ verdict })}
        />
      </div>
      {showNote ? (
        <Textarea
          className="mt-2 min-h-16"
          value={answer.note}
          maxLength={VISIBILITY_REVIEW_NOTE_MAX}
          disabled={!editable}
          aria-label={`Nota de ${criterion.label}`}
          placeholder="O que você viu?"
          onChange={(event) => patch({ note: event.target.value })}
        />
      ) : null}
    </li>
  )
}

/**
 * A aba de julgamento. Os quatro critérios com veredito moram aqui; `other` não
 * — ele é nota livre e vive no bloco do analista, na coluna, onde o analista já
 * está escrevendo.
 */
export function LeadVisibilityReview({
  controller,
  readingMode,
}: {
  controller: VisibilityController
  readingMode: boolean
}) {
  const editable = controller.canEdit && !readingMode
  const criteria = VISIBILITY_REVIEW_CATALOG.filter((item) => item.hasVerdict)

  return (
    <StepCard title="Validação do analista">
      <StepSectionLabel
        aside={`${controller.progress.done} de ${controller.progress.total} julgados`}
      >
        O que a coleta não decide
      </StepSectionLabel>
      <ul className="flex flex-col">
        {criteria.map((criterion) => (
          <CriterionRow
            key={criterion.id}
            criterion={criterion}
            controller={controller}
            editable={editable}
          />
        ))}
      </ul>
    </StepCard>
  )
}
