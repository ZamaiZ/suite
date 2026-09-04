"use client"

import { useEffect, useRef, useState } from "react"
import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { Menu } from "@base-ui/react/menu"
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
  updateLeadGbpProfile,
  updateLeadGbpRankKeywords,
} from "@/app/actions/leads"
import { LeadGbpIdentity } from "./LeadGbpIdentity"
import { LeadGbpInformationCard } from "./LeadGbpInformationCard"
import { LeadGbpNotesCard, type GbpNotesStatus } from "./LeadGbpNotesCard"
import { LeadGbpOpportunitiesCard } from "./LeadGbpOpportunitiesCard"
import { LeadGbpPostsBlock } from "./LeadGbpPostsBlock"
import { LeadGbpQnaBlock } from "./LeadGbpQnaBlock"
import { LeadGbpRankBlock } from "./LeadGbpRankBlock"
import { LeadGbpReviewsBlock } from "./LeadGbpReviewsBlock"
import { LeadGbpStepHeader } from "./LeadGbpStepHeader"
import { LeadGbpSummaryCards } from "./LeadGbpSummaryCards"
import { useDialogPortalContainer } from "@/components/ui/Dialog"
import { cn } from "@/lib/cn"
import { gbpJobQueued } from "@/lib/leads/gbp-audit"
import { mergeGbpOpportunities } from "@/lib/leads/gbp-opportunities"
import {
  gbpGapsForProfile,
  type LeadGbpProfile,
} from "@/lib/leads/gbp"
import { latestGbpCollectedAt } from "@/lib/leads/gbp-presenters"

const MENU_ITEM = cn(
  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5",
  "font-sans text-body-sm text-fg outline-none",
  "data-highlighted:bg-hover",
  "data-disabled:pointer-events-none data-disabled:opacity-50",
)

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
  const portalContainer = useDialogPortalContainer()
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

  useEffect(() => {
    notesRef.current = profile.notes ?? ""
    reputationRef.current = profile.reputation_note ?? ""
    setNotesStatus("idle")
  }, [profile.id])

  useEffect(() => {
    setPollTimedOut(false)
  }, [profile.id, queuedKey, profile.enrichment_at])

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
    },
  )
  const opportunities = mergeGbpOpportunities({
    gaps,
    rankChecks: profile.rankChecks,
    keywords: profile.rank_keywords,
    reputationNote: profile.reputation_note,
  })
  const collectingPosts = profile.jobs.some(
    (job) => job.kind === "updates" && job.status === "queued",
  )
  const collectingReviews = profile.jobs.some(
    (job) => job.kind === "reviews" && job.status === "queued",
  )
  const collecting = collectingPosts || collectingReviews || actionPending || busy
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
        <m.div
          variants={item}
          className="flex items-start justify-between gap-3"
        >
          <LeadGbpStepHeader
            updatedAt={latestGbpCollectedAt(profile)}
            mapsHref={mapsUri}
            collecting={collecting}
            canEdit={canEdit}
            onEnrich={handleEnrich}
          />
          {canEdit ? (
            <Menu.Root>
              <Menu.Trigger
                aria-label="Ações do perfil"
                className={cn(
                  "mt-0.5 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md",
                  "text-fg-muted transition-[background-color,color,transform] duration-150 ease-out",
                  "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-hover",
                  "[@media(hover:hover)_and_(pointer:fine)]:hover:text-fg",
                  "data-popup-open:bg-hover data-popup-open:text-fg",
                  "active:scale-[0.97]",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                )}
              >
                <RiMore2Line size={16} aria-hidden />
              </Menu.Trigger>
              <Menu.Portal container={portalContainer ?? undefined}>
                <Menu.Positioner
                  className="z-50 outline-none"
                  sideOffset={4}
                  align="end"
                >
                  <Menu.Popup
                    className={cn(
                      "pointer-events-auto min-w-44 rounded-md border border-popover-border bg-popover p-1 shadow-raised",
                      "origin-[var(--transform-origin)]",
                      "transition-[transform,opacity] duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
                      "data-starting-style:opacity-0 data-starting-style:scale-[0.96]",
                      "data-ending-style:opacity-0 data-ending-style:scale-[0.96] data-ending-style:duration-[140ms]",
                    )}
                  >
                    <Menu.Item
                      disabled={profile.is_primary}
                      onClick={handlePrimary}
                      className={MENU_ITEM}
                    >
                      <RiStarLine size={16} aria-hidden />
                      Definir como principal
                    </Menu.Item>
                    <Menu.Item onClick={handleRefresh} className={MENU_ITEM}>
                      <RiRefreshLine size={16} aria-hidden />
                      Atualizar dados do Places
                    </Menu.Item>
                    <Menu.Item onClick={handleRemove} className={MENU_ITEM}>
                      <RiDeleteBinLine size={16} aria-hidden />
                      Remover
                    </Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          ) : null}
        </m.div>

        {collectingPosts ? (
          <p className="font-sans text-body-sm text-fg-secondary">
            Coletando postagens…
          </p>
        ) : null}
        {collectingReviews ? (
          <p className="font-sans text-body-sm text-fg-secondary">
            Coletando avaliações…
          </p>
        ) : null}
        {pollTimedOut && queuedKey ? (
          <p className="font-sans text-body-sm text-fg-secondary">
            Ainda coletando — abra de novo.
          </p>
        ) : null}

        {failedJobs.map((job) => (
          <p
            key={job.kind}
            role="alert"
            className="font-sans text-body-sm text-danger"
          >
            {job.error_message ??
              "Não foi possível coletar os dados. Tente novamente."}
          </p>
        ))}

        {error && notesStatus !== "error" ? (
          <p role="alert" className="font-sans text-body-sm text-danger">
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
              keywords={profile.rank_keywords}
              checks={profile.rankChecks}
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
