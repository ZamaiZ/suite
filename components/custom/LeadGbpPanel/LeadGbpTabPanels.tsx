"use client"

import { useState } from "react"
import { LeadGbpDirectoriesCard } from "./LeadGbpDirectoriesCard"
import { LeadGbpGridSection } from "./LeadGbpGridSection"
import { LeadGbpInformationCard } from "./LeadGbpInformationCard"
import { LeadGbpPostsBlock } from "./LeadGbpPostsBlock"
import { LeadGbpQnaBlock } from "./LeadGbpQnaBlock"
import { LeadGbpRankBlock } from "./LeadGbpRankBlock"
import { LeadGbpServicesCard } from "./LeadGbpServicesCard"
import { LeadGbpReviewsBlock } from "./LeadGbpReviewsBlock"
import type { GbpProfileController } from "./use-gbp-profile-controller"

type PanelProps = {
  controller: GbpProfileController
  readingMode: boolean
}

export function LeadGbpTabProfile({ controller }: PanelProps) {
  const { profile } = controller
  return (
    <div className="grid grid-cols-1 items-stretch gap-3.5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <LeadGbpInformationCard profile={profile} gaps={controller.gaps} />
      <div className="grid content-start gap-3.5">
        <LeadGbpServicesCard profile={profile} />
        <LeadGbpPostsBlock posts={profile.posts} />
        <LeadGbpQnaBlock qna={profile.qna} />
      </div>
    </div>
  )
}

export function LeadGbpTabReputation({ controller, readingMode }: PanelProps) {
  const { profile } = controller
  return (
    <div className="grid grid-cols-1 items-stretch gap-3.5">
      <LeadGbpReviewsBlock
        reviews={profile.reviews}
        rating={profile.payload.rating}
        ratingCount={profile.payload.userRatingCount}
        distribution={profile.enrichment?.ratingDistribution ?? null}
        replyTimeBand={profile.analyst_review.replyTime.band}
        canEdit={controller.canEdit && !readingMode}
        savingReplyTime={controller.savingReplyTime}
        onReplyTimeChange={controller.handleReplyTimeChange}
        reputation={controller.reputation}
        reviewsDelta={profile.reviews_delta}
      />
    </div>
  )
}

export function LeadGbpTabRanking({
  controller,
  readingMode,
  active,
}: PanelProps & { active: boolean }) {
  const { profile } = controller
  // `keepMounted` deixa este painel montado desde que o perfil abre. Sem esta
  // guarda, o Google Maps JS e os tiles carregariam em todo perfil aberto,
  // inclusive nos que ninguém vai olhar. Uma vez visitado, o mapa fica.
  const [mapMounted, setMapMounted] = useState(false)
  if (active && !mapMounted) setMapMounted(true)

  return (
    <div className="grid grid-cols-1 items-stretch gap-3.5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <LeadGbpGridSection
        profileId={profile.id}
        keywords={profile.rank_keywords}
        initialScan={profile.gridScan}
        canEdit={controller.canEdit && !readingMode}
        mapMounted={mapMounted}
      />
      <LeadGbpRankBlock
        keywords={profile.rank_keywords}
        checks={profile.rankChecks}
        canEdit={controller.canEdit && !readingMode}
        pending={controller.busy}
        onSave={controller.handleSaveRankKeywords}
        onCheck={controller.handleCheckRanking}
      />
    </div>
  )
}

export function LeadGbpTabDirectories({ controller, readingMode }: PanelProps) {
  const { profile } = controller
  return (
    <LeadGbpDirectoriesCard
      profileId={profile.id}
      companyName={controller.companyName}
      review={profile.analyst_review}
      canEdit={controller.canEdit && !readingMode}
      onProfileChange={controller.onUpdated}
      onPendingChange={controller.onPendingChange}
    />
  )
}
