import { notFound } from "next/navigation"
import { loadClientPortalPage } from "@/app/actions/clients/load-client-portal-page"
import { ClientPortalBriefing } from "@/components/custom/ClientPortalBriefing"
import { ClientPortalGate } from "@/components/custom/ClientPortalGate"
import { ClientPortalShell } from "@/components/custom/ClientPortalShell"

export default async function ClientPortalPage({
  params,
}: PageProps<"/b/[slug]">) {
  const { slug } = await params
  const page = await loadClientPortalPage(slug)

  if (page.status === "not_found") {
    notFound()
  }

  if (page.status === "ready") {
    return <ClientPortalBriefing companyName={page.companyName} />
  }

  return (
    <ClientPortalShell
      title="Briefing inicial"
      description="Digite o código que você recebeu para acessar esta área."
    >
      <ClientPortalGate slug={page.slug} />
    </ClientPortalShell>
  )
}
