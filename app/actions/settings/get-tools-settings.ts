"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import type { GbpDataProvider, SerpApiQuota } from "@/lib/gbp-vendor"
import {
  isDataForSeoConfigured,
  isSerpApiConfigured,
  loadGbpDataProviderSetting,
} from "@/lib/gbp-vendor/resolve"
import { getSerpApiAccount } from "@/lib/serpapi/client"

export type ToolsSettingsState = {
  selected: GbpDataProvider | null
  dataForSeoConfigured: boolean
  serpApiConfigured: boolean
  serpApiQuota: SerpApiQuota | null
}

export async function getToolsSettings(): Promise<ToolsSettingsState> {
  await requireCommercialMember()
  const selected = await loadGbpDataProviderSetting()
  const serpApiConfigured = isSerpApiConfigured()
  let serpApiQuota: SerpApiQuota | null = null
  if (serpApiConfigured) {
    const account = await getSerpApiAccount()
    if (account.status === "ok") {
      serpApiQuota = account.data
    }
  }
  return {
    selected,
    dataForSeoConfigured: isDataForSeoConfigured(),
    serpApiConfigured,
    serpApiQuota,
  }
}
