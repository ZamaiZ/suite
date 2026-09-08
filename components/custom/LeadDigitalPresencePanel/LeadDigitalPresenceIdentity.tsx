"use client"

import type { ReactNode } from "react"
import { AnimatePresence, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { LeadGbpCard } from "@/components/custom/LeadGbpPanel/LeadGbpCard"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/cn"
import {
  DIGITAL_PRESENCE_IDENTITY,
  DIGITAL_PRESENCE_IDENTITY_VERDICT_LABEL,
  DIGITAL_PRESENCE_REVIEW_NOTE_MAX,
  type DigitalPresenceIdentityVerdict,
  type DigitalPresenceReview,
} from "@/lib/leads/digital-presence-review"

const EASE = [0.23, 1, 0.32, 1] as const

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

function VerdictGroup({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string
  value: DigitalPresenceIdentityVerdict | null
  disabled: boolean
  onChange: (verdict: DigitalPresenceIdentityVerdict) => void
}) {
  const options: DigitalPresenceIdentityVerdict[] = ["ok", "issue"]
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={DIGITAL_PRESENCE_IDENTITY.label}
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
                  : "border-accent bg-accent/10 text-accent"
                : "border-transparent text-fg-muted hover:text-fg",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            {DIGITAL_PRESENCE_IDENTITY_VERDICT_LABEL[option]}
          </button>
        )
      })}
    </div>
  )
}

export function LeadDigitalPresenceIdentity({
  reviewKey,
  review,
  canEdit,
  onChange,
}: {
  reviewKey: string
  review: DigitalPresenceReview
  canEdit: boolean
  onChange: (next: DigitalPresenceReview) => void
}) {
  const answer = review.identity
  const showNote = answer.verdict !== null

  function patch(partial: {
    verdict?: DigitalPresenceIdentityVerdict | null
    note?: string
  }) {
    onChange({
      ...review,
      identity: {
        ...answer,
        ...partial,
      },
    })
  }

  if (!canEdit) {
    return (
      <LeadGbpCard title={DIGITAL_PRESENCE_IDENTITY.label}>
        <p className="font-sans text-caption text-fg-secondary">
          {answer.verdict
            ? DIGITAL_PRESENCE_IDENTITY_VERDICT_LABEL[answer.verdict]
            : "Sem julgamento"}
        </p>
        {answer.note ? (
          <p className="mt-1 whitespace-pre-wrap font-sans text-caption text-fg-secondary">
            {answer.note}
          </p>
        ) : null}
      </LeadGbpCard>
    )
  }

  return (
    <LeadGbpCard title={DIGITAL_PRESENCE_IDENTITY.label}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-sans text-caption text-fg-muted">
          Consistência da marca entre as redes — não o layout do site.
        </p>
        <VerdictGroup
          id={`${reviewKey}-identity`}
          value={answer.verdict}
          disabled={!canEdit}
          onChange={(verdict) => patch({ verdict })}
        />
      </div>
      <FieldReveal show={showNote} id="identity-note">
        <div className="pt-2">
          <label htmlFor={`${reviewKey}-identity-note`} className="sr-only">
            {DIGITAL_PRESENCE_IDENTITY.placeholder}
          </label>
          <Textarea
            id={`${reviewKey}-identity-note`}
            value={answer.note}
            maxLength={DIGITAL_PRESENCE_REVIEW_NOTE_MAX}
            rows={2}
            disabled={!canEdit}
            placeholder={DIGITAL_PRESENCE_IDENTITY.placeholder}
            onChange={(event) => patch({ note: event.target.value })}
            className="min-h-0 resize-y"
          />
          <p className="mt-1 text-right font-sans text-caption tabular-nums text-fg-muted">
            {answer.note.length}/{DIGITAL_PRESENCE_REVIEW_NOTE_MAX}
          </p>
        </div>
      </FieldReveal>
    </LeadGbpCard>
  )
}
