"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { fetchRankedKeywordsLive } from "@/lib/dataforseo/ranked-keywords"
import { resolveGbpDataProvider } from "@/lib/gbp-vendor/resolve"
import { readLeadDigitalChannels } from "@/lib/leads/digital-channels"
import { readLeadGbpProfiles } from "@/lib/leads/gbp"
import { resolveLeadLocation } from "@/lib/leads/resolve-location"
import {
  readLeadVisibilityAuditRow,
  type LeadVisibilityAudit,
} from "@/lib/leads/visibility-audit"
import { fetchSerpApiOrganicVisibility } from "@/lib/serpapi/google-organic-rank"
import {
  analyzeVisibilitySchema,
  readAnalyzeVisibilityFields,
} from "@/lib/validations/lead-visibility"
import { createClient } from "@/lib/supabase/server"
import { GBP_SELECT } from "./gbp-access"
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

  const vendor = await resolveGbpDataProvider()
  if (vendor.status === "error") {
    return { status: "error", message: vendor.message }
  }

  const collectedAt = new Date().toISOString()
  let snapshot

  if (vendor.provider === "dataforseo") {
    const fetched = await fetchRankedKeywordsLive({
      domain: websiteDomain,
      collectedAt,
    })
    if (fetched.status === "error") {
      return { status: "error", message: fetched.message }
    }
    snapshot = fetched.snapshot
  } else {
    const { data: gbpRows, error: gbpError } = await supabase
      .from("lead_gbp_profiles")
      .select(GBP_SELECT)
      .eq("lead_id", parsed.data.lead_id)
      .order("sort_order", { ascending: true })

    if (gbpError) {
      return { status: "error", message: ANALYZE_FAILED }
    }

    const profiles = readLeadGbpProfiles(gbpRows)
    const primary =
      profiles.find((item) => item.is_primary) ?? profiles[0] ?? null
    const location = resolveLeadLocation(
      {
        city: loaded.lead.city,
        state_code: loaded.lead.state_code,
        segment: loaded.lead.segment,
      },
      primary
        ? { formattedAddress: primary.payload.formattedAddress ?? null }
        : null,
    )
    const category =
      primary?.enrichment?.category ??
      primary?.payload.primaryTypeDisplayName ??
      location.segmentName ??
      null

    const fetched = await fetchSerpApiOrganicVisibility({
      domain: websiteDomain,
      collectedAt,
      seedInput: {
        companyName: loaded.lead.company_name,
        domain: websiteDomain,
        displayName: primary?.payload.displayName ?? null,
        category,
        city: location.city,
        rankKeywords: primary?.rank_keywords ?? [],
      },
    })
    if (fetched.status === "error") {
      return { status: "error", message: fetched.message }
    }
    snapshot = fetched.snapshot
  }

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
