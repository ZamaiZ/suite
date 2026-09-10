"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  analyzeLeadWebsite,
  pollLeadWebsiteJobs,
  updateLeadWebsiteAudit,
  type LeadBacklinkAudit,
  type LeadWebsiteAudit,
} from "@/app/actions/leads"
import {
  digitalChannelDisplay,
  hrefForDigitalChannel,
  type LeadDigitalChannel,
} from "@/lib/leads/digital-channels"
import { backlinkOpportunitiesFromSnapshot } from "@/lib/leads/backlinks-opportunities"
import {
  napCheckForCrawl,
  websiteGapsForAudit,
  type WebsiteGapId,
} from "@/lib/leads/website-audit"
import {
  mergeWebsiteOpportunities,
  missingSecurityHeaderLabels,
  napMismatchLabels,
  type WebsiteOpportunityItem,
} from "@/lib/leads/website-opportunities"
import {
  websiteMinPerformance,
  websitePsiJobsActive,
  type WebsitePsiJob,
} from "@/lib/leads/website-pagespeed"
import {
  websiteCheckSections,
  websiteCheckTally,
  websiteReviewEvidence,
  type WebsiteCheckSection,
  type WebsiteCheckTally,
} from "@/lib/leads/website-presenters"
import {
  emptyWebsiteReview,
  serializeWebsiteReviewDraft,
  websiteReviewDraft,
  type WebsiteReview,
  type WebsiteReviewCriterionId,
} from "@/lib/leads/website-review"
import type { LeadWebsitePanelProps } from "./LeadWebsitePanel.types"

const REVIEW_DEBOUNCE_MS = 800
const POLL_MS = 8000
const POLL_MAX_MS = 300_000

export type WebsiteSaveStatus = "idle" | "saving" | "saved" | "error"

type Draft = { review: WebsiteReview; notes: string }

export type WebsiteController = {
  // seleção
  channels: LeadDigitalChannel[]
  channelItems: Array<{ value: string; label: string }>
  selected: LeadDigitalChannel | null
  selectedId: string | null
  setSelectedId: (id: string) => void
  siteHref: string | null

  // coleta
  audit: LeadWebsiteAudit | null
  backlinkAudit: LeadBacklinkAudit | null
  leadId: string
  canEdit: boolean
  busy: boolean
  jobsActive: boolean
  pollTimedOut: boolean
  jobsKey: string
  failedJobs: WebsitePsiJob[]
  psiFailedWithoutReady: boolean
  error: string | null
  handleAnalyze: () => void
  onBacklinkAuditChange: (audit: LeadBacklinkAudit) => void
  onPendingChange: (pending: boolean) => void

  // derivados
  gaps: WebsiteGapId[]
  sections: WebsiteCheckSection[]
  tally: WebsiteCheckTally
  reviewEvidence: Record<WebsiteReviewCriterionId, string> | null
  review: WebsiteReview
  opportunities: WebsiteOpportunityItem[]

  // persistência do analista — um salvamento só, dois campos
  saveStatus: WebsiteSaveStatus
  saveError: string | null
  retrySave: () => void
  notes: string
  handleReviewDraftChange: (next: WebsiteReview) => void
  handleNotesDraftChange: (next: string) => void
}

function websiteChannels(channels: LeadDigitalChannel[]): LeadDigitalChannel[] {
  return channels
    .filter((channel) => channel.type === "website" && channel.id)
    .sort((left, right) => {
      if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1
      return left.sort_order - right.sort_order
    })
}

function websiteJobsKey(audit: LeadWebsiteAudit | null): string {
  if (!audit) return ""
  return audit.jobs
    .filter((job) => job.status === "queued" || job.status === "running")
    .map((job) => job.kind)
    .sort()
    .join(",")
}

/**
 * Todo o estado da etapa Website mora aqui: seleção de canal, polling do
 * PageSpeed, persistência do bloco do analista e as sete derivações que as abas
 * consomem. A view virou composição — e as abas leem recortes sobrepostos do
 * mesmo estado, que é o que torna uma prop só melhor que doze.
 */
