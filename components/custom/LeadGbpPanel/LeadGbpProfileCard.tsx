"use client"

import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiDeleteBinLine, RiMore2Line, RiRefreshLine, RiStarLine } from "react-icons/ri"
import { LeadGbpIdentity } from "./LeadGbpIdentity"
import { LeadGbpDirectoriesCard } from "./LeadGbpDirectoriesCard"
import { LeadGbpInformationCard } from "./LeadGbpInformationCard"
import { LeadGbpNotesCard } from "./LeadGbpNotesCard"
import { LeadGbpOpportunitiesCard } from "./LeadGbpOpportunitiesCard"
import { LeadGbpPostsBlock } from "./LeadGbpPostsBlock"
import { LeadGbpQnaBlock } from "./LeadGbpQnaBlock"
import { LeadGbpRankBlock } from "./LeadGbpRankBlock"
import { LeadGbpReviewsBlock } from "./LeadGbpReviewsBlock"
import { LeadGbpStepHeader } from "./LeadGbpStepHeader"
import { LeadGbpSummaryCards } from "./LeadGbpSummaryCards"
import { useGbpProfileController } from "./use-gbp-profile-controller"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { LeadGbpProfile } from "@/lib/leads/gbp"
import type { LeadLocation } from "@/lib/leads/resolve-location"

const EASE = [0.23, 1, 0.32, 1] as const

export function LeadGbpProfileCard(props: {
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
}) {
  const c = useGbpProfileController(props)
  const { profile, profiles, canEdit } = props
  const snapshot = profile.payload

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

  return (
    <m.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-3"
    >
      <m.div variants={item} className="flex items-start justify-between gap-3">
        <LeadGbpStepHeader
          updatedAt={c.updatedAt}
          mapsHref={c.mapsUri}
          collecting={c.collecting}
          canEdit={canEdit}
          onEnrich={c.handleEnrich}
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
                onClick={c.handlePrimary}
              >
                <RiStarLine size={16} aria-hidden />
                Definir como principal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={c.handleRefresh}>
                <RiRefreshLine size={16} aria-hidden />
                Atualizar dados do Places
              </DropdownMenuItem>
              <DropdownMenuItem onClick={c.handleRemove} variant="destructive">
                <RiDeleteBinLine size={16} aria-hidden />
                Remover
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </m.div>

      {c.collectingPosts ? (
        <p className="text-xs/relaxed text-muted-foreground">
          Coletando postagens…
        </p>
      ) : null}
      {c.collectingReviews ? (
        <p className="text-xs/relaxed text-muted-foreground">
          Coletando avaliações…
        </p>
      ) : null}
      {c.pollTimedOut && c.queuedKey ? (
        <p className="text-xs/relaxed text-muted-foreground">
          Ainda coletando — abra de novo.
        </p>
      ) : null}

      {c.failedJobs.map((job) => (
        <p
          key={job.kind}
          role="alert"
          className="text-xs/relaxed text-destructive"
        >
          {job.error_message ??
            "Não foi possível coletar os dados. Tente novamente."}
        </p>
      ))}

      {c.error && c.notesStatus !== "error" ? (
        <p role="alert" className="text-xs/relaxed text-destructive">
          {c.error}
        </p>
      ) : null}

      <m.div variants={item}>
        <LeadGbpIdentity
          profile={profile}
          profiles={profiles}
          onSelectProfile={c.onSelectProfile}
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
          <LeadGbpInformationCard profile={profile} gaps={c.gaps} />
        </m.div>
        <m.div variants={item}>
          <LeadGbpReviewsBlock
            reviews={profile.reviews}
            rating={snapshot.rating}
            ratingCount={snapshot.userRatingCount}
            distribution={profile.enrichment?.ratingDistribution ?? null}
            replyTimeBand={profile.analyst_review.replyTime.band}
            canEdit={canEdit}
            savingReplyTime={c.savingReplyTime}
            onReplyTimeChange={c.handleReplyTimeChange}
            reputation={c.reputation}
            reviewsDelta={profile.reviews_delta}
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
            pending={props.actionPending || c.busy}
            onSave={c.handleSaveRankKeywords}
            onCheck={c.handleCheckRanking}
          />
        </m.div>
        <m.div variants={item}>
          <LeadGbpOpportunitiesCard items={c.opportunities} />
        </m.div>
        <m.div variants={item} className="md:col-span-2 xl:col-span-1">
          <LeadGbpDirectoriesCard
            profileId={profile.id}
            companyName={props.companyName}
            review={profile.analyst_review}
            canEdit={canEdit}
            onProfileChange={c.onUpdated}
            onPendingChange={c.onPendingChange}
          />
        </m.div>
        <m.div variants={item} className="md:col-span-2 xl:col-span-1">
          <LeadGbpNotesCard
            id={`gbp-notes-${profile.id}`}
            profileId={profile.id}
            initialValue={profile.notes ?? ""}
            canEdit={canEdit}
            status={c.notesStatus}
            errorMessage={c.notesStatus === "error" ? c.error : null}
            onDraftChange={c.handleDraftChange}
            onRetry={() => {
              void c.persistNotes()
            }}
          />
        </m.div>
        <m.div variants={item} className="md:col-span-2 xl:col-span-1">
          <LeadGbpNotesCard
            id={`gbp-reputation-${profile.id}`}
            profileId={profile.id}
            initialValue={profile.reputation_note ?? ""}
            canEdit={canEdit}
            status={c.notesStatus}
            errorMessage={c.notesStatus === "error" ? c.error : null}
            onDraftChange={c.handleReputationDraftChange}
            onRetry={() => {
              void c.persistNotes()
            }}
            title="Leitura da reputação"
            placeholder="Sentimento das avaliações, temas recorrentes, o que os números não contam"
          />
        </m.div>
      </m.div>
    </m.div>
  )
}
