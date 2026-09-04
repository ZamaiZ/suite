import type { BriefingListStatus } from "@/lib/briefing/status"
import { isClientKickoffStage } from "@/lib/clients/kickoff"
import type { ClientKickoffStage } from "@/lib/clients/types"

export function isClientId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
}

export type ClientsListParams = {
  q: string
  briefing: BriefingListStatus | null
  kickoff: ClientKickoffStage | null
  closer: string | null
}

export function isBriefingListStatus(value: unknown): value is BriefingListStatus {
  return value === "in_progress" || value === "finalized" || value === "edited_after_submit"
}

export function clientsListHref(input: Partial<ClientsListParams> & { client?: string } = {}): string {
  const params = new URLSearchParams()
  const searchQuery = input.q?.trim()
  if (searchQuery) params.set("q", searchQuery)
  if (input.briefing && isBriefingListStatus(input.briefing)) params.set("briefing", input.briefing)
  if (input.kickoff && isClientKickoffStage(input.kickoff)) params.set("kickoff", input.kickoff)
  if (input.closer && isClientId(input.closer)) params.set("closer", input.closer)
  if (input.client && isClientId(input.client)) {
    params.set("client", input.client)
  }
  const query = params.toString()
  return query.length > 0 ? `/clients?${query}` : "/clients"
}
