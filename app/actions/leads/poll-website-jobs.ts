"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import {
  readLeadWebsiteAuditRow,
  type LeadWebsiteAudit,
} from "@/lib/leads/website-audit"
import {
  mergeWebsitePagespeed,
  psiKindToStrategy,
  websitePsiJobsActive,
} from "@/lib/leads/website-pagespeed"
import { fetchPagespeedStrategy } from "@/lib/pagespeed/client"
import {
  pollWebsiteJobsSchema,
  readPollWebsiteJobsFields,
} from "@/lib/validations/lead-website"
import { createClient } from "@/lib/supabase/server"
import {
  claimWebsitePagespeedJob,
  completeWebsitePagespeedJob,
  denyWebsiteEdit,
  loadWebsiteAuditRow,
  loadWebsiteReviewForChannel,
  WEBSITE_SELECT,
} from "./website-access"

export type PollLeadWebsiteJobsState =
  | { status: "success"; audit: LeadWebsiteAudit }
  | { status: "error"; message: string }

const POLL_FAILED = "Não foi possível obter o PageSpeed. Tente novamente."

async function reloadAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  auditId: string,
): Promise<LeadWebsiteAudit | null> {
  const { data, error } = await supabase
    .from("lead_website_audits")
    .select(WEBSITE_SELECT)
    .eq("id", auditId)
    .single()
  if (error || !data) return null
  const row = data as Record<string, unknown>
  // Sem hidratar, cada poll do PageSpeed devolveria a revisao vazia e a
  // interface perderia o que o analista ja tinha respondido.
  const review =
    typeof row.channel_id === "string"
      ? await loadWebsiteReviewForChannel(supabase, row.channel_id)
      : undefined
  return readLeadWebsiteAuditRow(row, review)
}

export async function pollLeadWebsiteJobs(
  formData: FormData,
): Promise<PollLeadWebsiteJobsState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = pollWebsiteJobsSchema.safeParse(
    readPollWebsiteJobsFields(formData),
  )
  if (!parsed.success) {
    return { status: "error", message: "Auditoria inválida." }
  }

  const supabase = await createClient()
  const loaded = await loadWebsiteAuditRow(supabase, parsed.data.audit_id)
  if (loaded.status === "error") {
    return { status: "error", message: POLL_FAILED }
  }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Auditoria não encontrada." }
  }

  const denied = denyWebsiteEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  const claimed = await claimWebsitePagespeedJob(
    supabase,
    parsed.data.audit_id,
  )
  if (claimed.status === "error") {
    return { status: "error", message: POLL_FAILED }
  }
  if (claimed.status === "empty") {
    const audit = await reloadAudit(supabase, parsed.data.audit_id)
    if (!audit) return { status: "error", message: POLL_FAILED }
    return { status: "success", audit }
  }

  const psiUrl = loaded.audit.pagespeed?.url ?? loaded.audit.crawl.finalUrl
  const fetched = await fetchPagespeedStrategy(
    psiUrl,
    psiKindToStrategy(claimed.job.kind),
  )

  if (fetched.status === "error") {
    const failed = await completeWebsitePagespeedJob(supabase, claimed.job.id, {
      status: "failed",
      error_message: fetched.message,
    })
    if (!failed) return { status: "error", message: POLL_FAILED }
    const stamped = await stampPagespeedIfIdle(supabase, parsed.data.audit_id)
    if (!stamped) return { status: "error", message: POLL_FAILED }
    const audit = await reloadAudit(supabase, parsed.data.audit_id)
    if (!audit) return { status: "error", message: POLL_FAILED }
    return { status: "success", audit }
  }

  const latest = await reloadAudit(supabase, parsed.data.audit_id)
  if (!latest) return { status: "error", message: POLL_FAILED }
  const snapshot = mergeWebsitePagespeed(
    latest.pagespeed,
    psiUrl,
    psiKindToStrategy(claimed.job.kind),
    fetched.strategy,
  )
  const { error: updateError } = await supabase
    .from("lead_website_audits")
    .update({ pagespeed: snapshot })
    .eq("id", parsed.data.audit_id)
  if (updateError) return { status: "error", message: POLL_FAILED }

  const ready = await completeWebsitePagespeedJob(supabase, claimed.job.id, {
    status: "ready",
    error_message: null,
  })
  if (!ready) return { status: "error", message: POLL_FAILED }

  const stamped = await stampPagespeedIfIdle(supabase, parsed.data.audit_id)
  if (!stamped) return { status: "error", message: POLL_FAILED }

  const audit = await reloadAudit(supabase, parsed.data.audit_id)
  if (!audit) return { status: "error", message: POLL_FAILED }
  return { status: "success", audit }
}

async function stampPagespeedIfIdle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  auditId: string,
): Promise<boolean> {
  const audit = await reloadAudit(supabase, auditId)
  if (!audit) return false
  if (websitePsiJobsActive(audit.jobs)) return true
  if (!audit.pagespeed?.mobile && !audit.pagespeed?.desktop) return true
  if (audit.pagespeed_at) return true
  const { error } = await supabase
    .from("lead_website_audits")
    .update({ pagespeed_at: new Date().toISOString() })
    .eq("id", auditId)
  return !error
}
