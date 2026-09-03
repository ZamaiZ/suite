import { z } from "zod"
import {
  HISTORY_ANSWER_IDS,
  HISTORY_TEXTAREA_MAX,
  sanitizeHistoryPayload,
  type BriefingHistoryPayload,
  type HistoryAnswerId,
} from "@/lib/briefing/history"

const historyText = z.string().trim().max(HISTORY_TEXTAREA_MAX)
const historyAnswer = z.union([z.enum(HISTORY_ANSWER_IDS), z.null()])

export const briefingHistoryPayloadSchema = z.object({
  hasMarketingInvestment: historyAnswer,
  marketingChannels: historyText,
  marketingResults: historyText,
  hasProviderDissatisfaction: historyAnswer,
  providerDissatisfactionNotes: historyText,
  projectGoals: historyText,
  npsTenCriteria: historyText,
})

export type BriefingHistoryInput = z.infer<typeof briefingHistoryPayloadSchema>

export function toHistoryPayload(
  data: BriefingHistoryInput,
): BriefingHistoryPayload {
  return sanitizeHistoryPayload({
    hasMarketingInvestment:
      data.hasMarketingInvestment as HistoryAnswerId | null,
    marketingChannels: data.marketingChannels,
    marketingResults: data.marketingResults,
    hasProviderDissatisfaction:
      data.hasProviderDissatisfaction as HistoryAnswerId | null,
    providerDissatisfactionNotes: data.providerDissatisfactionNotes,
    projectGoals: data.projectGoals,
    npsTenCriteria: data.npsTenCriteria,
  })
}
