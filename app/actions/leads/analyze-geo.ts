"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { fetchAiDemandLive } from "@/lib/dataforseo/ai-optimization"
import { AI_KEYWORD_VOLUME_LIMIT, GEO_QUERY } from "@/lib/dataforseo/limits"
import { mapAiDemand } from "@/lib/leads/geo-demand"
import {
  geoAccessibilityFromCrawl,
  isExtendedCrawl,
} from "@/lib/leads/geo-accessibility"
import { geoContentFromCrawl } from "@/lib/leads/geo-content"
import {
  readLeadGeoAuditRow,
  type GeoSnapshot,
  type LeadGeoAudit,
} from "@/lib/leads/geo-audit"
import { readWebsiteCrawl } from "@/lib/leads/website-audit"
import { readLeadVisibilityAuditRow } from "@/lib/leads/visibility-audit"
import { readLeadDigitalChannels } from "@/lib/leads/digital-channels"
import { analyzeGeoSchema, readAnalyzeGeoFields } from "@/lib/validations/lead-geo"
import { denyGeoEdit, GEO_SELECT, loadGeoAuditByLead } from "./geo-access"

export type AnalyzeLeadGeoState =
  | { status: "success"; audit: LeadGeoAudit }
  | { status: "error"; message: string }

const FAILED = "Não foi possível analisar a presença em IA. Tente novamente."
const NO_WEBSITE = "Cadastre um site no lead para analisar a presença em IA."
const NO_CRAWL =
  "Rode a análise de Website antes: a presença em IA lê aquela coleta."

/**
 * Uma chamada paga, de US$ 0,021.
 *
 * A etapa reprojeta coletas que já existem sob o vocabulário de GEO. Por isso
 * `sources` guarda a data de cada origem — carimbar a hora do clique como se
 * fosse a hora da medida foi o defeito que a onda 0 da visibilidade encontrou,
 * onde o índice tinha mediana de 59 dias.
 *
 * **A única coleta nova aqui é a demanda em IA**, e ela entra na base porque é
 * mais barata que o `ranked_keywords` que produziu as keywords dela
 * (0,021 contra 0,0252). Citações e sondagem não entram: custam 0,10 e 0,65, e
 * são botões pagos próprios.
 *
 * **Falhar na demanda não derruba a análise.** `aiDemand` degrada para `null`,
 * que é "não coletado" — o mesmo desenho do benchmark de backlinks, onde o
 * resumo é a entrega principal e o extra some sem levar o resto junto.
 */
