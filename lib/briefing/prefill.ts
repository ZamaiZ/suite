import "server-only"

import { parseBrazilianAddress } from "@/lib/briefing/address"
import {
  emptyCompanyPayload,
  type BriefingCompanyPayload,
} from "@/lib/briefing/company"
import { isBrazilStateCode } from "@/lib/br-locations"
import { isDigitalChannelType } from "@/lib/leads/digital-channels"
import { readGbpSnapshot } from "@/lib/leads/gbp"
import type { createAdminClient } from "@/lib/supabase/admin"

type AdminClient = ReturnType<typeof createAdminClient>

export async function prefillCompanyFromLead(
  admin: AdminClient,
  leadId: string,
): Promise<BriefingCompanyPayload> {
  const payload = emptyCompanyPayload()

  const [leadResult, gbpResult, channelsResult] = await Promise.all([
    admin
      .from("leads")
      .select(
        "company_name, contact_name, tax_id, phone, email, city, state_code",
      )
      .eq("id", leadId)
      .maybeSingle(),
    admin
      .from("lead_gbp_profiles")
      .select("payload")
      .eq("lead_id", leadId)
      .eq("is_primary", true)
      .maybeSingle(),
    admin
      .from("lead_digital_channels")
      .select("type, value, sort_order")
      .eq("lead_id", leadId)
      .order("sort_order", { ascending: true }),
  ])

  const lead = leadResult.data
  if (lead) {
    payload.companyName =
      typeof lead.company_name === "string" ? lead.company_name : ""
    payload.contactName =
      typeof lead.contact_name === "string" ? lead.contact_name : ""
    payload.taxId = typeof lead.tax_id === "string" ? lead.tax_id : ""
    payload.phone = typeof lead.phone === "string" ? lead.phone : ""
    payload.whatsapp = payload.phone
    payload.email = typeof lead.email === "string" ? lead.email : ""
    payload.city = typeof lead.city === "string" ? lead.city : ""
    payload.stateCode =
      typeof lead.state_code === "string" && isBrazilStateCode(lead.state_code)
        ? lead.state_code
        : ""
  }

  const snapshot = readGbpSnapshot(gbpResult.data?.payload)
  if (snapshot) {
    if (snapshot.formattedAddress) {
      const parsed = parseBrazilianAddress(snapshot.formattedAddress)
      payload.formattedAddress =
        parsed.formattedAddress || snapshot.formattedAddress
      payload.street = parsed.street
      payload.number = parsed.number
      payload.complement = parsed.complement
      payload.neighborhood = parsed.neighborhood
      payload.postalCode = parsed.postalCode
      if (parsed.city) payload.city = parsed.city
      if (parsed.stateCode) payload.stateCode = parsed.stateCode
    }
    payload.hoursLines = snapshot.weekdayDescriptions
    if (!payload.phone && snapshot.nationalPhoneNumber) {
      payload.phone = snapshot.nationalPhoneNumber
      if (!payload.whatsapp) payload.whatsapp = snapshot.nationalPhoneNumber
    }
  }

  payload.channels = (channelsResult.data ?? []).flatMap((row) => {
    if (!isDigitalChannelType(row.type)) return []
    if (typeof row.value !== "string" || row.value.trim().length === 0) {
      return []
    }
    return [{ type: row.type, value: row.value }]
  })

  return payload
}
