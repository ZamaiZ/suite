"use client"

import { useEffect, useRef, useState } from "react"
import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiGroupLine } from "react-icons/ri"
import {
  upsertLeadDigitalPresence,
  type LeadDigitalPresenceAudit,
} from "@/app/actions/leads"
import { LeadGbpOpportunitiesCard } from "@/components/custom/LeadGbpPanel/LeadGbpOpportunitiesCard"
import { Button } from "@/components/ui/button"
import { todayCivilDate } from "@/lib/date-time"
import { mergeDigitalPresenceOpportunities } from "@/lib/leads/digital-presence-opportunities"
import { digitalPresenceCheckSections } from "@/lib/leads/digital-presence-presenters"
import {
  digitalPresenceReviewForChannels,
  socialChannelsFromLead,
} from "@/lib/leads/digital-presence"
import {
  digitalPresenceReviewDraft,
  emptyDigitalPresenceReview,
  serializeDigitalPresenceReviewDraft,
  type DigitalPresenceReview,
} from "@/lib/leads/digital-presence-review"
import { LeadDigitalPresenceChecks } from "./LeadDigitalPresenceChecks"
import { LeadDigitalPresenceIdentity } from "./LeadDigitalPresenceIdentity"
import { LeadDigitalPresenceNetworks } from "./LeadDigitalPresenceNetworks"
import { LeadDigitalPresenceStepHeader } from "./LeadDigitalPresenceStepHeader"
import type { LeadDigitalPresencePanelProps } from "./LeadDigitalPresencePanel.types"

const REVIEW_DEBOUNCE_MS = 800
const EASE = [0.23, 1, 0.32, 1] as const

export function LeadDigitalPresencePanel({
  detail,
  canEdit,
  onAuditChange,
  onPendingChange,
}: LeadDigitalPresencePanelProps) {
  const reduced = !!useReducedMotion()
  const fade = {
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0.12 : 0.18, ease: EASE },
  }
  const today = todayCivilDate()
  const socialChannels = socialChannelsFromLead(detail.lead.channels)
  const stored = detail.digitalPresenceAudit
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [liveReview, setLiveReview] = useState<DigitalPresenceReview>(() =>
    digitalPresenceReviewForChannels(
      stored?.review ?? emptyDigitalPresenceReview(),
      detail.lead.channels,
    ),
  )
  const reviewRef = useRef(liveReview)
  const reviewTimerRef = useRef(0)
  const auditRef = useRef<LeadDigitalPresenceAudit | null>(stored ?? null)
  const onAuditChangeRef = useRef(onAuditChange)
  // Ref de "valor mais recente": a escrita vai para um efeito, nunca no render.
  useEffect(() => {
    onAuditChangeRef.current = onAuditChange
  })

  // Reset ligado à mudança de chave: no render, não em efeito.
  const presenceKey = `${detail.lead.id}|${detail.digitalPresenceAudit?.id ?? ""}`
  const [syncedPresenceKey, setSyncedPresenceKey] = useState(presenceKey)
  if (syncedPresenceKey !== presenceKey) {
    setSyncedPresenceKey(presenceKey)
    setLiveReview(
      digitalPresenceReviewForChannels(
        detail.digitalPresenceAudit?.review ?? emptyDigitalPresenceReview(),
        detail.lead.channels,
      ),
    )
    setSaveStatus("idle")
    setSaveError(null)
  }

  useEffect(() => {
    reviewRef.current = digitalPresenceReviewForChannels(
      detail.digitalPresenceAudit?.review ?? emptyDigitalPresenceReview(),
      detail.lead.channels,
    )
    auditRef.current = detail.digitalPresenceAudit
    window.clearTimeout(reviewTimerRef.current)
  }, [detail.lead.channels, detail.digitalPresenceAudit])

  useEffect(() => {
    return () => window.clearTimeout(reviewTimerRef.current)
  }, [])

  const websiteAudit =
    detail.websiteAudits.find((item) => {
      const primary = detail.lead.channels.find(
        (channel) => channel.type === "website" && channel.is_primary,
      )
      return primary ? item.channel_id === primary.id : false
    }) ??
    detail.websiteAudits[0] ??
    null

  const signals = websiteAudit?.crawl.signals ?? null
  const review = liveReview
  const opportunities = mergeDigitalPresenceOpportunities({
    signals,
    channels: detail.lead.channels,
    review,
    today,
  })
  const checkSections = digitalPresenceCheckSections({
    signals,
    channels: detail.lead.channels,
    review,
    today,
  })

  async function persistReview(draft: DigitalPresenceReview): Promise<boolean> {
    setSaveStatus("saving")
    setSaveError(null)
    onPendingChange(true)
    const formData = new FormData()
    formData.set("lead_id", detail.lead.id)
    formData.set("review", serializeDigitalPresenceReviewDraft(draft))
    const result = await upsertLeadDigitalPresence(formData)
    onPendingChange(false)
    if (result.status === "error") {
      setSaveStatus("error")
      setSaveError(result.message)
      return false
    }
    auditRef.current = result.audit
    onAuditChangeRef.current(result.audit)
    setLiveReview(digitalPresenceReviewDraft(result.audit.review))
    reviewRef.current = digitalPresenceReviewDraft(result.audit.review)
    setSaveStatus("saved")
    return true
  }

  function handleReviewChange(next: DigitalPresenceReview) {
    const draft = digitalPresenceReviewDraft(next)
    reviewRef.current = draft
    setLiveReview(draft)
    window.clearTimeout(reviewTimerRef.current)
    if (!canEdit) return
    const baseline = digitalPresenceReviewDraft(
      auditRef.current?.review ?? emptyDigitalPresenceReview(),
    )
    if (
      serializeDigitalPresenceReviewDraft(draft) ===
      serializeDigitalPresenceReviewDraft(baseline)
    ) {
      return
    }
    reviewTimerRef.current = window.setTimeout(() => {
      const current = reviewRef.current
      if (!current) return
      void persistReview(current)
    }, REVIEW_DEBOUNCE_MS)
  }

  function handleRetry() {
    void persistReview(reviewRef.current)
  }

  return (
    <m.div
      initial={fade.initial}
      animate={fade.animate}
      transition={fade.transition}
      className="flex flex-col gap-3"
    >
      <LeadDigitalPresenceStepHeader saveStatus={saveStatus} />

      <LeadDigitalPresenceChecks sections={checkSections} />

      <LeadDigitalPresenceNetworks
        channels={socialChannels}
        review={review}
        today={today}
        canEdit={canEdit}
        onChange={handleReviewChange}
      />

      <LeadDigitalPresenceIdentity
        reviewKey={detail.digitalPresenceAudit?.id ?? detail.lead.id}
        review={review}
        canEdit={canEdit}
        onChange={handleReviewChange}
      />

      <LeadGbpOpportunitiesCard items={opportunities} />

      {saveStatus === "error" ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span role="alert" className="text-xs/relaxed text-destructive">
            {saveError ?? "Não foi possível salvar."}
          </span>
          {canEdit ? (
            <Button type="button" variant="ghost" onClick={handleRetry}>
              Salvar
            </Button>
          ) : null}
        </div>
      ) : null}

      {!websiteAudit ? (
        <p className="flex items-center gap-2 text-xs/relaxed text-muted-foreground">
          <RiGroupLine size={14} aria-hidden />A integração usa a coleta do
          Website quando disponível.
        </p>
      ) : null}
    </m.div>
  )
}
