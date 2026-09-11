"use client"

import type { ReactNode } from "react"
import { AnimatePresence, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiCodeSSlashLine, RiFacebookCircleLine } from "react-icons/ri"
import {
  StepCard,
  StepSectionLabel,
  StepStat,
} from "@/components/custom/LeadStepShell"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "cn"
import { CHANNEL_ICONS } from "@/lib/leads/digital-channel-icons"
import type { DigitalPresenceTone } from "@/lib/leads/digital-presence"
import {
  DIGITAL_PRESENCE_ALIGNMENT_LABEL,
  DIGITAL_PRESENCE_ALIGNMENT_TONE,
  type DigitalPresenceSiteLink,
} from "@/lib/leads/digital-presence-presenters"
import {
  DIGITAL_PRESENCE_IDENTITY,
  DIGITAL_PRESENCE_IDENTITY_VERDICT_LABEL,
  DIGITAL_PRESENCE_REVIEW_NOTE_MAX,
  type DigitalPresenceIdentityVerdict,
  type DigitalPresenceReview,
} from "@/lib/leads/digital-presence-review"
import type { WebsiteCrawlSignals } from "@/lib/leads/website-audit"

const EASE = [0.23, 1, 0.32, 1] as const

const CHIP: Record<DigitalPresenceTone, string> = {
  neutral: "bg-accent text-muted-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
}

export function LeadDigitalPresenceTracking({
  signals,
}: {
  signals: WebsiteCrawlSignals
}) {
  const hasTag = signals.hasGtm || signals.hasGtag
  return (
    <StepCard title="Rastreamento">
      {/*
        A ressalva viaja no `aside` da sobrancelha, presa ao rótulo que ela
        qualifica — solta abaixo da seção, vira mais uma linha cinza.
      */}
      <StepSectionLabel aside="pode estar só dentro do GTM">
        No HTML da home
      </StepSectionLabel>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StepStat
          icon={RiCodeSSlashLine}
          label="GOOGLE TAG / GTM"
          value={hasTag ? "Presente" : "Ausente"}
          unit={
            hasTag
              ? signals.hasGtm
                ? "container do GTM"
                : "gtag direto"
              : "não encontrado no HTML"
          }
          tone={hasTag ? "success" : "warning"}
        />
        <StepStat
          icon={RiFacebookCircleLine}
          label="PIXEL DO FACEBOOK"
          value={signals.hasFacebookPixel ? "Presente" : "Ausente"}
          unit={
            signals.hasFacebookPixel
              ? "fbevents.js encontrado"
              : "não aparece no HTML"
          }
          tone={signals.hasFacebookPixel ? "success" : "warning"}
        />
      </div>
    </StepCard>
  )
}

export function LeadDigitalPresenceSiteLinksCard({
  links,
}: {
  links: DigitalPresenceSiteLink[]
}) {
  return (
    <StepCard title="Redes encontradas no site">
      {links.length === 0 ? (
        <p className="text-xs/relaxed text-muted-foreground">
          Nenhuma rede no cadastro nem no HTML.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {links.map((link) => {
            const Icon = CHANNEL_ICONS[link.type]
            const tone = DIGITAL_PRESENCE_ALIGNMENT_TONE[link.alignment]
            return (
              <li
                key={link.type}
                className="flex items-center gap-2.5 rounded-lg bg-card px-2.5 py-2 ring-1 ring-foreground/[0.08]"
              >
                <span
                  aria-hidden
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-muted-foreground"
                >
                  <Icon size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs/[1.5] text-foreground">{link.label}</p>
                  {link.href ? (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {link.href}
                    </p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                    CHIP[tone],
                  )}
                >
                  {DIGITAL_PRESENCE_ALIGNMENT_LABEL[link.alignment]}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </StepCard>
  )
}

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

const VERDICTS: DigitalPresenceIdentityVerdict[] = ["ok", "issue"]

export function LeadDigitalPresenceBrand({
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

  function patch(partial: {
    verdict?: DigitalPresenceIdentityVerdict | null
    note?: string
  }) {
    onChange({ ...review, identity: { ...answer, ...partial } })
  }

  if (!canEdit) {
    return (
      <StepCard title={DIGITAL_PRESENCE_IDENTITY.label}>
        <p className="text-xs/relaxed text-muted-foreground">
          {answer.verdict
            ? DIGITAL_PRESENCE_IDENTITY_VERDICT_LABEL[answer.verdict]
            : "Sem julgamento"}
        </p>
        {answer.note ? (
          <p className="mt-1 whitespace-pre-wrap text-xs/relaxed text-muted-foreground">
            {answer.note}
          </p>
        ) : null}
      </StepCard>
    )
  }

  return (
    <StepCard title={DIGITAL_PRESENCE_IDENTITY.label}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs/relaxed text-muted-foreground">
          Consistência da marca entre as redes — não o layout do site.
        </p>
        {/*
          `ToggleGroup` no lugar do radiogroup escrito à mão: um primitive por
          papel, e escolher entre opções mutuamente exclusivas é o dele. Seleção
          única é o padrão do grupo — `multiple` é o opt-in.
        */}
        <ToggleGroup
          value={answer.verdict ? [answer.verdict] : []}
          onValueChange={(value) => {
            const next = value[0]
            patch({
              verdict: next === "ok" || next === "issue" ? next : null,
            })
          }}
          variant="outline"
          size="sm"
          aria-label={DIGITAL_PRESENCE_IDENTITY.label}
          className="shrink-0"
        >
          {VERDICTS.map((option) => (
            <ToggleGroupItem key={option} value={option}>
              {DIGITAL_PRESENCE_IDENTITY_VERDICT_LABEL[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <FieldReveal show={answer.verdict !== null} id="brand-note">
        <div className="pt-2">
          <label htmlFor={`${reviewKey}-brand-note`} className="sr-only">
            {DIGITAL_PRESENCE_IDENTITY.placeholder}
          </label>
          <Textarea
            id={`${reviewKey}-brand-note`}
            value={answer.note}
            maxLength={DIGITAL_PRESENCE_REVIEW_NOTE_MAX}
            rows={2}
            placeholder={DIGITAL_PRESENCE_IDENTITY.placeholder}
            onChange={(event) => patch({ note: event.target.value })}
            className="min-h-0 resize-y"
          />
          <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
            {answer.note.length}/{DIGITAL_PRESENCE_REVIEW_NOTE_MAX}
          </p>
        </div>
      </FieldReveal>
    </StepCard>
  )
}
