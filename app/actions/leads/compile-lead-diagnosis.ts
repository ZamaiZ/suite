"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { todayCivilDate } from "@/lib/date-time"
import {
  compileDiagnosisDocument,
} from "@/lib/leads/diagnosis-compile"
import { diagnosisFactsFingerprint } from "@/lib/leads/diagnosis-document"
import {
  emptyDigitalPresenceReview,
} from "@/lib/leads/digital-presence-review"
import { readLeadDigitalChannels } from "@/lib/leads/digital-channels"
import {
  digitalPresenceReviewForChannels,
  isDigitalPresenceComplete,
  readLeadDigitalPresenceAuditRow,
} from "@/lib/leads/digital-presence"
import { readLeadGbpProfiles } from "@/lib/leads/gbp"
import { readLeadVisibilityAuditRow } from "@/lib/leads/visibility-audit"
import { readLeadWebsiteAudits } from "@/lib/leads/website-audit"
import {
  diagnosisLeadIdSchema,
  readDiagnosisLeadIdFields,
} from "@/lib/validations/lead-diagnosis"
import { createClient } from "@/lib/supabase/server"
import { GBP_SELECT } from "./gbp-access"
import {
  denyDiagnosisEdit,
  DIAGNOSIS_DRAFT_SELECT,
  loadDiagnosisDraftByLead,
} from "./diagnosis-access"
import { DIGITAL_PRESENCE_SELECT } from "./digital-presence-access"
import { VISIBILITY_SELECT } from "./visibility-access"
import { WEBSITE_SELECT } from "./website-access"
import {
  readLeadDiagnosisDraftRow,
} from "@/lib/leads/diagnosis-read"
import type { LeadDiagnosisDraft } from "@/lib/leads/diagnosis-document"

export type CompileLeadDiagnosisState =
  | { status: "success"; draft: LeadDiagnosisDraft }
  | { status: "error"; message: string }

const FAILED = "Não foi possível montar o diagnóstico. Tente novamente."
const INCOMPLETE =
  "Conclua Perfil no Google, Website, Presença digital e Visibilidade antes do diagnóstico."

export async function compileLeadDiagnosis(
  formData: FormData,
): Promise<CompileLeadDiagnosisState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = diagnosisLeadIdSchema.safeParse(
    readDiagnosisLeadIdFields(formData),
  )
  if (!parsed.success) {
    return { status: "error", message: "Lead inválido." }
  }

  const supabase = await createClient()
  const loaded = await loadDiagnosisDraftByLead(
    supabase,
    parsed.data.lead_id,
  )
  if (loaded.status === "error") {
    return { status: "error", message: FAILED }
  }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Lead não encontrado." }
  }

  const denied = denyDiagnosisEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  const leadId = parsed.data.lead_id
  const [
    { data: channelRows, error: channelError },
    { data: gbpRows, error: gbpError },
    { data: websiteRows, error: websiteError },
    { data: presenceRow, error: presenceError },
    { data: visibilityRow, error: visibilityError },
  ] = await Promise.all([
    supabase
      .from("lead_digital_channels")
      .select("id, type, value, normalized_key, is_primary, sort_order")
      .eq("lead_id", leadId),
    supabase
      .from("lead_gbp_profiles")
      .select(GBP_SELECT)
      .eq("lead_id", leadId)
      .order("sort_order", { ascending: true }),
    supabase.from("lead_website_audits").select(WEBSITE_SELECT).eq("lead_id", leadId),
    supabase
      .from("lead_digital_presence_audits")
      .select(DIGITAL_PRESENCE_SELECT)
      .eq("lead_id", leadId)
      .maybeSingle(),
    supabase
      .from("lead_visibility_audits")
      .select(VISIBILITY_SELECT)
      .eq("lead_id", leadId)
      .maybeSingle(),
  ])

  if (
    channelError ||
    gbpError ||
    websiteError ||
    presenceError ||
    visibilityError
  ) {
    return { status: "error", message: FAILED }
  }

  const channels = readLeadDigitalChannels(channelRows)
  const gbpProfiles = readLeadGbpProfiles(gbpRows)
  const gbpProfile =
    gbpProfiles.find((item) => item.is_primary) ?? gbpProfiles[0] ?? null
  const websiteAudits = readLeadWebsiteAudits(websiteRows)
  const primaryWebsite =
    channels
      .filter((channel) => channel.type === "website" && channel.id)
      .sort((left, right) => {
        if (left.is_primary !== right.is_primary) {
          return left.is_primary ? -1 : 1
        }
        return left.sort_order - right.sort_order
      })[0] ?? null
  const websiteAudit =
    websiteAudits.find((item) => item.channel_id === primaryWebsite?.id) ??
    websiteAudits[0] ??
    null
  const presenceAudit = presenceRow
    ? readLeadDigitalPresenceAuditRow(presenceRow as Record<string, unknown>)
    : null
  const presenceReview = digitalPresenceReviewForChannels(
    presenceAudit?.review ?? emptyDigitalPresenceReview(),
    channels,
  )
  const visibilityAudit = visibilityRow
    ? readLeadVisibilityAuditRow(visibilityRow as Record<string, unknown>)
    : null

  const domain =
    primaryWebsite?.normalized_key ??
    channels.find((channel) => channel.type === "website")?.normalized_key ??
    ""

  if (
    !gbpProfile?.enrichment_at ||
    !websiteAudit ||
    !isDigitalPresenceComplete(presenceReview, channels) ||
    !visibilityAudit
  ) {
    return { status: "error", message: INCOMPLETE }
  }

  if (!domain) {
    return {
      status: "error",
      message: "Cadastre um site no lead para gerar o diagnóstico.",
    }
  }

  const generatedAt = new Date().toISOString()
  const document = compileDiagnosisDocument({
    companyName: loaded.lead.company_name,
    domain,
    channels,
    gbpProfile,
    websiteAudit,
    presenceReview,
    presenceToday: todayCivilDate(),
    visibilityAudit,
    generatedAt,
    previousProse: loaded.draft?.document.prose ?? null,
  })

  const facts_fingerprint = diagnosisFactsFingerprint({
    gbpFetchedAt: gbpProfile.fetched_at,
    gbpEnrichmentAt: gbpProfile.enrichment_at,
    websiteFetchedAt: websiteAudit.fetched_at,
    websitePagespeedAt: websiteAudit.pagespeed_at,
    presenceUpdatedAt: presenceAudit?.updated_at ?? null,
    visibilityFetchedAt: visibilityAudit.fetched_at,
  })

  const { data: upserted, error: upsertError } = await supabase
    .from("lead_diagnosis_drafts")
    .upsert(
      {
        lead_id: leadId,
        document,
        facts_fingerprint,
        updated_at: generatedAt,
        updated_by: user.id,
      },
      { onConflict: "lead_id" },
    )
    .select(DIAGNOSIS_DRAFT_SELECT)
    .single()

  if (upsertError || !upserted) {
    return { status: "error", message: FAILED }
  }

  const draft = readLeadDiagnosisDraftRow(upserted as Record<string, unknown>)
  if (!draft) return { status: "error", message: FAILED }
  return { status: "success", draft }
}
