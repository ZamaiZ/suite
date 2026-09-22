import { notFound } from "next/navigation"

import { requireCommercialMember } from "@/lib/auth/session"
import { loadProspectCampaign } from "@/app/actions/prospect"
import { ProspectWorkspace } from "@/components/custom/ProspectWorkspace"

/**
 * O teto da plataforma para esta tela.
 *
 * Server Action herda o `maxDuration` do segmento de rota que a chamou, e é
 * daqui que saem as passadas de descoberta e de enriquecimento. Sem declarar,
 * elas cairiam no padrão da plataforma — e o orçamento de 45 s da passada foi
 * dimensionado contra estes 60.
 */
export const maxDuration = 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function ProspeccaoCampanhaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireCommercialMember()
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const result = await loadProspectCampaign(id)
  if (result.status === "not_found") notFound()

  return <ProspectWorkspace view={result.view} />
}
