"use client"

import { useEffect, useRef, useState } from "react"
import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import {
  RiDeleteBinLine,
  RiMore2Line,
  RiRefreshLine,
  RiStarLine,
} from "react-icons/ri"
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
import { LeadGbpIdentity } from "./LeadGbpIdentity"
import type { GbpReplyTimeBand } from "@/lib/leads/gbp-analyst-review"
import { LeadGbpDirectoriesCard } from "./LeadGbpDirectoriesCard"
import { LeadGbpInformationCard } from "./LeadGbpInformationCard"
import { LeadGbpNotesCard, type GbpNotesStatus } from "./LeadGbpNotesCard"
import { LeadGbpOpportunitiesCard } from "./LeadGbpOpportunitiesCard"
import { LeadGbpPostsBlock } from "./LeadGbpPostsBlock"
import { LeadGbpQnaBlock } from "./LeadGbpQnaBlock"
import { LeadGbpRankBlock } from "./LeadGbpRankBlock"
import { LeadGbpReviewsBlock } from "./LeadGbpReviewsBlock"
import { LeadGbpStepHeader } from "./LeadGbpStepHeader"
import { LeadGbpSummaryCards } from "./LeadGbpSummaryCards"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { gbpJobQueued } from "@/lib/leads/gbp-audit"
import { mergeGbpOpportunities } from "@/lib/leads/gbp-opportunities"
import { gbpGapsForProfile, type LeadGbpProfile } from "@/lib/leads/gbp"
import { latestGbpCollectedAt } from "@/lib/leads/gbp-presenters"

const POLL_MS = 5000
const POLL_MAX_MS = 120_000
const NOTES_DEBOUNCE_MS = 800
const EASE = [0.23, 1, 0.32, 1] as const

function queuedKindsKey(profile: LeadGbpProfile): string {
  return profile.jobs
    .filter((job) => job.status === "queued")
    .map((job) => job.kind)
    .sort()
    .join(",")
}

