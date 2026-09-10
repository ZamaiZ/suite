"use client"

import { LeadGbpAnalystBlock } from "./LeadGbpAnalystBlock"
import type { GbpProfileController } from "./use-gbp-profile-controller"
import { StepOpportunitiesRail } from "@/components/custom/LeadStepShell"
import { gbpOpportunitiesByTheme } from "@/lib/leads/gbp-opportunities"
import {
  GBP_PROFILE_TABS,
  type GbpProfileTabId,
} from "@/lib/leads/gbp-profile-tabs"

export function LeadGbpOpportunitiesRail({
  controller,
  activeTab,
  railOpen,
  onToggleRail,
  analystOpen,
  onAnalystOpenChange,
  analystFocusSignal,
  onRequestAnalyst,
}: {
  controller: GbpProfileController
  activeTab: GbpProfileTabId
  railOpen: boolean
  onToggleRail: () => void
  analystOpen: boolean
  onAnalystOpenChange: (next: boolean) => void
  analystFocusSignal: number
  onRequestAnalyst: () => void
}) {
  return (
    <StepOpportunitiesRail
      id="gbp-opportunities-rail"
      tabs={GBP_PROFILE_TABS}
      groups={gbpOpportunitiesByTheme(controller.opportunities)}
      total={controller.opportunities.length}
      activeTab={activeTab}
      railOpen={railOpen}
      onToggleRail={onToggleRail}
      onRequestAnalyst={onRequestAnalyst}
      analyst={
        <LeadGbpAnalystBlock
          controller={controller}
          open={analystOpen}
          onOpenChange={onAnalystOpenChange}
          focusSignal={analystFocusSignal}
        />
      }
    />
  )
}
