"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { fetchBacklinkSummaryLive } from "@/lib/dataforseo/backlinks"
import {
  DATAFORSEO_NOT_CONFIGURED,
  isDataForSeoConfigured,
} from "@/lib/dataforseo/configured"
import { readLeadDigitalChannels } from "@/lib/leads/digital-channels"
import {
  readLeadBacklinkAuditRow,
  type LeadBacklinkAudit,
} from "@/lib/leads/backlinks-audit"
import {
  analyzeBacklinksSchema,
  readAnalyzeBacklinksFields,
} from "@/lib/validations/lead-backlinks"
import { createClient } from "@/lib/supabase/server"
import {
  BACKLINKS_SELECT,
  denyBacklinksEdit,
  loadBacklinkAuditByLead,
} from "./backlinks-access"

export type AnalyzeLeadBacklinksState =
  | { status: "success"; audit: LeadBacklinkAudit }
  | { status: "error"; message: string }

const ANALYZE_FAILED =
  "Não foi possível analisar os backlinks. Tente novamente."
const NO_WEBSITE = "Cadastre um site no lead para analisar os backlinks."

export async function analyzeLeadBacklinks(
  formData: FormData,
): Promise<AnalyzeLeadBacklinksState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = analyzeBacklinksSchema.safeParse(
    readAnalyzeBacklinksFields(formData),
  )
  if (!parsed.success) {
    return { status: "error", message: "Lead inválido." }
  }

  const supabase = await createClient()
  const loaded = await loadBacklinkAuditByLead(supabase, parsed.data.lead_id)
  if (loaded.status === "error") {
    return { status: "error", message: ANALYZE_FAILED }
  }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Lead não encontrado." }
  }

  const denied = denyBacklinksEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  const { data: channelRows, error: channelError } = await supabase
    .from("lead_digital_channels")
    .select("id, type, value, normalized_key, is_primary, sort_order")
    .eq("lead_id", parsed.data.lead_id)

  if (channelError) {
    return { status: "error", message: ANALYZE_FAILED }
  }

  const websiteDomain =
    readLeadDigitalChannels(channelRows)
      .filter((channel) => channel.type === "website")
      .sort((left, right) => {
        if (left.is_primary !== right.is_primary) {
          return left.is_primary ? -1 : 1
        }
        return left.sort_order - right.sort_order
      })[0]?.normalized_key ?? null

  if (!websiteDomain) {
    return { status: "error", message: NO_WEBSITE }
  }

  if (!isDataForSeoConfigured()) {
    return { status: "error", message: DATAFORSEO_NOT_CONFIGURED }
  }

  const collectedAt = new Date().toISOString()
  const fetched = await fetchBacklinkSummaryLive({
    domain: websiteDomain,
    collectedAt,
  })
  if (fetched.status === "error") {
    return { status: "error", message: fetched.message }
  }

  const payload = {
    lead_id: parsed.data.lead_id,
    domain: websiteDomain,
    snapshot: fetched.snapshot,
    fetched_at: collectedAt,
    fetched_by: user.id,
  }

  // Append-only: cada analise cria um snapshot novo e preserva os anteriores.
  const { data, error } = await supabase
    .from("lead_backlink_audits")
    .insert(payload)
    .select(BACKLINKS_SELECT)
    .single()

  if (error || !data) {
    return { status: "error", message: ANALYZE_FAILED }
  }
  const audit = readLeadBacklinkAuditRow(data as Record<string, unknown>)
  if (!audit) return { status: "error", message: ANALYZE_FAILED }
  return { status: "success", audit }
}
