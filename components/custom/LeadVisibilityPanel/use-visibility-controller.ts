"use client"

import { useEffect, useRef, useState } from "react"
import {
  analyzeLeadVisibility,
  upsertLeadVisibilityReview,
  type LeadVisibilityAudit,
} from "@/app/actions/leads"
import { resolveLeadLocation } from "@/lib/leads/resolve-location"
import { canonicalWebsiteUrl } from "@/lib/leads/website"
import {
  type VisibilitySnapshot,
  type VisibilityGapId,
  visibilityGapsForSnapshot,
} from "@/lib/leads/visibility-audit"
import {
  mergeVisibilityOpportunities,
  visibilityOpportunitiesByTheme,
  type VisibilityOpportunityItem,
} from "@/lib/leads/visibility-opportunities"
import {
  emptyVisibilityReview,
  serializeVisibilityReviewDraft,
  visibilityReviewDraft,
  visibilityReviewProgress,
  type VisibilityReview,
} from "@/lib/leads/visibility-review"
import type { VisibilityStepTabId } from "@/lib/leads/visibility-step-tabs"
import type { LeadVisibilityPanelProps } from "./LeadVisibilityPanel.types"

const REVIEW_DEBOUNCE_MS = 800

export type VisibilitySaveStatus = "idle" | "saving" | "saved" | "error"

type Draft = { review: VisibilityReview; notes: string }

export type VisibilityController = {
  // identidade
  leadId: string
  companyName: string
  city: string | null
  domain: string | null
  siteHref: string | null
  canEdit: boolean

  // coleta
  audit: LeadVisibilityAudit | null
  snapshot: VisibilitySnapshot | null
  busy: boolean
  error: string | null
  handleAnalyze: () => void

  // derivados
  gaps: VisibilityGapId[]
  opportunities: VisibilityOpportunityItem[]
  grouped: Record<VisibilityStepTabId, VisibilityOpportunityItem[]>
  counts: Record<VisibilityStepTabId, number>
  progress: { done: number; total: number }

  // julgamento do analista — um salvamento só, dois campos
  review: VisibilityReview
  notes: string
  saveStatus: VisibilitySaveStatus
  saveError: string | null
  retrySave: () => void
  handleReviewDraftChange: (next: VisibilityReview) => void
  handleNotesDraftChange: (next: string) => void
}

/**
 * Todo o estado da etapa de Visibilidade mora aqui: a coleta paga, o
 * julgamento do analista com autosave, e as derivações que as quatro abas
 * consomem. A view virou composição.
 *
 * Duas diferenças em relação ao controller do Website, e nenhuma é estética:
 * a chave de sincronização é o **lead** (o julgamento é um por lead, não um por
 * canal), e não há polling — `ranked_keywords` é chamada `live`, responde na
 * hora, e não deixa job para trás.
 */