export function useWebsiteController({
  detail,
  canEdit,
  onAuditChange,
  onBacklinkAuditChange,
  onPendingChange,
}: LeadWebsitePanelProps): WebsiteController {
  const channels = websiteChannels(detail.lead.channels)
  const [selectedId, setSelectedId] = useState<string | null>(
    channels[0]?.id ?? null,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pollTimedOut, setPollTimedOut] = useState(false)
  const [saveStatus, setSaveStatus] = useState<WebsiteSaveStatus>("idle")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [liveReview, setLiveReview] = useState<WebsiteReview | null>(null)
  const [liveNotes, setLiveNotes] = useState<string | null>(null)

  const draftRef = useRef<Draft | null>(null)
  const timerRef = useRef(0)
  const auditRef = useRef<LeadWebsiteAudit | null>(null)
  const onAuditChangeRef = useRef(onAuditChange)
  // Ref de "valor mais recente": a escrita vai para um efeito, nunca no render.
  useEffect(() => {
    onAuditChangeRef.current = onAuditChange
  })

  const channelKey = channels.map((channel) => channel.id).join(",")

  // Reset ligado à mudança de chave: no render, não em efeito.
  const channelsKey = `${detail.lead.id}|${channelKey}`
  const [syncedChannelsKey, setSyncedChannelsKey] = useState(channelsKey)
  if (syncedChannelsKey !== channelsKey) {
    setSyncedChannelsKey(channelsKey)
    setSelectedId((current) => {
      if (current && channels.some((channel) => channel.id === current)) {
        return current
      }
      return channels[0]?.id ?? null
    })
  }

  const selected =
    channels.find((channel) => channel.id === selectedId) ?? channels[0] ?? null
  const audit =
    detail.websiteAudits.find((item) => item.channel_id === selected?.id) ?? null
  useEffect(() => {
    auditRef.current = audit
  })
  const jobsKey = websiteJobsKey(audit)

  // Resets ligados à troca de auditoria: no render, não em efeito.
  const auditId = audit?.id ?? null
  const [syncedAuditId, setSyncedAuditId] = useState(auditId)
  if (syncedAuditId !== auditId) {
    setSyncedAuditId(auditId)
    setLiveReview(audit ? websiteReviewDraft(audit.review) : null)
    setLiveNotes(audit?.notes ?? "")
    setSaveStatus("idle")
    setSaveError(null)
  }

  const pollKey = `${auditId ?? ""}|${jobsKey}`
  const [syncedPollKey, setSyncedPollKey] = useState(pollKey)
  if (syncedPollKey !== pollKey) {
    setSyncedPollKey(pollKey)
    setPollTimedOut(false)
  }

  // Chave, não o objeto: `audit` ganha identidade nova a cada resposta do poll,
  // e depender dele descartaria o rascunho em debounce a cada tick.
  useEffect(() => {
    window.clearTimeout(timerRef.current)
    draftRef.current = null
  }, [auditId])

  useEffect(() => {
    if (!canEdit || !auditId || !jobsKey) return
    // Mesmo motivo: com o objeto na lista de dependências, o intervalo se
    // reiniciava a cada resposta e o poll nunca completava um ciclo.
    const pollingAuditId = auditId
    let cancelled = false
    const startedAt = Date.now()

    async function tick() {
      if (cancelled) return
      if (Date.now() - startedAt >= POLL_MAX_MS) {
        setPollTimedOut(true)
        return
      }
      const formData = new FormData()
      formData.set("audit_id", pollingAuditId)
      const result = await pollLeadWebsiteJobs(formData)
      if (cancelled) return
      if (result.status === "error") {
        setError(result.message)
        return
      }
      onAuditChangeRef.current(result.audit)
    }

    void tick()
    const timer = window.setInterval(() => {
      void tick()
    }, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [canEdit, auditId, jobsKey])

  const primaryGbp =
    detail.gbpProfiles.find((profile) => profile.is_primary) ??
    detail.gbpProfiles[0] ??
    null
  const serviceTitles =
    primaryGbp?.enrichment?.services?.map((item) => item.title) ?? []
  const nap = primaryGbp
    ? {
        phone: primaryGbp.payload.nationalPhoneNumber,
        address: primaryGbp.payload.formattedAddress,
      }
    : null
  const gaps = audit
    ? websiteGapsForAudit(
        audit.crawl,
        detail.lead.company_name,
        nap,
        audit.pagespeed,
        serviceTitles,
      )
    : []
  const review = liveReview ?? audit?.review ?? emptyWebsiteReview()
  const notes = liveNotes ?? audit?.notes ?? ""

  // Backlinks entra na mesma lista: é o pilar de Website, e a contagem tem que
  // bater com o badge da trilha, que soma os dois do mesmo jeito.
  const opportunities = [
    ...(audit
      ? mergeWebsiteOpportunities(
          gaps,
          {
            minPerformance: websiteMinPerformance(audit.pagespeed),
            missingSecurityHeaders: missingSecurityHeaderLabels(audit.crawl),
            napMismatches: napMismatchLabels(napCheckForCrawl(audit.crawl, nap)),
          },
          review,
        )
      : []),
    ...backlinkOpportunitiesFromSnapshot(detail.backlinkAudit?.snapshot ?? null),
  ].sort((left, right) => {
    if (left.impact !== right.impact) return left.impact === "high" ? -1 : 1
    return 0
  })

  const sections = audit
    ? websiteCheckSections(
        audit.crawl,
        gaps,
        audit.pagespeed,
        audit.jobs,
        detail.lead.company_name,
        review,
      )
    : []
  const tally = websiteCheckTally(sections)
  const reviewEvidence = audit
    ? websiteReviewEvidence(audit.crawl, audit.pagespeed, gaps, nap)
    : null
  const siteHref = selected
    ? hrefForDigitalChannel(selected.type, selected.value)
    : null
  const jobsActive = audit ? websitePsiJobsActive(audit.jobs) : false
  const failedJobs = audit
    ? audit.jobs.filter((job) => job.status === "failed")
    : []
  const psiFailedWithoutReady =
    failedJobs.length > 0 && !audit?.jobs.some((job) => job.status === "ready")

  /**
   * Fonte única do que vai para o servidor: sempre os dois campos juntos. Eles
   * moram na mesma linha e vão pela mesma action — dois debounces independentes
   * disparariam requisições concorrentes, e a última a chegar apagaria o campo
   * que a outra acabou de gravar.
   */
  function currentDraft(): Draft {
    const current = auditRef.current
    return (
      draftRef.current ?? {
        review: current
          ? websiteReviewDraft(current.review)
          : emptyWebsiteReview(),
        notes: current?.notes ?? "",
      }
    )
  }

  async function persistDraft(draft: Draft): Promise<boolean> {
    const current = auditRef.current
    if (!current) return true
    const unchanged =
      serializeWebsiteReviewDraft(draft.review) ===
        serializeWebsiteReviewDraft(current.review) &&
      draft.notes.trim() === (current.notes ?? "")
    if (unchanged) {
      setSaveStatus("idle")
      return true
    }
    setSaveStatus("saving")
    setSaveError(null)
    const formData = new FormData()
    formData.set("audit_id", current.id)
    formData.set("review", serializeWebsiteReviewDraft(draft.review))
    formData.set("notes", draft.notes)
    const result = await updateLeadWebsiteAudit(formData)
    if (result.status === "error") {
      setSaveStatus("error")
      setSaveError(result.message)
      return false
    }
    onAuditChange(result.audit)
    setLiveReview(websiteReviewDraft(result.audit.review))
    setLiveNotes(result.audit.notes ?? "")
    setSaveStatus("saved")
    return true
  }

  function schedule(next: Draft) {
    draftRef.current = next
    window.clearTimeout(timerRef.current)
    if (!canEdit || !auditRef.current) return
    timerRef.current = window.setTimeout(() => {
      const draft = draftRef.current
      if (!draft) return
      setLiveReview(draft.review)
      setLiveNotes(draft.notes)
      void persistDraft(draft)
    }, REVIEW_DEBOUNCE_MS)
  }

  function handleReviewDraftChange(next: WebsiteReview) {
    schedule({ ...currentDraft(), review: next })
  }

  function handleNotesDraftChange(next: string) {
    schedule({ ...currentDraft(), notes: next })
  }

  function retrySave() {
    void persistDraft(currentDraft())
  }

  function handleAnalyze() {
    if (!selected?.id || busy || jobsActive) return
    setBusy(true)
    onPendingChange(true)
    setError(null)
    const formData = new FormData()
    formData.set("channel_id", selected.id)
    void analyzeLeadWebsite(formData).then((result) => {
      setBusy(false)
      onPendingChange(false)
      if (result.status === "error") {
        setError(result.message)
        return
      }
      onAuditChange(result.audit)
    })
  }

  const channelItems = useMemo(
    () =>
      channels.map((channel) => ({
        value: channel.id ?? channel.normalized_key,
        label: digitalChannelDisplay(channel.type, channel.value),
      })),
    [channels],
  )

  return {
    channels,
    channelItems,
    selected,
    selectedId: selected?.id ?? null,
    setSelectedId,
    siteHref,
    audit,
    backlinkAudit: detail.backlinkAudit ?? null,
    leadId: detail.lead.id,
    canEdit,
    busy,
    jobsActive,
    pollTimedOut,
    jobsKey,
    failedJobs,
    psiFailedWithoutReady,
    error,
    handleAnalyze,
    onBacklinkAuditChange,
    onPendingChange,
    gaps,
    sections,
    tally,
    reviewEvidence,
    review,
    opportunities,
    saveStatus,
    saveError,
    retrySave,
    notes,
    handleReviewDraftChange,
    handleNotesDraftChange,
  }
}
