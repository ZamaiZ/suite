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
  const crawled = await crawlWebsite(startUrl)
  if (crawled.status === "error") {
    return { status: "error", message: crawled.message }
  }

  const now = new Date().toISOString()
  const { data: existing, error: existingError } = await supabase
    .from("lead_website_audits")
    .select("id")
    .eq("channel_id", loaded.channel.id)
    .maybeSingle()

  if (existingError) {
    return { status: "error", message: ANALYZE_FAILED }
  }

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

  const query = existing?.id
    ? supabase
        .from("lead_website_audits")
        .update(payload)
        .eq("id", existing.id)
        .select(WEBSITE_SELECT)
        .single()
    : supabase
        .from("lead_website_audits")
        .insert(payload)
        .select(WEBSITE_SELECT)
        .single()

  const { data, error } = await query
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

  const audit = readLeadWebsiteAuditRow(withJobs as Record<string, unknown>)
  if (!audit) {
    return { status: "error", message: ANALYZE_FAILED }
  }
  return { status: "success", audit }
}
