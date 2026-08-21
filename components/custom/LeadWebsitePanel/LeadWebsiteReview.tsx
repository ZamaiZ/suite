"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { AnimatePresence, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiCheckLine, RiLoader4Line } from "react-icons/ri"
import { LeadGbpCard } from "@/components/custom/LeadGbpPanel/LeadGbpCard"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/cn"
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
      <textarea
        id={id}
        value={value}
        maxLength={WEBSITE_REVIEW_NOTE_MAX}
        rows={2}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "w-full resize-y rounded-md border border-input-border bg-input px-3 py-2",
          "font-sans text-body-sm text-fg outline-none",
          "placeholder:text-fg-muted",
          "focus-visible:border-accent",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      />
      <p className="mt-1 text-right font-sans text-caption tabular-nums text-fg-muted">
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
              "font-sans text-caption transition-[colors,transform] duration-150 ease-out",
              "active:scale-[0.97]",
              selected
                ? option === "issue"
                  ? "border-warning/25 bg-warning/10 text-warning"
                  : option === "na"
                    ? "border-border bg-hover text-fg-secondary"
                    : "border-accent bg-accent/10 text-accent"
                : "border-transparent text-fg-muted hover:text-fg",
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

function CriterionRow({
  auditId,
  criterion,
  evidence,
  review,
  canEdit,
  onChange,
}: {
  auditId: string
  criterion: WebsiteReviewCriterion
  evidence: string
  review: WebsiteReview
  canEdit: boolean
  onChange: (next: WebsiteReview) => void
}) {
  const answer = review[criterion.id]
  const showNote = !criterion.hasVerdict || answer.verdict !== null

  function patch(partial: { verdict?: WebsiteReviewVerdict | null; note?: string }) {
    onChange({
      ...review,
      [criterion.id]: {
        ...answer,
        ...partial,
      },
    })
  }

  if (!canEdit) {
    return (
      <li className="border-t border-border-subtle py-3 first:border-t-0 first:pt-0">
        <p className="font-sans text-caption font-medium text-fg">
          {criterion.label}
        </p>
        {evidence ? (
          <p className="font-sans text-caption text-fg-muted">{evidence}</p>
        ) : null}
        <p className="mt-1 font-sans text-caption text-fg-secondary">
          {answer.verdict
            ? WEBSITE_REVIEW_VERDICT_LABEL[answer.verdict]
            : "Sem julgamento"}
        </p>
        {answer.note ? (
          <p className="mt-1 whitespace-pre-wrap font-sans text-caption text-fg-secondary">
            {answer.note}
          </p>
        ) : null}
      </li>
    )
  }

  return (
    <li className="border-t border-border-subtle py-3 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-sans text-caption font-medium text-fg">
            {criterion.label}
          </p>
          {evidence ? (
            <p className="font-sans text-caption text-fg-muted">{evidence}</p>
          ) : null}
        </div>
        {criterion.hasVerdict ? (
          <VerdictGroup
            id={`${auditId}-${criterion.id}`}
            label={criterion.label}
            value={answer.verdict}
            allowsNa={criterion.allowsNa}
            disabled={!canEdit}
            onChange={(verdict) => patch({ verdict })}
          />
        ) : null}
      </div>
      {criterion.hasVerdict ? (
        <FieldReveal show={showNote} id={`${criterion.id}-note`}>
          <NoteField
            id={`${auditId}-${criterion.id}-note`}
            value={answer.note}
            placeholder={criterion.placeholder}
            disabled={!canEdit}
            onChange={(note) => patch({ note })}
          />
        </FieldReveal>
      ) : (
        <NoteField
          id={`${auditId}-${criterion.id}-note`}
          value={answer.note}
          placeholder={criterion.placeholder}
          disabled={!canEdit}
          onChange={(note) => patch({ note })}
        />
      )}
    </li>
  )
}

export function LeadWebsiteReview({
  auditId,
  review,
  evidence,
  canEdit,
  status,
  errorMessage,
  onDraftChange,
  onRetry,
}: {
  auditId: string
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

  useEffect(() => {
    setValue(websiteReviewDraft(review))
  }, [auditId])

  function handleChange(next: WebsiteReview) {
    const draft = websiteReviewDraft(next)
    setValue(draft)
    onDraftChange(draft)
  }

  return (
    <LeadGbpCard title="Validação visual">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-sans text-caption text-fg-muted">
          Julgue pelas capturas. A coleta não fecha estes pontos.
        </p>
        <p className="shrink-0 font-sans text-caption tabular-nums text-fg-muted">
          {progress.done.toLocaleString("pt-BR")} de{" "}
          {progress.total.toLocaleString("pt-BR")}
        </p>
      </div>
      <ul className="mt-3">
        {WEBSITE_REVIEW_CATALOG.map((criterion) => (
          <CriterionRow
            key={criterion.id}
            auditId={auditId}
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
              className="inline-flex items-center gap-1 font-sans text-caption text-fg-muted"
              aria-live="polite"
            >
              <RiLoader4Line size={14} aria-hidden className="animate-spin" />
              Salvando…
            </span>
          ) : null}
          {status === "saved" ? (
            <span
              className="inline-flex items-center gap-1 font-sans text-caption text-success"
              aria-live="polite"
            >
              <RiCheckLine size={14} aria-hidden />
              Salvo agora
            </span>
          ) : null}
          {status === "error" ? (
            <>
              <span role="alert" className="font-sans text-caption text-danger">
                {errorMessage ?? "Não foi possível salvar."}
              </span>
              <Button type="button" variant="ghost" onClick={onRetry}>
                Salvar
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </LeadGbpCard>
  )
}
