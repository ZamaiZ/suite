"use client"

import { useEffect, useRef, useState } from "react"
import {
  checkLeadGbpRanking,
  enrichLeadGbpProfile,
  pollLeadGbpJobs,
  refreshLeadGbpProfile,
  removeLeadGbpProfile,
  updateLeadGbpAnalystReview,
  updateLeadGbpProfile,
  updateLeadGbpRankKeywords,
} from "@/app/actions/leads"
import { todayCivilDate } from "@/lib/date-time"
import { gbpJobQueued } from "@/lib/leads/gbp-audit"
import { gbpGapsForProfile, type LeadGbpProfile } from "@/lib/leads/gbp"
import type { GbpGapId } from "@/lib/leads/gbp"
import type { GbpReplyTimeBand } from "@/lib/leads/gbp-analyst-review"
import {
  mergeGbpOpportunities,
  type GbpOpportunityItem,
} from "@/lib/leads/gbp-opportunities"
import { latestGbpCollectedAt } from "@/lib/leads/gbp-presenters"
import {
  gbpReputation,
  type GbpReputation,
} from "@/lib/leads/gbp-reputation"
import type { LeadLocation } from "@/lib/leads/resolve-location"
import type { GbpNotesStatus } from "./LeadGbpNotesCard"

const POLL_MS = 5000
const POLL_MAX_MS = 120_000
const NOTES_DEBOUNCE_MS = 800

function queuedKindsKey(profile: LeadGbpProfile): string {
  return profile.jobs
    .filter((job) => job.status === "queued")
    .map((job) => job.kind)
    .sort()
    .join(",")
}

/**
 * Tudo o que a etapa guarda e tudo o que ela faz, num objeto só. As abas e a
 * coluna precisam de recortes sobrepostos do mesmo estado; assinaturas de doze
 * props é onde argumentos de mesmo tipo trocam de lugar sem ninguém notar.
 */
export type GbpProfileController = {
  profile: LeadGbpProfile
  profiles: LeadGbpProfile[]
  companyName: string
  canEdit: boolean
  gaps: GbpGapId[]
  /** `null` quando não havia amostra para medir. */
  reputation: GbpReputation | null
  opportunities: GbpOpportunityItem[]
  mapsUri: string | null
  updatedAt: string | null
  collecting: boolean
  collectingPosts: boolean
  collectingReviews: boolean
  pollTimedOut: boolean
  queuedKey: string
  failedJobs: LeadGbpProfile["jobs"]
  busy: boolean
  error: string | null
  notesStatus: GbpNotesStatus
  savingReplyTime: boolean
  onSelectProfile: (profileId: string) => void
  handleRefresh: () => void
  handleEnrich: () => void
  handlePrimary: () => void
  handleRemove: () => void
  handleSaveRankKeywords: (keywords: string[]) => Promise<void>
  handleCheckRanking: () => Promise<void>
  handleReplyTimeChange: (band: GbpReplyTimeBand | null) => void
  handleDraftChange: (next: string) => void
  handleReputationDraftChange: (next: string) => void
  persistNotes: () => Promise<boolean>
  onUpdated: (profile: LeadGbpProfile) => void
  onPendingChange: (pending: boolean) => void
}