export async function analyzeLeadGeo(
  formData: FormData,
): Promise<AnalyzeLeadGeoState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = analyzeGeoSchema.safeParse(readAnalyzeGeoFields(formData))
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? FAILED,
    }
  }

  const supabase = await createClient()
  const loaded = await loadGeoAuditByLead(supabase, parsed.data.lead_id)
  if (loaded.status === "error") return { status: "error", message: FAILED }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Lead não encontrado." }
  }

  const denied = denyGeoEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  const { data: channelRows, error: channelError } = await supabase
    .from("lead_digital_channels")
    .select("id, type, value, normalized_key, is_primary, sort_order")
    .eq("lead_id", parsed.data.lead_id)
  if (channelError) return { status: "error", message: FAILED }

  const website = readLeadDigitalChannels(channelRows)
    .filter((channel) => channel.type === "website")
    .sort((left, right) => {
      if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1
      return left.sort_order - right.sort_order
    })[0]
  if (!website) return { status: "error", message: NO_WEBSITE }

  const [websiteRow, visibilityRow, backlinkRow] = await Promise.all([
    // As colunas sao `url` e `crawl`: `lead_website_audits` nao tem `domain`
    // nem `snapshot`. Conferido contra a migration 20260826000000.
    supabase
      .from("lead_website_audits")
      .select("id, lead_id, channel_id, url, crawl, fetched_at")
      .eq("channel_id", website.id)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("lead_visibility_audits")
      .select("id, lead_id, domain, snapshot, fetched_at, fetched_by")
      .eq("lead_id", parsed.data.lead_id)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("lead_backlink_audits")
      .select("id, fetched_at")
      .eq("lead_id", parsed.data.lead_id)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const websiteFetchedAt =
    typeof websiteRow.data?.fetched_at === "string"
      ? websiteRow.data.fetched_at
      : null
  const crawl = readWebsiteCrawl(websiteRow.data?.crawl)
  if (!crawl || !websiteFetchedAt) {
    return { status: "error", message: NO_CRAWL }
  }

  const visibilityAudit = visibilityRow.data
    ? readLeadVisibilityAuditRow(visibilityRow.data as Record<string, unknown>)
    : null

  // A demanda em IA é a única chamada paga da coleta base. As keywords vêm do
  // snapshot de visibilidade que já está gravado — pagar `ranked_keywords` de
  // novo só para alimentar esta chamada custaria mais que ela.
  //
  // **Só as keywords do host canônico.** Medido em 2026-09-11 neste lead: sem o
  // filtro, uma única keyword de um site de CLIENTE hospedado no subdomínio de
  // homologação (`sanitarios`, 12.559) respondia por **94,8%** da demanda —
  // 13.254 no total contra 695 do domínio real. O número ia para a tela do lead
  // como se fosse o mercado dele.
  //
  // `isCanonicalHost` existe por causa desse mesmo subdomínio: a onda 0 da
  // visibilidade achou 77 das 110 keywords em `aprov.`. `null` é host não
  // medido em coleta antiga, e aí a keyword entra — calar sobre ela seria
  // trocar um erro por outro.
  const keywords = visibilityAudit
    ? [
        ...new Set(
          visibilityAudit.snapshot.keywords
            .filter((row) => row.url?.isCanonicalHost !== false)
            .map((row) => row.keyword)
            .filter((keyword) => keyword.length > 0),
        ),
      ].slice(0, AI_KEYWORD_VOLUME_LIMIT)
    : []
  const demand =
    keywords.length > 0 ? await fetchAiDemandLive({ keywords }) : null
  const aiDemand =
    demand?.status === "ok"
      ? mapAiDemand({
          result: demand.result,
          locationLabel: GEO_QUERY.locationName,
          languageCode: GEO_QUERY.languageCode,
        })
      : null

  const collectedAt = new Date().toISOString()
  const snapshot: GeoSnapshot = {
    version: 1,
    domain: website.normalized_key,
    collectedAt,
    // O custo real da chamada, não o da tabela. A tabela é piso: `usage.ts`
    // registra isso desde que o SERP cobrou cinco vezes o declarado.
    costUsd: demand?.status === "ok" ? (demand.cost ?? null) : null,
    sources: {
      websiteAuditAt: websiteFetchedAt,
      visibilityAuditAt: visibilityAudit?.fetched_at ?? null,
      backlinkAuditAt:
        typeof backlinkRow.data?.fetched_at === "string"
          ? backlinkRow.data.fetched_at
          : null,
      // Sem isto, lead auditado antes da coleta ampliada ganha gap falso de
      // llms.txt e de FAQ por campos que nunca foram medidos.
      websiteCrawlExtended: isExtendedCrawl(crawl),
    },
    accessibility: geoAccessibilityFromCrawl(crawl),
    content: geoContentFromCrawl(crawl),
    // Citações e concorrência são o botão pago da etapa, a US$ 0,10 a chamada.
    // `null` = não coletado; `[]` seria "coletado e vazio".
    citations: null,
    aiMentions: null,
    aiOverview: visibilityAudit
      ? {
          keywords: visibilityAudit.snapshot.keywords
            .filter((row) => row.itemType === "ai_overview_reference")
            .map((row) => ({
              keyword: row.keyword,
              url: row.url?.full ?? null,
              position: row.position.value,
              volume: row.volume.value,
              etv: row.traffic,
              // A frase que a IA citou. `null` em snapshot de visibilidade
              // anterior a 2026-09-11, que não gravava o campo.
              citedText: row.citedText,
            })),
          count: visibilityAudit.snapshot.keywords.filter(
            (row) => row.itemType === "ai_overview_reference",
          ).length,
          etv: visibilityAudit.snapshot.aiOverview?.estimatedTraffic ?? null,
          // Sem footprint organico o gap de AI Overview cala: o lead ja tem o
          // `not_ranking` da visibilidade, e acusar aqui seria a segunda
          // cobranca pela mesma causa.
          hasOrganicFootprint: visibilityAudit.snapshot.keywords.some(
            (row) => row.itemType === "organic",
          ),
        }
      : null,
    aiDemand,
    promptVisibility: null,
  }

  // Append-only: cada analise cria um snapshot novo e preserva os anteriores.
  const { data, error } = await supabase
    .from("lead_geo_audits")
    .insert({
      lead_id: parsed.data.lead_id,
      domain: website.normalized_key,
      snapshot,
      fetched_at: collectedAt,
      fetched_by: user.id,
    })
    .select(GEO_SELECT)
    .single()

  if (error || !data) return { status: "error", message: FAILED }
  const audit = readLeadGeoAuditRow(data as Record<string, unknown>)
  if (!audit) return { status: "error", message: FAILED }
  return { status: "success", audit }
}
