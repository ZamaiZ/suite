"use client"

import { useEffect, useRef, useState } from "react"
import {
  analyzeLeadGeo,
  collectLeadGeoMentions,
  probeLeadGeoPrompts,
  upsertLeadGeoReview,
  type LeadGeoAudit,
} from "@/app/actions/leads"
import { canonicalWebsiteUrl } from "@/lib/leads/website"
import {
  geoGapsForSnapshot,
  type GeoGapId,
  type GeoSnapshot,
} from "@/lib/leads/geo-audit"
import {
  geoOpportunitiesByTheme,
  mergeGeoOpportunities,
  type GeoOpportunityItem,
} from "@/lib/leads/geo-opportunities"
import {
  emptyGeoReview,
  geoReviewDraft,
  geoReviewProgress,
  serializeGeoReviewDraft,
  type GeoReview,
} from "@/lib/leads/geo-review"
import { deriveGeoPromptSet } from "@/lib/leads/geo-prompts"
import { GEO_PROMPT_PLATFORMS } from "@/lib/dataforseo/limits"
import type { GeoStepTabId } from "@/lib/leads/geo-step-tabs"
import type { LeadGeoPanelProps } from "./LeadGeoPanel.types"

const REVIEW_DEBOUNCE_MS = 800

export type GeoSaveStatus = "idle" | "saving" | "saved" | "error"

type Draft = { review: GeoReview; notes: string }

export type GeoController = {
  // identidade
  leadId: string
  companyName: string
  domain: string | null
  siteHref: string | null
  canEdit: boolean

  // coleta
  audit: LeadGeoAudit | null
  snapshot: GeoSnapshot | null
  busy: boolean
  error: string | null
  handleAnalyze: () => void
  /** A etapa lê o crawl do Website: sem ele, não há o que analisar. */
  hasWebsiteAudit: boolean

  // menções em IA — a coleta paga, com botão próprio
  mentionsBusy: boolean
  mentionsError: string | null
  handleCollectMentions: () => void
  /** A comparação precisa de concorrentes, e eles vêm da coleta de backlinks. */
  hasBacklinkAudit: boolean

  // sondagem em LLM — a coleta mais cara, com botão próprio
  probeBusy: boolean
  probeError: string | null
  handleProbe: () => void
  /** Quantas execuções a próxima sondagem vai disparar. */
  probeRuns: number

  // derivados
  gaps: GeoGapId[]
  opportunities: GeoOpportunityItem[]
  grouped: Record<GeoStepTabId, GeoOpportunityItem[]>
  counts: Record<GeoStepTabId, number>
  progress: { done: number; total: number }

  // julgamento do analista — um salvamento só, dois campos
  review: GeoReview
  notes: string
  saveStatus: GeoSaveStatus
  saveError: string | null
  retrySave: () => void
  handleReviewDraftChange: (next: GeoReview) => void
  handleNotesDraftChange: (next: string) => void
}

/**
 * Todo o estado da etapa de Presença em IA mora aqui.
 *
 * Duas diferenças em relação ao controller da Visibilidade, e nenhuma é
 * estética: **a coleta não custa nada** — ela reprojeta snapshots que já
 * existem, então `busy` protege contra clique duplo e não contra gasto — e ela
 * depende do crawl do Website, que é o que `hasWebsiteAudit` guarda. Sem
 * polling: não há job, a action responde na hora.
 */
