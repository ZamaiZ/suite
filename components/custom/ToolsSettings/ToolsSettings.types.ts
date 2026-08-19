import type { GbpDataProvider, SerpApiQuota } from "@/lib/gbp-vendor"

export type ToolsSettingsProps = {
  selected: GbpDataProvider | null
  dataForSeoConfigured: boolean
  serpApiConfigured: boolean
  serpApiQuota: SerpApiQuota | null
  currentUserIsAdmin: boolean
}
