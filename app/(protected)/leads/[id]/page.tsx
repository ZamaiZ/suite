import { notFound, redirect } from "next/navigation"
import { isLeadId } from "@/lib/leads/queues"

export default async function LeadDetailPage({
  params,
}: PageProps<"/leads/[id]">) {
  const { id } = await params
  if (!isLeadId(id)) notFound()
  redirect(`/leads?lead=${id}`)
}
