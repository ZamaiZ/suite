"use server"

import { hydrateStructuredAddress } from "@/lib/briefing/address"
import { parseCompanyPayload } from "@/lib/briefing/company"
import { companyFormattedAddress } from "@/lib/briefing/address-fingerprint"
import { resolveAudienceMapCoordinates } from "@/lib/briefing/geocode-address"
import { BRIEFING_STEP_COMPANY } from "@/lib/briefing/steps"
import { requireBriefingWriter } from "@/lib/briefing/writer"
import { readGbpSnapshot } from "@/lib/leads/gbp"

export type GeocodeBriefingAddressState =
  | {
      status: "success"
      latitude: number
      longitude: number
      addressKey: string
      formattedAddress: string
      source: "gbp" | "geocode"
    }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

export async function geocodeBriefingAddress(
  clientId?: string,
): Promise<GeocodeBriefingAddressState> {
  const loaded = await requireBriefingWriter(clientId)
  if (loaded.status !== "ok") return loaded

  const { client, admin } = loaded.context

  const [companyResult, gbpResult] = await Promise.all([
    admin
      .from("client_briefing_steps")
      .select("payload")
      .eq("client_id", client.id)
      .eq("step", BRIEFING_STEP_COMPANY)
      .maybeSingle(),
    admin
      .from("lead_gbp_profiles")
      .select("payload")
      .eq("lead_id", client.lead_id)
      .eq("is_primary", true)
      .maybeSingle(),
  ])

  if (companyResult.error) {
    return {
      status: "error",
      message: "Não foi possível carregar o endereço da empresa.",
    }
  }

  if (!companyResult.data) {
    return {
      status: "error",
      message: "Complete a etapa da empresa antes de definir o raio.",
    }
  }

  const company = hydrateStructuredAddress(
    parseCompanyPayload(companyResult.data.payload),
  )
  const gbp = readGbpSnapshot(gbpResult.data?.payload)
  const resolved = await resolveAudienceMapCoordinates({ company, gbp })

  if (resolved.status === "error") {
    return { status: "error", message: resolved.message }
  }

  return {
    status: "success",
    latitude: resolved.data.latitude,
    longitude: resolved.data.longitude,
    addressKey: resolved.data.addressKey,
    formattedAddress: companyFormattedAddress(company),
    source: resolved.data.source,
  }
}
