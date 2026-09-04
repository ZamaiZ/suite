import type { BriefingWebsitePayload } from "@/lib/briefing/website"

export type BriefingReviewWebsiteProps = {
  clientId: string
  payload: BriefingWebsitePayload
  canOpenAssets?: boolean
}
