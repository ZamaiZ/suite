import type { BriefingFinancePayload } from "@/lib/briefing/finance"

export type BriefingReviewFinanceProps = {
  payload: BriefingFinancePayload
  productName: string | null
  serviceName: string | null
}
