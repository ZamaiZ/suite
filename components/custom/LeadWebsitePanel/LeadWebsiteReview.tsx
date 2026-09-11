"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import { AnimatePresence, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiCheckLine } from "react-icons/ri"
import {
  StepCard,
  StepMeter,
} from "@/components/custom/LeadStepShell"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "cn"
import {
  WEBSITE_REVIEW_CATALOG,
  WEBSITE_REVIEW_NOTE_MAX,
  WEBSITE_REVIEW_VERDICT_LABEL,
  websiteReviewDraft,
  websiteReviewProgress,
  type WebsiteReview,
  type WebsiteReviewCriterion,
  type WebsiteReviewCriterionId,
  type WebsiteReviewVerdict,
} from "@/lib/leads/website-review"

const EASE = [0.23, 1, 0.32, 1] as const

export type WebsiteReviewStatus = "idle" | "saving" | "saved" | "error"

/**
 * O critério `other` não aparece aqui: ele virou "Achado visual" no bloco do
 * analista, ao lado das notas da etapa. Editá-lo em dois lugares seria dois
 * campos para um valor só.
 */
const CRITERIA = WEBSITE_REVIEW_CATALOG.filter((item) => item.hasVerdict)

function FieldReveal({
  show,
  id,
  children,
}: {
  show: boolean
  id: string
  children: ReactNode
}) {
  const reduced = !!useReducedMotion()
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <m.div
          key={id}
          initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, height: "auto" }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: 0.12 } }
              : {
                  opacity: 0,
                  height: 0,
                  transition: { duration: 0.14, ease: EASE },
                }
          }
          transition={{ duration: reduced ? 0.12 : 0.18, ease: EASE }}
          style={reduced ? undefined : { overflow: "hidden" }}
        >
          {children}
        </m.div>
      ) : null}
    </AnimatePresence>
  )
}

function NoteField({
  id,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  id: string
  value: string
  placeholder: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="pt-2">
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <Textarea
        id={id}
        value={value}
        maxLength={WEBSITE_REVIEW_NOTE_MAX}
        rows={2}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-0 resize-y"
      />
      <p className="mt-1 text-right text-xs/relaxed tabular-nums text-muted-foreground">
        {value.length}/{WEBSITE_REVIEW_NOTE_MAX}
      </p>
    </div>
  )
}

function VerdictGroup({
  id,
  label,
  value,
  allowsNa,
  disabled,
  onChange,
}: {
  id: string
  label: string
  value: WebsiteReviewVerdict | null
  allowsNa: boolean
  disabled: boolean
  onChange: (verdict: WebsiteReviewVerdict) => void
}) {
  const options: WebsiteReviewVerdict[] = allowsNa
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
            {WEBSITE_REVIEW_VERDICT_LABEL[option]}
          </button>
        )
      })}
    </div>
  )
}

/** Evidência de máquina: chip, não parágrafo cinza indistinguível do rótulo. */
function Evidence({ children }: { children: string }) {
  return (
    <span className="mt-1 inline-flex h-[22px] items-center rounded-md bg-accent px-2 text-[11px] text-accent-foreground">
      {children}
    </span>
  )
}

