"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { crawlWebsite } from "@/lib/website-audit"
import { canonicalWebsiteUrl } from "@/lib/leads/website"
import {
  readLeadWebsiteAuditRow,
  type LeadWebsiteAudit,
} from "@/lib/leads/website-audit"
import {
  analyzeWebsiteSchema,
  readAnalyzeWebsiteFields,
} from "@/lib/validations/lead-website"
import { createClient } from "@/lib/supabase/server"
import {
  denyWebsiteEdit,
  enqueueWebsitePagespeedJobs,
  loadWebsiteChannelRow,
  loadWebsiteReviewForChannel,
  WEBSITE_SELECT,
} from "./website-access"

export type AnalyzeLeadWebsiteState =
  | { status: "success"; audit: LeadWebsiteAudit }
  | { status: "error"; message: string }

const ANALYZE_FAILED = "Não foi possível analisar o site. Tente novamente."

export async function analyzeLeadWebsite(
  formData: FormData,
): Promise<AnalyzeLeadWebsiteState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = analyzeWebsiteSchema.safeParse(
    readAnalyzeWebsiteFields(formData),
  )
  if (!parsed.success) {
    return { status: "error", message: "Site inválido." }
  }

  const supabase = await createClient()
  const loaded = await loadWebsiteChannelRow(supabase, parsed.data.channel_id)
  if (loaded.status === "error") {
    return { status: "error", message: ANALYZE_FAILED }
  }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Site não encontrado." }
  }

  const denied = denyWebsiteEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  const startUrl = canonicalWebsiteUrl(loaded.channel.normalized_key)
  const crawled = await crawlWebsite(startUrl, loaded.channel.audit_paths)
  if (crawled.status === "error") {
    return { status: "error", message: crawled.message }
  }

  // Primeira coleta do canal fixa a amostra; as seguintes a reutilizam, para
  // que o comparativo compare as mesmas URLs.
  if (loaded.channel.audit_paths.length === 0 && crawled.usedPaths.length > 0) {
    await supabase
      .from("lead_digital_channels")
      .update({ audit_paths: crawled.usedPaths })
      .eq("id", loaded.channel.id)
  }

  const now = new Date().toISOString()
  const payload = {
    lead_id: loaded.lead.id,
    channel_id: loaded.channel.id,
    url: crawled.crawl.finalUrl,
    fetched_at: now,
    fetched_by: user.id,
    crawl: crawled.crawl,
    pagespeed: null,
    pagespeed_at: null,
  }

  // Append-only: cada analise cria um snapshot novo e preserva os anteriores.
  const { data, error } = await supabase
    .from("lead_website_audits")
    .insert(payload)
    .select(WEBSITE_SELECT)
    .single()
  if (error || !data || typeof data.id !== "string") {
    return { status: "error", message: ANALYZE_FAILED }
  }

  const enqueued = await enqueueWebsitePagespeedJobs(supabase, data.id)
  if (!enqueued) {
    return { status: "error", message: ANALYZE_FAILED }
  }

  const { data: withJobs, error: jobsError } = await supabase
    .from("lead_website_audits")
    .select(WEBSITE_SELECT)
    .eq("id", data.id)
    .single()
  if (jobsError || !withJobs) {
    return { status: "error", message: ANALYZE_FAILED }
  }

  // A revisao do analista sobrevive a nova coleta: ela vive por canal.
  const review = await loadWebsiteReviewForChannel(supabase, loaded.channel.id)
  const audit = readLeadWebsiteAuditRow(
    withJobs as Record<string, unknown>,
    review,
  )
  if (!audit) {
    return { status: "error", message: ANALYZE_FAILED }
  }
  return { status: "success", audit }
}
