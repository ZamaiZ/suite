import { requireCommercialMember } from "@/lib/auth/session"
import { listClients } from "@/app/actions/clients"
import { ClientsList } from "@/components/custom/ClientsList"
import { firstSearchParam } from "@/lib/leads/queues"
import { isClientId } from "@/lib/clients/href"

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireCommercialMember()
  const result = await listClients()
  const params = await searchParams
  const rawClient = firstSearchParam(params.client)
  const initialClientId = isClientId(rawClient) ? rawClient : null

  if (result.status === "error") {
    throw new Error(result.message)
  }

  return (
    <ClientsList clients={result.clients} initialClientId={initialClientId} />
  )
}