export function LeadGbpProfileCard({
  profile,
  profiles,
  companyName,
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
  canEdit: boolean
  actionPending: boolean
  onSelectProfile: (profileId: string) => void
  onUpdated: (profile: LeadGbpProfile) => void
  onRemoved: (profileId: string) => void
  onPendingChange: (pending: boolean) => void
}) {
  const reduced = !!useReducedMotion()
  const container = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduced ? 0 : 0.04,
      },
    },
  }
  const item = {
    hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 8 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reduced ? 0.12 : 0.18, ease: EASE },
    },
  }
  const [notesStatus, setNotesStatus] = useState<GbpNotesStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [savingReplyTime, setSavingReplyTime] = useState(false)
  const [pollTimedOut, setPollTimedOut] = useState(false)
  const [busy, setBusy] = useState(false)
  const onUpdatedRef = useRef(onUpdated)
  onUpdatedRef.current = onUpdated
  const notesRef = useRef(profile.notes ?? "")
  // A leitura de reputação divide o mesmo ciclo de salvamento das notas: são
  // duas colunas da mesma linha, gravadas pela mesma action.
  const reputationRef = useRef(profile.reputation_note ?? "")
  const notesTimerRef = useRef(0)
  const profileRef = useRef(profile)
  profileRef.current = profile

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
    },
  )
  const opportunities = mergeGbpOpportunities({
    gaps,
    rankChecks: profile.rankChecks,
    keywords: profile.rank_keywords,
    reputationNote: profile.reputation_note,
    analystReview: profile.analyst_review,
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

  return (
    <m.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-3"
    >
      <m.div variants={item} className="flex items-start justify-between gap-3">
        <LeadGbpStepHeader
          updatedAt={latestGbpCollectedAt(profile)}
          mapsHref={mapsUri}
          collecting={collecting}
          canEdit={canEdit}
          onEnrich={handleEnrich}
        />
        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" />}
              aria-label="Ações do perfil"
            >
              <RiMore2Line size={16} aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem
                disabled={profile.is_primary}
                onClick={handlePrimary}
              >
                <RiStarLine size={16} aria-hidden />
                Definir como principal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRefresh}>
                <RiRefreshLine size={16} aria-hidden />
                Atualizar dados do Places
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRemove} variant="destructive">
                <RiDeleteBinLine size={16} aria-hidden />
                Remover
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </m.div>

      {collectingPosts ? (
        <p className="text-xs/relaxed text-muted-foreground">
          Coletando postagens…
        </p>
      ) : null}
      {collectingReviews ? (
        <p className="text-xs/relaxed text-muted-foreground">
          Coletando avaliações…
        </p>
      ) : null}
      {pollTimedOut && queuedKey ? (
        <p className="text-xs/relaxed text-muted-foreground">
          Ainda coletando — abra de novo.
        </p>
      ) : null}

      {failedJobs.map((job) => (
        <p
          key={job.kind}
          role="alert"
          className="text-xs/relaxed text-destructive"
        >
          {job.error_message ??
            "Não foi possível coletar os dados. Tente novamente."}
        </p>
      ))}

      {error && notesStatus !== "error" ? (
        <p role="alert" className="text-xs/relaxed text-destructive">
          {error}
        </p>
      ) : null}

      <m.div variants={item}>
        <LeadGbpIdentity
          profile={profile}
          profiles={profiles}
          onSelectProfile={onSelectProfile}
        />
      </m.div>

      <m.div variants={item}>
        <LeadGbpSummaryCards profile={profile} />
      </m.div>

      <m.div
        variants={container}
        className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
      >
        <m.div variants={item}>
          <LeadGbpInformationCard profile={profile} gaps={gaps} />
        </m.div>
        <m.div variants={item}>
          <LeadGbpReviewsBlock
            reviews={profile.reviews}
            rating={snapshot.rating}
            ratingCount={snapshot.userRatingCount}
            distribution={enrichment?.ratingDistribution ?? null}
            replyTimeBand={profile.analyst_review.replyTime.band}
            canEdit={canEdit}
            savingReplyTime={savingReplyTime}
            onReplyTimeChange={handleReplyTimeChange}
          />
        </m.div>
        <m.div variants={item}>
          <LeadGbpPostsBlock posts={profile.posts} />
        </m.div>
      </m.div>

      <m.div variants={item}>
        <LeadGbpQnaBlock qna={profile.qna} />
      </m.div>

      <m.div
        variants={container}
        className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
      >
        <m.div variants={item}>
          <LeadGbpRankBlock
            profileId={profile.id}
            keywords={profile.rank_keywords}
            checks={profile.rankChecks}
            gridScan={profile.gridScan}
            canEdit={canEdit}
            pending={actionPending || busy}
            onSave={handleSaveRankKeywords}
            onCheck={handleCheckRanking}
          />
        </m.div>
        <m.div variants={item}>
          <LeadGbpOpportunitiesCard items={opportunities} />
        </m.div>
        <m.div variants={item} className="md:col-span-2 xl:col-span-1">
          <LeadGbpDirectoriesCard
            profileId={profile.id}
            companyName={companyName}
            review={profile.analyst_review}
            canEdit={canEdit}
            onProfileChange={onUpdated}
            onPendingChange={onPendingChange}
          />
        </m.div>
        <m.div variants={item} className="md:col-span-2 xl:col-span-1">
          <LeadGbpNotesCard
            id={`gbp-notes-${profile.id}`}
            profileId={profile.id}
            initialValue={profile.notes ?? ""}
            canEdit={canEdit}
            status={notesStatus}
            errorMessage={notesStatus === "error" ? error : null}
            onDraftChange={handleDraftChange}
            onRetry={() => {
              void persistNotes()
            }}
          />
        </m.div>
        <m.div variants={item} className="md:col-span-2 xl:col-span-1">
          <LeadGbpNotesCard
            id={`gbp-reputation-${profile.id}`}
            profileId={profile.id}
            initialValue={profile.reputation_note ?? ""}
            canEdit={canEdit}
            status={notesStatus}
            errorMessage={notesStatus === "error" ? error : null}
            onDraftChange={handleReputationDraftChange}
            onRetry={() => {
              void persistNotes()
            }}
            title="Leitura da reputação"
            placeholder="Sentimento das avaliações, temas recorrentes, o que os números não contam"
          />
        </m.div>
      </m.div>
    </m.div>
  )
}
