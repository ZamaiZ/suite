import type { ClientListItem } from "@/app/actions/clients"

export type ClientsListProps = {
  clients: ClientListItem[]
  initialClientId?: string | null
}
