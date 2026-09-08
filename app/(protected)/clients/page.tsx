import { requireCommercialMember } from "@/lib/auth/session"
import { listClients } from "@/app/actions/clients"
import { ClientsList } from "@/components/custom/ClientsList"
import { firstSearchParam } from "@/lib/leads/queues"
import {
  isBriefingListStatus,
  isClientId,
  type ClientsListParams,
} from "@/lib/clients/href"
import { isClientKickoffStage } from "@/lib/clients/kickoff"

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireCommercialMember()
  const params = await searchParams
  const rawQuery = firstSearchParam(params.q)
  const rawBriefing = firstSearchParam(params.briefing)
  const rawKickoff = firstSearchParam(params.kickoff)
  const rawCloser = firstSearchParam(params.closer)
  const listParams: ClientsListParams = {
    q: (rawQuery ?? "").replace(/[%*,()\\]/g, "").trim(),
    briefing: isBriefingListStatus(rawBriefing) ? rawBriefing : null,
    kickoff: isClientKickoffStage(rawKickoff) ? rawKickoff : null,
    closer: isClientId(rawCloser) ? rawCloser : null,
  }
  const result = await listClients(listParams)
  const rawClient = firstSearchParam(params.client)
  const initialClientId = isClientId(rawClient) ? rawClient : null

  if (result.status === "error") {
    throw new Error(result.message)
  }

  return (
    <ClientsList
      clients={result.clients}
      initialClientId={initialClientId}
      listParams={listParams}
      summary={
        result.summary ?? {
          total: result.clients.length,
          inProgress: 0,
          edited: 0,
          kickoffPending: 0,
        }
      }
      closerOptions={result.closerOptions ?? []}
    />
  )
}
