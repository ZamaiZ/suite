import { z } from "zod"
import {
  FINANCE_TEXTAREA_MAX,
  REVENUE_RANGE_IDS,
  SEASONALITY_PROFILE_IDS,
  type BriefingFinancePayload,
  type RevenueRangeId,
  type SeasonalityProfileId,
} from "@/lib/briefing/finance"

const financeText = z.string().trim().max(FINANCE_TEXTAREA_MAX)
const optionalId = z.union([z.string().trim().min(1).max(120), z.null()])

export const briefingFinancePayloadSchema = z.object({
  monthlyRevenueRange: z.union([z.enum(REVENUE_RANGE_IDS), z.null()]),
  peakRevenueRange: z.union([z.enum(REVENUE_RANGE_IDS), z.null()]),
  peakRevenueReason: financeText,
  seasonalityProfile: z.union([z.enum(SEASONALITY_PROFILE_IDS), z.null()]),
  seasonalityNotes: financeText,
  highestProfitProductId: optionalId,
  highestProfitServiceId: optionalId,
  averageTicketRange: z.union([z.enum(REVENUE_RANGE_IDS), z.null()]),
})

export type BriefingFinanceInput = z.infer<typeof briefingFinancePayloadSchema>

export function toFinancePayload(
  data: BriefingFinanceInput,
): BriefingFinancePayload {
  const seasonalityProfile = data.seasonalityProfile as SeasonalityProfileId | null

  return {
    monthlyRevenueRange: data.monthlyRevenueRange as RevenueRangeId | null,
    peakRevenueRange: data.peakRevenueRange as RevenueRangeId | null,
    peakRevenueReason: data.peakRevenueReason,
    seasonalityProfile,
    seasonalityNotes:
      seasonalityProfile === "predictable" ? "" : data.seasonalityNotes,
    highestProfitProductId: data.highestProfitProductId,
    highestProfitServiceId: data.highestProfitServiceId,
    averageTicketRange: data.averageTicketRange as RevenueRangeId | null,
  }
}
