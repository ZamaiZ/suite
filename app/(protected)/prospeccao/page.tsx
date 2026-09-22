import { requireCommercialMember } from "@/lib/auth/session"
import {
  listProspectCampaigns,
  prospectCostSummary,
} from "@/app/actions/prospect"
import { ProspectCampaigns } from "@/components/custom/ProspectCampaigns"

/**
 * A lista de campanhas.
 *
 * `maxDuration` aqui porque a Server Action herda o teto do segmento de rota
 * que a chamou: a criação de campanha passa por `categories_aggregation` e
 * pelo geocoder, e o padrão da plataforma não dá folga para os dois.
 */
export const maxDuration = 60

export default async function ProspeccaoPage() {
  await requireCommercialMember()
  const [campaigns, cost] = await Promise.all([
    listProspectCampaigns(),
    prospectCostSummary(),
  ])

  return <ProspectCampaigns campaigns={campaigns} totalCostUsd={cost.totalUsd} />
}