export function useGbpProfileController({
  profile,
  profiles,
  companyName,
  location,
  canEdit,
  actionPending,
  onSelectProfile,
  onUpdated,
  onRemoved,
  onPendingChange,
}: {
  profile: LeadGbpProfile
  profiles: LeadGbpProfile[]
  companyName: string
  /** Resolvida no painel e repassada, para os dois montadores concordarem. */
  location: LeadLocation
  canEdit: boolean
  actionPending: boolean
  onSelectProfile: (profileId: string) => void
  onUpdated: (profile: LeadGbpProfile) => void
  onRemoved: (profileId: string) => void
  onPendingChange: (pending: boolean) => void
}): GbpProfileController {
  const [notesStatus, setNotesStatus] = useState<GbpNotesStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [savingReplyTime, setSavingReplyTime] = useState(false)
  const [pollTimedOut, setPollTimedOut] = useState(false)
  const [busy, setBusy] = useState(false)
  const onUpdatedRef = useRef(onUpdated)
  // Ref de "valor mais recente": a escrita vai para um efeito, nunca no render.
  useEffect(() => {
    onUpdatedRef.current = onUpdated
  })
  const notesRef = useRef(profile.notes ?? "")
  // A leitura de reputação divide o mesmo ciclo de salvamento das notas: são
  // duas colunas da mesma linha, gravadas pela mesma action.
  const reputationRef = useRef(profile.reputation_note ?? "")
  const notesTimerRef = useRef(0)
  const profileRef = useRef(profile)
  useEffect(() => {
    profileRef.current = profile
  })

  const queuedKey = queuedKindsKey(profile)

  // Resets ligados à troca de perfil/coleta: no render, não em efeito.
  const [syncedProfileId, setSyncedProfileId] = useState(profile.id)
  if (syncedProfileId !== profile.id) {
    setSyncedProfileId(profile.id)
    setNotesStatus("idle")
  }

  const pollKey = `${profile.id}|${queuedKey}|${profile.enrichment_at ?? ""}`
  const [syncedPollKey, setSyncedPollKey] = useState(pollKey)
  if (syncedPollKey !== pollKey) {
    setSyncedPollKey(pollKey)
    setPollTimedOut(false)
  }

  useEffect(() => {
    notesRef.current = profile.notes ?? ""
    reputationRef.current = profile.reputation_note ?? ""
  }, [profile.id, profile.notes, profile.reputation_note])

  useEffect(() => {
    if (!canEdit || !queuedKey) return
    let cancelled = false
    const startedAt = Date.now()

    async function tick() {
      if (cancelled) return
      if (Date.now() - startedAt >= POLL_MAX_MS) {
        setPollTimedOut(true)
        return
      }
      const formData = new FormData()
      formData.set("profile_id", profile.id)
      const result = await pollLeadGbpJobs(formData)
      if (cancelled) return
      if (result.status === "error") {
        setError(result.message)
        return
      }
      onUpdatedRef.current(result.profile)
    }

    void tick()
    const timer = window.setInterval(() => {
      void tick()
    }, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [canEdit, profile.id, queuedKey, profile.enrichment_at])

  useEffect(() => {
    return () => {
      window.clearTimeout(notesTimerRef.current)
      const current = profileRef.current
      const notes = notesRef.current
      const reputation = reputationRef.current
      const dirty =
        notes.trim() !== (current.notes ?? "") ||
        reputation.trim() !== (current.reputation_note ?? "")
      if (!dirty) return
      const formData = new FormData()
      formData.set("profile_id", current.id)
      formData.set("notes", notes)
      formData.set("reputation_note", reputation)
      formData.set("set_primary", "false")
      void updateLeadGbpProfile(formData)
    }
  }, [profile.id])

  const snapshot = profile.payload
  const enrichment = profile.enrichment
  const mapsUri =
    enrichment?.checkUrl ?? profile.google_maps_uri ?? snapshot.googleMapsUri
  const gaps = gbpGapsForProfile(
    snapshot,
    companyName,
    profile.matched_website_key,
    enrichment,
    {
      posts: profile.posts,
      postsReady:
        profile.posts !== null && !gbpJobQueued(profile.jobs, "updates"),
      reviews: profile.reviews,
      reviewsReady:
        profile.reviews !== null && !gbpJobQueued(profile.jobs, "reviews"),
      qna: profile.qna,
      rankKeywords: profile.rank_keywords,
      rankChecks: profile.rankChecks,
      analystReview: profile.analyst_review,
      today: todayCivilDate(),
      reviewsDelta: profile.reviews_delta,
      location,
    },
  )
  const reputation = gbpReputation({
    reviews: profile.reviews,
    distribution: profile.enrichment?.ratingDistribution ?? null,
    today: todayCivilDate(),
  })
  const opportunities = mergeGbpOpportunities({
    gaps,
    reputation,
    reviewsDelta: profile.reviews_delta,
    rankChecks: profile.rankChecks,
    keywords: profile.rank_keywords,
    reputationNote: profile.reputation_note,
    analystReview: profile.analyst_review,
    enrichment,
    location,
  })
  const collectingPosts = profile.jobs.some(
    (job) => job.kind === "updates" && job.status === "queued",
  )
  const collectingReviews = profile.jobs.some(
    (job) => job.kind === "reviews" && job.status === "queued",
  )
  const collecting =
    collectingPosts || collectingReviews || actionPending || busy
  const failedJobs = profile.jobs.filter((job) => job.status === "failed")

  function analystFieldsDirty() {
    const current = profileRef.current
    return (
      notesRef.current.trim() !== (current.notes ?? "") ||
      reputationRef.current.trim() !== (current.reputation_note ?? "")
    )
  }

  async function persistNotes() {
    if (!analystFieldsDirty()) {
      setNotesStatus("idle")
      return true
    }
    setNotesStatus("saving")
    setError(null)
    const formData = new FormData()
    formData.set("profile_id", profileRef.current.id)
    formData.set("notes", notesRef.current)
    formData.set("reputation_note", reputationRef.current)
    formData.set("set_primary", "false")
    const result = await updateLeadGbpProfile(formData)
    if (result.status === "error") {
      setNotesStatus("error")
      setError(result.message)
      return false
    }
    onUpdated(result.profile)
    setNotesStatus("saved")
    return true
  }

  function scheduleAnalystSave() {
    window.clearTimeout(notesTimerRef.current)
    if (!canEdit) return
    if (!analystFieldsDirty()) return
    notesTimerRef.current = window.setTimeout(() => {
      void persistNotes()
    }, NOTES_DEBOUNCE_MS)
  }

  function handleReplyTimeChange(band: GbpReplyTimeBand | null) {
    if (savingReplyTime) return
    setSavingReplyTime(true)
    onPendingChange(true)
    setError(null)
    const formData = new FormData()
    formData.set("profile_id", profile.id)
    // Só a faixa vai no corpo; o servidor preserva os diretórios e carimba a
    // data apenas nesta resposta.
    formData.set("analyst_review", JSON.stringify({ band }))
    void updateLeadGbpAnalystReview(formData).then((result) => {
      setSavingReplyTime(false)
      onPendingChange(false)
      if (result.status === "error") {
        setError(result.message)
        return
      }
      onUpdatedRef.current(result.profile)
    })
  }

  function handleDraftChange(next: string) {
    notesRef.current = next
    scheduleAnalystSave()
  }

  function handleReputationDraftChange(next: string) {
    reputationRef.current = next
    scheduleAnalystSave()
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    onPendingChange(true)
    setError(null)
    try {
      await action()
    } finally {
      setBusy(false)
      onPendingChange(false)
    }
  }

  function handleRefresh() {
    void run(async () => {
      const formData = new FormData()
      formData.set("profile_id", profile.id)
      const result = await refreshLeadGbpProfile(formData)
      if (result.status === "error") {
        setError(result.message)
        return
      }
      onUpdated(result.profile)
    })
  }

  function handleEnrich() {
    void run(async () => {
      const formData = new FormData()
      formData.set("profile_id", profile.id)
      const result = await enrichLeadGbpProfile(formData)
      if (result.status === "error") {
        setError(result.message)
        return
      }
      onUpdated(result.profile)
    })
  }

  function handlePrimary() {
    void run(async () => {
      if (analystFieldsDirty()) {
        const saved = await persistNotes()
        if (!saved) return
      }
      const formData = new FormData()
      formData.set("profile_id", profile.id)
      formData.set("notes", notesRef.current)
      formData.set("reputation_note", reputationRef.current)
      formData.set("set_primary", "true")
      const result = await updateLeadGbpProfile(formData)
      if (result.status === "error") {
        setError(result.message)
        return
      }
      onUpdated(result.profile)
    })
  }

  function handleSaveRankKeywords(keywords: string[]) {
    return run(async () => {
      const formData = new FormData()
      formData.set("profile_id", profile.id)
      formData.set("rank_keywords", JSON.stringify(keywords))
      const result = await updateLeadGbpRankKeywords(formData)
      if (result.status === "error") {
        setError(result.message)
        throw new Error(result.message)
      }
      onUpdated(result.profile)
    })
  }

  function handleCheckRanking() {
    return run(async () => {
      const formData = new FormData()
      formData.set("profile_id", profile.id)
      const result = await checkLeadGbpRanking(formData)
      if (result.status === "error") {
        setError(result.message)
        throw new Error(result.message)
      }
      onUpdated(result.profile)
    })
  }

  function handleRemove() {
    void run(async () => {
      const formData = new FormData()
      formData.set("profile_id", profile.id)
      const result = await removeLeadGbpProfile(formData)
      if (result.status === "error") {
        setError(result.message)
        return
      }
      onRemoved(result.profileId)
    })
  }

  return {
    profile,
    profiles,
    companyName,
    canEdit,
    gaps,
    reputation,
    opportunities,
    mapsUri,
    updatedAt: latestGbpCollectedAt(profile),
    collecting,
    collectingPosts,
    collectingReviews,
    pollTimedOut,
    queuedKey,
    failedJobs,
    busy,
    error,
    notesStatus,
    savingReplyTime,
    onSelectProfile,
    handleRefresh,
    handleEnrich,
    handlePrimary,
    handleRemove,
    handleSaveRankKeywords,
    handleCheckRanking,
    handleReplyTimeChange,
    handleDraftChange,
    handleReputationDraftChange,
    persistNotes,
    onUpdated,
    onPendingChange,
  }
}
