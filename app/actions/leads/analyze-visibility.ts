"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { fetchRankedKeywordsLive } from "@/lib/dataforseo/ranked-keywords"
import {
  DATAFORSEO_NOT_CONFIGURED,
  isDataForSeoConfigured,
} from "@/lib/dataforseo/configured"
import { readLeadDigitalChannels } from "@/lib/leads/digital-channels"
import {
  readLeadVisibilityAuditRow,
  type LeadVisibilityAudit,
} from "@/lib/leads/visibility-audit"
import {
  analyzeVisibilitySchema,
  readAnalyzeVisibilityFields,
} from "@/lib/validations/lead-visibility"
import { createClient } from "@/lib/supabase/server"
import {
  denyVisibilityEdit,
  loadVisibilityAuditByLead,
  VISIBILITY_SELECT,
} from "./visibility-access"

export type AnalyzeLeadVisibilityState =
  | { status: "success"; audit: LeadVisibilityAudit }
  | { status: "error"; message: string }

const ANALYZE_FAILED = "Não foi possível analisar a visibilidade. Tente novamente."
const NO_WEBSITE = "Cadastre um site no lead para analisar a visibilidade."

export async function analyzeLeadVisibility(
  formData: FormData,
): Promise<AnalyzeLeadVisibilityState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = analyzeVisibilitySchema.safeParse(
    readAnalyzeVisibilityFields(formData),
  )
  if (!parsed.success) {
    return { status: "error", message: "Lead inválido." }
  }

  const supabase = await createClient()
  const loaded = await loadVisibilityAuditByLead(
    supabase,
    parsed.data.lead_id,
  )
  if (loaded.status === "error") {
    return { status: "error", message: ANALYZE_FAILED }
  }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Lead não encontrado." }
  }

  const denied = denyVisibilityEdit(loaded.lead, user.id, roles)
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
  const fetched = await fetchRankedKeywordsLive({
    domain: websiteDomain,
    collectedAt,
  })
  if (fetched.status === "error") {
    return { status: "error", message: fetched.message }
  }
  const snapshot = fetched.snapshot

  const payload = {
    lead_id: parsed.data.lead_id,
    domain: websiteDomain,
    snapshot,
    fetched_at: collectedAt,
    fetched_by: user.id,
  }

  // Append-only: cada analise cria um snapshot novo e preserva os anteriores.
  const { data, error } = await supabase
    .from("lead_visibility_audits")
    .insert(payload)
    .select(VISIBILITY_SELECT)
    .single()

  if (error || !data) {
    return { status: "error", message: ANALYZE_FAILED }
  }
  const audit = readLeadVisibilityAuditRow(data as Record<string, unknown>)
  if (!audit) return { status: "error", message: ANALYZE_FAILED }
  return { status: "success", audit }
}
