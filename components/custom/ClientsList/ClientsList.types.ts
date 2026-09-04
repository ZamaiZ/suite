import type { ClientListItem } from "@/app/actions/clients"
import type { ClientCloserOption, ClientsSummary } from "@/app/actions/clients"
import type { ClientsListParams } from "@/lib/clients/href"

export type ClientsListProps = {
  clients: ClientListItem[]
  initialClientId?: string | null
  listParams: ClientsListParams
  summary: ClientsSummary
  closerOptions: ClientCloserOption[]
}