export function useGeoController({
  detail,
  canEdit,
  onAuditChange,
  onReviewChange,
  onPendingChange,
}: LeadGeoPanelProps): GeoController {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mentionsBusy, setMentionsBusy] = useState(false)
  const [mentionsError, setMentionsError] = useState<string | null>(null)
  const [probeBusy, setProbeBusy] = useState(false)
  const [probeError, setProbeError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<GeoSaveStatus>("idle")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [liveReview, setLiveReview] = useState<GeoReview | null>(null)
  const [liveNotes, setLiveNotes] = useState<string | null>(null)

  const draftRef = useRef<Draft | null>(null)
  const timerRef = useRef(0)

  const audit = detail.geoAudit ?? null
  const stored = detail.geoReview
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
    setMentionsError(null)
    setProbeError(null)
  }

  // Chave, não o objeto: `detail` ganha identidade nova a cada resposta do pai,
  // e depender dele descartaria o rascunho dentro do debounce a cada render.
  useEffect(() => {
    window.clearTimeout(timerRef.current)
    draftRef.current = null
  }, [leadId])

  const review = liveReview ?? stored.review
  const notes = liveNotes ?? stored.notes ?? ""

  const primaryWebsite =
    detail.lead.channels
      .filter((channel) => channel.type === "website")
      .sort((left, right) => {
        if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1
        return left.sort_order - right.sort_order
      })[0] ?? null
  const domain = primaryWebsite?.normalized_key ?? null
  const siteHref = domain ? canonicalWebsiteUrl(domain) : null

  const hasWebsiteAudit = detail.websiteAudits.some(
    (item) => item.channel_id === primaryWebsite?.id,
  )
  // `multi_target_metrics` recusa um alvo só, e o lead sozinho é um alvo só.
  // Sem concorrente não há comparação a fazer nem chamada a pagar.
  const hasBacklinkAudit = Boolean(
    detail.backlinkAudit?.snapshot.competitors?.length,
  )

  const gaps = snapshot ? geoGapsForSnapshot({ snapshot }) : []
  const opportunities = snapshot
    ? mergeGeoOpportunities({ snapshot, review })
    : []

  const grouped = geoOpportunitiesByTheme(opportunities)
  const counts: Record<GeoStepTabId, number> = {
    acesso: grouped.acesso.length,
    conteudo: grouped.conteudo.length,
    citacoes: grouped.citacoes.length,
    sondagem: grouped.sondagem.length,
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
        review: geoReviewDraft(current.review),
        notes: current.notes ?? "",
      }
    )
  }

  async function persistDraft(draft: Draft): Promise<void> {
    const current = storedRef.current
    const unchanged =
      serializeGeoReviewDraft(draft.review) ===
        serializeGeoReviewDraft(current.review) &&
      draft.notes.trim() === (current.notes ?? "")
    if (unchanged) {
      setSaveStatus("idle")
      return
    }
    setSaveStatus("saving")
    setSaveError(null)
    const formData = new FormData()
    formData.set("lead_id", leadId)
    formData.set("review", serializeGeoReviewDraft(draft.review))
    formData.set("notes", draft.notes)
    const result = await upsertLeadGeoReview(formData)
    if (result.status === "error") {
      setSaveStatus("error")
      setSaveError(result.message)
      return
    }
    onReviewChange(result.review)
    setLiveReview(geoReviewDraft(result.review.review))
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

  function handleReviewDraftChange(next: GeoReview) {
    schedule({ ...currentDraft(), review: next })
  }

  function handleNotesDraftChange(next: string) {
    schedule({ ...currentDraft(), notes: next })
  }

  function retrySave() {
    void persistDraft(currentDraft())
  }

  /**
   * A coleta base lê snapshots que já existem e paga **uma** chamada barata: a
   * demanda de busca em IA, a US$ 0,021 — menos que o `ranked_keywords` que
   * produziu as keywords dela. `busy` protege contra clique duplo, contra duas
   * linhas append-only idênticas e, agora, contra pagar duas vezes.
   */
  function handleAnalyze() {
    if (!canEdit || busy || !domain || !hasWebsiteAudit) return
    setBusy(true)
    onPendingChange(true)
    setError(null)
    const formData = new FormData()
    formData.set("lead_id", leadId)
    void analyzeLeadGeo(formData).then((result) => {
      setBusy(false)
      onPendingChange(false)
      if (result.status === "error") {
        setError(result.message)
        return
      }
      onAuditChange(result.audit)
    })
  }

  /**
   * A coleta paga da etapa: US$ 0,10 por chamada.
   *
   * Botão próprio, no padrão da malha geográfica, justamente porque custa — a
   * coleta base precisa continuar barata, porque é ela que destrava o
   * Diagnóstico.
   */
  function handleCollectMentions() {
    if (!canEdit || mentionsBusy || !audit || !hasBacklinkAudit) return
    setMentionsBusy(true)
    onPendingChange(true)
    setMentionsError(null)
    const formData = new FormData()
    formData.set("lead_id", leadId)
    void collectLeadGeoMentions(formData).then((result) => {
      setMentionsBusy(false)
      onPendingChange(false)
      if (result.status === "error") {
        setMentionsError(result.message)
        return
      }
      onAuditChange(result.audit)
    })
  }

  /**
   * A sondagem: ≈ US$ 0,65, a coleta mais cara da etapa.
   *
   * Botão próprio e contagem de execuções visível antes do clique — quem paga
   * precisa ver o tamanho da conta, não descobrir depois.
   */
  function handleProbe() {
    if (!canEdit || probeBusy || !audit) return
    setProbeBusy(true)
    onPendingChange(true)
    setProbeError(null)
    const formData = new FormData()
    formData.set("lead_id", leadId)
    void probeLeadGeoPrompts(formData).then((result) => {
      setProbeBusy(false)
      onPendingChange(false)
      if (result.status === "error") {
        setProbeError(result.message)
        return
      }
      onAuditChange(result.audit)
      onReviewChange(result.review)
    })
  }

  // O conjunto fixado manda; sem ele, o derivado diz o tamanho da conta.
  const promptSet =
    stored.promptSet ??
    deriveGeoPromptSet({
      company: detail.lead.company_name,
      segment: detail.segment?.name ?? null,
      city: detail.lead.city,
      fixedAt: "",
    })
  const probeRuns = promptSet.items.length * GEO_PROMPT_PLATFORMS.length

  return {
    leadId,
    companyName: detail.lead.company_name,
    domain,
    siteHref,
    canEdit,

    audit,
    snapshot,
    busy,
    error,
    handleAnalyze,
    hasWebsiteAudit,

    mentionsBusy,
    mentionsError,
    handleCollectMentions,
    hasBacklinkAudit,

    probeBusy,
    probeError,
    handleProbe,
    probeRuns,

    gaps,
    opportunities,
    grouped,
    counts,
    progress: geoReviewProgress(review ?? emptyGeoReview()),

    review,
    notes,
    saveStatus,
    saveError,
    retrySave,
    handleReviewDraftChange,
    handleNotesDraftChange,
  }
}
