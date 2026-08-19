import "server-only"

import { createClient } from "@/lib/supabase/server"
import {
  GBP_DATA_PROVIDER_KEY,
  GBP_VENDOR_CHOOSE,
  GBP_VENDOR_UNCONFIGURED,
  isGbpDataProvider,
  type GbpDataProvider,
  type ResolveGbpDataProviderResult,
} from "./types"

export function isDataForSeoConfigured(): boolean {
  return Boolean(
    process.env.DATAFORSEO_LOGIN?.trim() &&
      process.env.DATAFORSEO_PASSWORD?.trim(),
  )
}

export function isSerpApiConfigured(): boolean {
  return Boolean(process.env.SERPAPI_API_KEY?.trim())
}

export function isGbpProviderConfigured(provider: GbpDataProvider): boolean {
  if (provider === "dataforseo") return isDataForSeoConfigured()
  return isSerpApiConfigured()
}

export async function loadGbpDataProviderSetting(): Promise<GbpDataProvider | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", GBP_DATA_PROVIDER_KEY)
    .maybeSingle()
  if (error || !data) return null
  return isGbpDataProvider(data.value) ? data.value : null
}

export function resolveGbpDataProviderFrom(
  selected: GbpDataProvider | null,
): ResolveGbpDataProviderResult {
  if (selected) {
    if (!isGbpProviderConfigured(selected)) {
      return { status: "error", message: GBP_VENDOR_UNCONFIGURED }
    }
    return { status: "ok", provider: selected }
  }

  const dataForSeo = isDataForSeoConfigured()
  const serpApi = isSerpApiConfigured()
  if (dataForSeo && serpApi) {
    return { status: "error", message: GBP_VENDOR_CHOOSE }
  }
  if (dataForSeo) return { status: "ok", provider: "dataforseo" }
  if (serpApi) return { status: "ok", provider: "serpapi" }
  return { status: "error", message: GBP_VENDOR_UNCONFIGURED }
}

export async function resolveGbpDataProvider(): Promise<ResolveGbpDataProviderResult> {
  const selected = await loadGbpDataProviderSetting()
  return resolveGbpDataProviderFrom(selected)
}
