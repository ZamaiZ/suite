import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { ProspectFilters } from "@/lib/prospect/campaign-input"
import type { CampaignStatus } from "@/lib/prospect/types"

/**
 * Selects e leituras compartilhadas da prospecção.
 *
 * Mesmo desenho dos `*-access.ts` das etapas de auditoria: uma constante com a
 * lista de colunas, reusada por todas as actions do domínio, para que
 * acrescentar coluna seja uma edição só.
 *
 * O escopo de carteira (`leadPortfolioScope`) **não** se aplica aqui: prospect
 * não tem dono até virar lead. Quem promove é que assume — e a promoção grava
 * o lead com `assigned_sdr_id` nulo, como o cadastro manual já faz.
 */

export const CAMPAIGN_SELECT = [
  "id",
  "name",
  "segment_id",
  "categories",
  "source",
  "state_code",
  "city",
  "center_lat",
  "center_lng",
  "radius_km",
  "filters",
  "target_count",
  "estimate",
  "discovery_offset",
  "discovery_token",
  "discovered_count",
  "universe_count",
  "status",
  "discovery_cost_usd",
  "enrichment_cost_usd",
  "polling_at",
  "attempts",
  "error_message",
  "started_at",
  "finished_at",
  "created_at",
].join(", ")

export const PROSPECT_SELECT = [
  "id",
  "campaign_id",
  "place_id",
  "cid",
  "title",
  "category",
  "phone_raw",
  "phone_e164",
  "domain",
  "url",
  "address",
  "zip",
  "street_number",
  "city",
  "region",
  "latitude",
  "longitude",
  "rating",
  "votes_count",
  "is_claimed",
  "listing_updated_at",
  "stage",
  "promoted_lead_id",
  "dismissed_reason",
].join(", ")

export type CampaignRow = {
  id: string
  name: string
  segment_id: string | null
  categories: string[]
  source: string
  state_code: string
  city: string
  center_lat: number
  center_lng: number
  radius_km: number
  filters: ProspectFilters | null
  target_count: number
  estimate: unknown
  discovery_offset: number
  discovery_token: string | null
  discovered_count: number
  universe_count: number | null
  status: CampaignStatus
  discovery_cost_usd: number
  enrichment_cost_usd: number
  polling_at: string | null
  attempts: number
  error_message: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export const CAMPAIGN_NOT_FOUND = "Campanha não encontrada."
export const CAMPAIGN_WRITE_ERROR =
  "Não foi possível salvar a campanha. Tente novamente."

export async function loadCampaign(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<CampaignRow | null> {
  const { data, error } = await supabase
    .from("prospect_campaigns")
    .select(CAMPAIGN_SELECT)
    .eq("id", campaignId)
    .maybeSingle()
  if (error || !data) return null
  return data as unknown as CampaignRow
}

/**
 * O universo já descoberto desta campanha, para o dedupe da próxima página.
 *
 * Lido como conjunto e não conferido linha a linha: a constraint do banco
 * rejeitaria o lote inteiro por causa de uma repetida, e perder 99 empresas
 * pagas por causa de 1 duplicata é o tipo de desperdício que o repositório já
 * aprendeu a não fazer.
 */
export async function knownPlaceIds(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("prospects")
    .select("place_id")
    .eq("campaign_id", campaignId)
    .not("place_id", "is", null)
  const saida = new Set<string>()
  for (const row of data ?? []) {
    const id = (row as { place_id: string | null }).place_id
    if (id) saida.add(id)
  }
  return saida
}

/**
 * As chaves que o descadastro bloqueia.
 *
 * Consultado na descoberta, antes de gravar, e de novo na promoção. Honrar um
 * opt-out significa bloquear na origem — guardar o pedido e continuar
 * descobrindo a mesma empresa a cada campanha é o mesmo que não ter registro
 * nenhum.
 */
export async function loadOptOuts(supabase: SupabaseClient): Promise<{
  phones: Set<string>
  domains: Set<string>
  placeIds: Set<string>
  taxIds: Set<string>
  emails: Set<string>
}> {
  const { data } = await supabase
    .from("prospect_optouts")
    .select("kind, value_key")

  const phones = new Set<string>()
  const domains = new Set<string>()
  const placeIds = new Set<string>()
  const taxIds = new Set<string>()
  const emails = new Set<string>()

  for (const row of data ?? []) {
    const { kind, value_key } = row as { kind: string; value_key: string }
    if (kind === "phone") phones.add(value_key)
    else if (kind === "domain") domains.add(value_key)
    else if (kind === "place_id") placeIds.add(value_key)
    else if (kind === "tax_id") taxIds.add(value_key)
    else if (kind === "email") emails.add(value_key)
  }
  return { phones, domains, placeIds, taxIds, emails }
}