export function useVisibilityController({
  detail,
  canEdit,
  onAuditChange,
  onReviewChange,
  onPendingChange,
}: LeadVisibilityPanelProps): VisibilityController {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<VisibilitySaveStatus>("idle")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [liveReview, setLiveReview] = useState<VisibilityReview | null>(null)
  const [liveNotes, setLiveNotes] = useState<string | null>(null)

  const draftRef = useRef<Draft | null>(null)
  const timerRef = useRef(0)

  const audit = detail.visibilityAudit ?? null
  const stored = detail.visibilityReview
  const snapshot = audit?.snapshot ?? null

  // Ref de "valor mais recente": a escrita vai para um efeito, nunca no render.
  const storedRef = useRef(stored)
  useEffect(() => {
    storedRef.current = stored
  })

  // Reset ligado à troca de lead: no render, não em efeito. Um `useEffect` faria
  // o mesmo trabalho um render depois — e esse render pinta o julgamento do
  // lead anterior na tela antes de corrigir.
  const leadId = detail.lead.id
  const [syncedLeadId, setSyncedLeadId] = useState(leadId)
  if (syncedLeadId !== leadId) {
    setSyncedLeadId(leadId)
    setLiveReview(null)
    setLiveNotes(null)
    setSaveStatus("idle")
    setSaveError(null)
    setError(null)
  }

  // Chave, não o objeto: `detail` ganha identidade nova a cada resposta do pai,
  // e depender dele descartaria o rascunho dentro do debounce a cada render.
  useEffect(() => {
    window.clearTimeout(timerRef.current)
    draftRef.current = null
  }, [leadId])

  const review = liveReview ?? stored.review
  const notes = liveNotes ?? stored.notes ?? ""

  const primaryGbp =
    detail.gbpProfiles.find((profile) => profile.is_primary) ??
    detail.gbpProfiles[0] ??
    null
  const city = resolveLeadLocation(
    {
      city: detail.lead.city,
      state_code: detail.lead.state_code,
      segment: detail.lead.segment,
    },
    primaryGbp
      ? { formattedAddress: primaryGbp.payload.formattedAddress ?? null }
      : null,
  ).city

  const domain =
    detail.lead.channels
      .filter((channel) => channel.type === "website")
      .sort((left, right) => {
        if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1
        return left.sort_order - right.sort_order
      })[0]?.normalized_key ?? null

  const gaps = snapshot
    ? visibilityGapsForSnapshot({
        snapshot,
        companyName: detail.lead.company_name,
        city,
      })
    : []

  const opportunities = snapshot
    ? mergeVisibilityOpportunities({
        snapshot,
        companyName: detail.lead.company_name,
        city,
        review,
      })
    : []

  const grouped = visibilityOpportunitiesByTheme(opportunities)
  const counts: Record<VisibilityStepTabId, number> = {
    panorama: grouped.panorama.length,
    keywords: grouped.keywords.length,
    paginas: grouped.paginas.length,
    validacao: grouped.validacao.length,
  }

  /**
   * Fonte única do que vai para o servidor: sempre os dois campos juntos. Eles
   * moram na mesma linha e vão pela mesma action — dois debounces independentes
   * disparariam requisições concorrentes, e a última a chegar apagaria o campo
   * que a outra acabou de gravar.
   */
  function currentDraft(): Draft {
    const current = storedRef.current
    return (
      draftRef.current ?? {
        review: visibilityReviewDraft(current.review),
        notes: current.notes ?? "",
      }
    )
  }

  async function persistDraft(draft: Draft): Promise<void> {
    const current = storedRef.current
    const unchanged =
      serializeVisibilityReviewDraft(draft.review) ===
        serializeVisibilityReviewDraft(current.review) &&
      draft.notes.trim() === (current.notes ?? "")
    if (unchanged) {
      setSaveStatus("idle")
      return
    }
    setSaveStatus("saving")
    setSaveError(null)
    const formData = new FormData()
    formData.set("lead_id", leadId)
    formData.set("review", serializeVisibilityReviewDraft(draft.review))
    formData.set("notes", draft.notes)
    const result = await upsertLeadVisibilityReview(formData)
    if (result.status === "error") {
      setSaveStatus("error")
      setSaveError(result.message)
      return
    }
    onReviewChange(result.review)
    setLiveReview(visibilityReviewDraft(result.review.review))
    setLiveNotes(result.review.notes ?? "")
    setSaveStatus("saved")
  }

  function schedule(next: Draft) {
    draftRef.current = next
    window.clearTimeout(timerRef.current)
    if (!canEdit) return
    timerRef.current = window.setTimeout(() => {
      const draft = draftRef.current
      if (!draft) return
      setLiveReview(draft.review)
      setLiveNotes(draft.notes)
      void persistDraft(draft)
    }, REVIEW_DEBOUNCE_MS)
  }

  function handleReviewDraftChange(next: VisibilityReview) {
    schedule({ ...currentDraft(), review: next })
  }

  function handleNotesDraftChange(next: string) {
    schedule({ ...currentDraft(), notes: next })
  }

  function retrySave() {
    void persistDraft(currentDraft())
  }

  /**
   * Duas chamadas pagas, da ordem de US$ 0,05. `busy` trava o botão durante a
   * coleta — clique duplo aqui é dinheiro.
   */
  function handleAnalyze() {
    if (!canEdit || busy || !domain) return
    setBusy(true)
    onPendingChange(true)
    setError(null)
    const formData = new FormData()
    formData.set("lead_id", leadId)
    void analyzeLeadVisibility(formData).then((result) => {
      setBusy(false)
      onPendingChange(false)
      if (result.status === "error") {
        setError(result.message)
        return
      }
      onAuditChange(result.audit)
    })
  }

  return {
    leadId,
    companyName: detail.lead.company_name,
    city,
    domain,
    siteHref: domain ? canonicalWebsiteUrl(domain) : null,
    canEdit,
    audit,
    snapshot,
    busy,
    error,
    handleAnalyze,
    gaps,
    opportunities,
    grouped,
    counts,
    progress: visibilityReviewProgress(review),
    review: review ?? emptyVisibilityReview(),
    notes,
    saveStatus,
    saveError,
    retrySave,
    handleReviewDraftChange,
    handleNotesDraftChange,
  }
}
