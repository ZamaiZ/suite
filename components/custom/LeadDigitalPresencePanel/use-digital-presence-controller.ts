"use client"

import { useEffect, useRef, useState } from "react"
import {
  upsertLeadDigitalPresence,
  type LeadDigitalPresenceAudit,
} from "@/app/actions/leads"
import { todayCivilDate } from "@/lib/date-time"
import { digitalPresenceReviewForChannels } from "@/lib/leads/digital-presence"
import {
  digitalPresenceOpportunitiesByTheme,
  mergeDigitalPresenceOpportunities,
} from "@/lib/leads/digital-presence-opportunities"
import {
  digitalPresenceNetworkStates,
  digitalPresenceSiteLinks,
  digitalPresenceTally,
} from "@/lib/leads/digital-presence-presenters"
import {
  digitalPresenceReviewDraft,
  emptyDigitalPresenceReview,
  serializeDigitalPresenceReviewDraft,
  type DigitalPresenceReview,
} from "@/lib/leads/digital-presence-review"
import type { DigitalPresenceStepTabId } from "@/lib/leads/digital-presence-step-tabs"
import type { LeadDigitalPresencePanelProps } from "./LeadDigitalPresencePanel.types"

const REVIEW_DEBOUNCE_MS = 800

export type DigitalPresenceSaveStatus = "idle" | "saving" | "saved" | "error"

export type DigitalPresenceController = ReturnType<
  typeof useDigitalPresenceController
>

/**
 * Tudo que não é layout. Mesmo papel de `use-website-controller` e
 * `use-gbp-profile-controller`: o painel volta a ser composição.
 */
export function useDigitalPresenceController({
  detail,
  canEdit,
  onAuditChange,
  onPendingChange,
}: LeadDigitalPresencePanelProps) {
  const today = todayCivilDate()
  const stored = detail.digitalPresenceAudit
  const [saveStatus, setSaveStatus] =
    useState<DigitalPresenceSaveStatus>("idle")
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

  // A etapa lê o crawl do site principal; sem ele, metade da leitura é
  // desconhecida — e desconhecida nunca é desenhada como zero.
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
  const derivedInput = {
    signals,
    channels: detail.lead.channels,
    review,
    today,
  }

  const opportunities = mergeDigitalPresenceOpportunities(derivedInput)
  const grouped = digitalPresenceOpportunitiesByTheme(opportunities)
  const counts: Record<DigitalPresenceStepTabId, number> = {
    redes: grouped.redes.length,
    site: grouped.site.length,
  }

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

  return {
    leadId: detail.lead.id,
    companyName: detail.lead.company_name,
    today,
    canEdit,
    review,
    saveStatus,
    saveError,
    signals,
    hasCollect: signals !== null,
    collectedAt: websiteAudit?.fetched_at ?? null,
    updatedAt: detail.digitalPresenceAudit?.updated_at ?? null,
    /** Chave de re-sincronização dos campos com rascunho local. */
    syncKey: detail.digitalPresenceAudit?.id ?? detail.lead.id,
    // Sem `channels` cru: quem consome quer o estado por rede, e devolver as
    // duas formas convida a tela a recalcular o que o presenter já resolveu.
    networkStates: digitalPresenceNetworkStates(derivedInput),
    siteLinks: digitalPresenceSiteLinks(derivedInput),
    tally: digitalPresenceTally(derivedInput),
    opportunities,
    grouped,
    counts,
    handleReviewChange,
    handleNotesDraftChange: (notes: string) =>
      handleReviewChange({ ...review, notes }),
    retrySave: () => {
      void persistReview(reviewRef.current)
    },
  }
}
