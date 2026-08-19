import { toCivilDate, todayCivilDate } from "@/lib/date-time"
import type { LeadStatus } from "@/lib/leads/status"

const PENDING_STATUSES = new Set<LeadStatus>(["contacting", "follow_up"])

export function hasActivityToday(lastActivityAt: string | null): boolean {
  if (!lastActivityAt) return false
  return toCivilDate(lastActivityAt) === todayCivilDate()
}

export function isPendingDailyActivity(lead: {
  status: LeadStatus
  last_activity_at: string | null
}): boolean {
  if (!PENDING_STATUSES.has(lead.status)) return false
  return !hasActivityToday(lead.last_activity_at)
}

export function matchesPendingFilter(
  lead: { status: LeadStatus; last_activity_at: string | null },
  pendingOn: boolean,
): boolean {
  if (!pendingOn) return true
  if (
    lead.status === "new" ||
    lead.status === "denied" ||
    lead.status === "interested"
  ) {
    return true
  }
  return isPendingDailyActivity(lead)
}