function CriterionRow({
  syncKey,
  criterion,
  evidence,
  review,
  canEdit,
  onChange,
}: {
  syncKey: string
  criterion: WebsiteReviewCriterion
  evidence: string
  review: WebsiteReview
  canEdit: boolean
  onChange: (next: WebsiteReview) => void
}) {
  const answer = review[criterion.id]
  const showNote = answer.verdict !== null

  function patch(partial: {
    verdict?: WebsiteReviewVerdict | null
    note?: string
  }) {
    onChange({
      ...review,
      [criterion.id]: { ...answer, ...partial },
    })
  }

  if (!canEdit) {
    return (
      <li className="border-t border-border/70 py-3 first:border-t-0 first:pt-0">
        <p className="text-xs/relaxed font-medium text-foreground">
          {criterion.label}
        </p>
        {evidence ? <Evidence>{evidence}</Evidence> : null}
        <p className="mt-1 text-xs/relaxed text-muted-foreground">
          {answer.verdict
            ? WEBSITE_REVIEW_VERDICT_LABEL[answer.verdict]
            : "Sem julgamento"}
        </p>
        {answer.note ? (
          <p className="mt-1 whitespace-pre-wrap text-xs/relaxed text-muted-foreground">
            {answer.note}
          </p>
        ) : null}
      </li>
    )
  }

  return (
    <li className="border-t border-border/70 py-3 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <p className="text-xs/relaxed font-medium text-foreground">
            {criterion.label}
          </p>
          {evidence ? <Evidence>{evidence}</Evidence> : null}
        </div>
        <VerdictGroup
          id={`${syncKey}-${criterion.id}`}
          label={criterion.label}
          value={answer.verdict}
          allowsNa={criterion.allowsNa}
          disabled={!canEdit}
          onChange={(verdict) => patch({ verdict })}
        />
      </div>
      <FieldReveal show={showNote} id={`${criterion.id}-note`}>
        <NoteField
          id={`${syncKey}-${criterion.id}-note`}
          value={answer.note}
          placeholder={criterion.placeholder}
          disabled={!canEdit}
          onChange={(note) => patch({ note })}
        />
      </FieldReveal>
    </li>
  )
}

export function LeadWebsiteReview({
  syncKey,
  review,
  evidence,
  canEdit,
  status,
  errorMessage,
  onDraftChange,
  onRetry,
}: {
  /** Canal em edição: é o que re-sincroniza o rascunho local. */
  syncKey: string
  review: WebsiteReview
  evidence: Record<WebsiteReviewCriterionId, string>
  canEdit: boolean
  status: WebsiteReviewStatus
  errorMessage: string | null
  onDraftChange: (review: WebsiteReview) => void
  onRetry: () => void
}) {
  const [value, setValue] = useState(() => websiteReviewDraft(review))
  const progress = websiteReviewProgress(value)

  // Ajuste de estado quando a prop muda: no render, não em efeito.
  const [syncedFrom, setSyncedFrom] = useState(syncKey)
  if (syncedFrom !== syncKey) {
    setSyncedFrom(syncKey)
    setValue(websiteReviewDraft(review))
  }

  function handleChange(next: WebsiteReview) {
    const draft = websiteReviewDraft(next)
    setValue(draft)
    onDraftChange(draft)
  }

  return (
    <StepCard title="Validação visual">
      <div className="-mt-1 mb-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs/relaxed text-muted-foreground">
            Julgue pelas capturas ao lado. A coleta não fecha estes pontos.
          </p>
          <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {progress.done.toLocaleString("pt-BR")} de{" "}
            {progress.total.toLocaleString("pt-BR")}
          </p>
        </div>
        <StepMeter
          share={progress.done / progress.total}
          tone="primary"
          className="mt-1"
          trackClassName="h-1"
        />
      </div>
      <ul>
        {CRITERIA.map((criterion) => (
          <CriterionRow
            key={criterion.id}
            syncKey={syncKey}
            criterion={criterion}
            evidence={evidence[criterion.id]}
            review={value}
            canEdit={canEdit}
            onChange={(next) => handleChange(next)}
          />
        ))}
      </ul>
      {canEdit ? (
        <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
          {status === "saving" ? (
            <span
              className="inline-flex items-center gap-1 text-xs/relaxed text-muted-foreground"
              aria-live="polite"
            >
              <Spinner aria-hidden className="size-3.5" />
              Salvando…
            </span>
          ) : null}
          {status === "saved" ? (
            <span
              className="inline-flex items-center gap-1 text-xs/relaxed text-success"
              aria-live="polite"
            >
              <RiCheckLine size={14} aria-hidden />
              Salvo agora
            </span>
          ) : null}
          {status === "error" ? (
            <>
              <span role="alert" className="text-xs/relaxed text-destructive">
                {errorMessage ?? "Não foi possível salvar."}
              </span>
              <Button type="button" variant="ghost" onClick={onRetry}>
                Salvar
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </StepCard>
  )
}
