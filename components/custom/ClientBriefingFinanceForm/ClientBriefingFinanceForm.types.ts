import type { ProductOrService } from "@/lib/briefing/brand"
import type { BriefingFinancePayload } from "@/lib/briefing/finance"

export type ClientBriefingFinanceFormProps = {
  initialPayload: BriefingFinancePayload
  initialUpdatedAt: string | null
  initialCompletedAt: string | null
  productsAndServices: ProductOrService[]
  onBack?: () => void
  onContinue?: (completedAt: string) => void
}
