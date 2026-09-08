import type { DataForSeoUserData } from "@/lib/dataforseo/usage"

export type ToolsSettingsProps = {
  configured: boolean
  usage: DataForSeoUserData | null
  errorMessage: string | null
}
