"use client"

import type { ReactNode } from "react"
import { LeadGbpIdentityCell } from "./LeadGbpIdentityCell"
import { LeadGbpMetricCells } from "./LeadGbpMetricCells"
import { LeadGbpStepHeader } from "./LeadGbpStepHeader"
import { LeadGbpStepTabs } from "./LeadGbpStepTabs"
import type { GbpProfileController } from "./use-gbp-profile-controller"
import type { GbpProfileTabId } from "@/lib/leads/gbp-profile-tabs"

/**
 * Primeira linha do grid da coluna central, fora da área de scroll: identidade
 * e números ficam à vista enquanto o analista percorre as abas.
 */
export function LeadGbpProfileHeader({
  controller,
  readingMode,
  tab,
  counts,
  notices,
  onAddProfile,
}: {
  controller: GbpProfileController
  readingMode: boolean
  tab: GbpProfileTabId
  counts: Record<GbpProfileTabId, number>
  notices: ReactNode
  onAddProfile: () => void
}) {
  return (
    <div className="border-b border-border/70 bg-background px-5 pt-4">
      <LeadGbpStepHeader
        updatedAt={controller.updatedAt}
        mapsHref={controller.mapsUri}
        collecting={controller.collecting}
        canEdit={controller.canEdit}
        readingMode={readingMode}
        isPrimary={controller.profile.is_primary}
        onEnrich={controller.handleEnrich}
        onPrimary={controller.handlePrimary}
        onRefresh={controller.handleRefresh}
        onRemove={controller.handleRemove}
        onAddProfile={onAddProfile}
      />

      <div className="mt-3.5 grid grid-cols-2 items-stretch gap-3 md:grid-cols-[minmax(0,1.15fr)_repeat(2,minmax(0,1fr))] xl:grid-cols-[minmax(0,1.15fr)_repeat(4,minmax(0,1fr))]">
        <LeadGbpIdentityCell
          profile={controller.profile}
          profiles={controller.profiles}
          onSelectProfile={controller.onSelectProfile}
        />
        <LeadGbpMetricCells profile={controller.profile} />
      </div>

      {notices}

      <LeadGbpStepTabs tab={tab} counts={counts} />
    </div>
  )
}
