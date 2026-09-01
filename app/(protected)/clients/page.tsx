import { requireCommercialMember } from "@/lib/auth/session"
import { listClients } from "@/app/actions/clients"
import { ClientsList } from "@/components/custom/ClientsList"

export default async function ClientsPage() {
  await requireCommercialMember()
  const result = await listClients()

  if (result.status === "error") {
    throw new Error(result.message)
  }

  return <ClientsList clients={result.clients} />
}
