"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { todayCivilDate } from "@/lib/date-time"
import { compileDiagnosisDocument } from "@/lib/leads/diagnosis-compile"
import { diagnosisFactsFingerprint } from "@/lib/leads/diagnosis-document"
import { emptyDigitalPresenceReview } from "@/lib/leads/digital-presence-review"
import { readLeadDigitalChannels } from "@/lib/leads/digital-channels"
import {
  digitalPresenceReviewForChannels,
  isDigitalPresenceComplete,
  readLeadDigitalPresenceAuditRow,
} from "@/lib/leads/digital-presence"
import { readLeadGbpProfiles } from "@/lib/leads/gbp"
import { readLeadVisibilityAuditRow } from "@/lib/leads/visibility-audit"
import { readLeadVisibilityReviewRow } from "@/lib/leads/visibility-review"
import { readLeadBacklinkAuditRow } from "@/lib/leads/backlinks-audit"
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
import { GEO_REVIEW_SELECT, GEO_SELECT } from "./geo-access"
import { readLeadGeoAuditRow } from "@/lib/leads/geo-audit"
import { readLeadGeoReviewRow } from "@/lib/leads/geo-review"
import { BACKLINKS_SELECT } from "./backlinks-access"
import { loadWebsiteReviewsForLead, WEBSITE_SELECT } from "./website-access"
import { readLeadDiagnosisDraftRow } from "@/lib/leads/diagnosis-read"
import type { LeadDiagnosisDraft } from "@/lib/leads/diagnosis-document"

export type CompileLeadDiagnosisState =
  | { status: "success"; draft: LeadDiagnosisDraft }
  | { status: "error"; message: string }

const FAILED = "Não foi possível montar o diagnóstico. Tente novamente."
// As CINCO etapas do gate, e `!geoAudit` é uma delas desde que a Presença em
// IA passou a destravar o diagnóstico. Omitir a quinta faz quem só deve ela
// ler quatro etapas já concluídas e não descobrir o que falta.
const INCOMPLETE =
  "Conclua Perfil no Google, Website, Presença digital, Visibilidade e Presença em IA antes do diagnóstico."

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
  const loaded = await loadDiagnosisDraftByLead(supabase, parsed.data.lead_id)
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
    { data: geoRow, error: geoError },
    { data: backlinkRow, error: backlinkError },
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
    supabase
      .from("lead_website_audits")
      .select(WEBSITE_SELECT)
      .eq("lead_id", leadId),
    supabase
      .from("lead_digital_presence_audits")
      .select(DIGITAL_PRESENCE_SELECT)
      .eq("lead_id", leadId)
      .maybeSingle(),
    // Append-only desde a migration 20260917: sem `order`/`limit` a consulta
    // devolve varias linhas e o `maybeSingle` falha na segunda analise do lead.
    supabase
      .from("lead_visibility_audits")
      .select(VISIBILITY_SELECT)
      .eq("lead_id", leadId)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Append-only desde o dia 1: mesma guarda de `order`/`limit`.
    supabase
      .from("lead_geo_audits")
      .select(GEO_SELECT)
      .eq("lead_id", leadId)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("lead_backlink_audits")
      .select(BACKLINKS_SELECT)
      .eq("lead_id", leadId)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (
    channelError ||
    gbpError ||
    websiteError ||
    presenceError ||
    visibilityError ||
    geoError ||
    backlinkError
  ) {
    return { status: "error", message: FAILED }
  }

  const channels = readLeadDigitalChannels(channelRows)
  const gbpProfiles = readLeadGbpProfiles(gbpRows)
  const gbpProfile =
    gbpProfiles.find((item) => item.is_primary) ?? gbpProfiles[0] ?? null
  // A revisao do analista entra no diagnostico como oportunidade, entao o
  // snapshot precisa ser hidratado com ela antes de compilar.
  const websiteReviews = await loadWebsiteReviewsForLead(supabase, leadId)
  const websiteAudits = readLeadWebsiteAudits(websiteRows, websiteReviews)
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
  // Mesmo motivo do website: o julgamento do analista entra como oportunidade,
  // então precisa estar em mãos antes de compilar. Linha ausente lê como review
  // vazio — lead nunca julgado não gera gap nenhum.
  const { data: visibilityReviewRow } = await supabase
    .from("lead_visibility_reviews")
    .select("review, notes, updated_at, updated_by")
    .eq("lead_id", leadId)
    .maybeSingle()
  const visibilityReview = readLeadVisibilityReviewRow(
    (visibilityReviewRow as Record<string, unknown> | null) ?? null,
  )
  const geoAudit = geoRow
    ? readLeadGeoAuditRow(geoRow as Record<string, unknown>)
    : null
  // Mesmo desenho da visibilidade: o julgamento do analista vira oportunidade,
  // então entra antes de compilar. Linha ausente lê como review vazio.
  const { data: geoReviewRow } = await supabase
    .from("lead_geo_reviews")
    .select(GEO_REVIEW_SELECT)
    .eq("lead_id", leadId)
    .maybeSingle()
  const geoReview = readLeadGeoReviewRow(
    (geoReviewRow as Record<string, unknown> | null) ?? null,
  )
  // Backlinks é opcional no gate: ele não bloqueia o diagnóstico, entra como
  // mais uma fonte de oportunidade do pilar de Website quando existir.
  const backlinkAudit = backlinkRow
    ? readLeadBacklinkAuditRow(backlinkRow as Record<string, unknown>)
    : null

  const domain =
    primaryWebsite?.normalized_key ??
    channels.find((channel) => channel.type === "website")?.normalized_key ??
    ""

  if (
    !gbpProfile?.enrichment_at ||
    !websiteAudit ||
    !isDigitalPresenceComplete(presenceReview, channels) ||
    !visibilityAudit ||
    // Presença em IA destrava como as outras quatro. A sondagem em LLM não
    // entra no gate: ela enriquece a etapa, não a define.
    !geoAudit
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
    visibilityReview: visibilityReview.review,
    geoAudit,
    geoReview: geoReview.review,
    backlinkSnapshot: backlinkAudit?.snapshot ?? null,
    generatedAt,
    previousProse: loaded.draft?.document.prose ?? null,
    previousSeed: loaded.draft?.document.proseSeed ?? null,
    leadCity: loaded.lead.city,
    leadStateCode: loaded.lead.state_code,
    segmentName: loaded.lead.segment?.name ?? null,
  })

  const facts_fingerprint = diagnosisFactsFingerprint({
    gbpFetchedAt: gbpProfile.fetched_at,
    gbpEnrichmentAt: gbpProfile.enrichment_at,
    websiteFetchedAt: websiteAudit.fetched_at,
    websitePagespeedAt: websiteAudit.pagespeed_at,
    presenceUpdatedAt: presenceAudit?.updated_at ?? null,
    visibilityFetchedAt: visibilityAudit.fetched_at,
    backlinksFetchedAt: backlinkAudit?.fetched_at ?? null,
    geoFetchedAt: geoAudit.fetched_at,
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
