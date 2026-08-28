import { endOfTodayIso } from "@/lib/date-time"
import { isBrazilStateCode } from "@/lib/br-locations"
import { isSegmentSlug } from "@/lib/leads/segments"
import { isTagSlug } from "@/lib/leads/tags"

export type LeadsListParams = {
  q: string
  team: boolean
  today: boolean
  pending: boolean
  tag: string | null
  segment: string | null
  city: string | null
  state: string | null
}

export function isLeadId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
}

export function isBoardFlagOn(value: unknown): boolean {
  return value === "1"
}

export function isPendingFilterOn(value: unknown): boolean {
  return value !== "0"
}

export function firstSearchParam(value: unknown): string | undefined {
  if (typeof value === "string") return value
  if (Array.isArray(value) && typeof value[0] === "string") return value[0]
  return undefined
}

export function leadsListHref(input: {
  q?: string
  team?: boolean
  today?: boolean
  pending?: boolean
  tag?: string | null
  segment?: string | null
  city?: string | null
  state?: string | null
  lead?: string
} = {}): string {
  const params = new URLSearchParams()
  const query = input.q?.trim()
  if (query) params.set("q", query)
  if (input.team) params.set("team", "1")
  if (input.today) params.set("today", "1")
  if (input.pending === false) params.set("pending", "0")
  if (input.tag && isTagSlug(input.tag)) params.set("tag", input.tag)
  if (input.segment && isSegmentSlug(input.segment)) {
    params.set("segment", input.segment)
  }
  const city = input.city?.trim()
  const state = input.state?.trim().toUpperCase()
  if (city && state && isBrazilStateCode(state)) {
    params.set("city", city)
    params.set("state", state)
  }
  if (input.lead && isLeadId(input.lead)) params.set("lead", input.lead)
  const search = params.toString()
  return search ? `/leads?${search}` : "/leads"
}

export { endOfTodayIso as endOfAppDayIso }
