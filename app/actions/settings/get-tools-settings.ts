"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { isDataForSeoConfigured } from "@/lib/dataforseo/configured"
import {
  fetchDataForSeoUserData,
  type DataForSeoUserData,
} from "@/lib/dataforseo/user-data"

export type ToolsSettingsState = {
  configured: boolean
  usage: DataForSeoUserData | null
  errorMessage: string | null
}

export async function getToolsSettings(): Promise<ToolsSettingsState> {
  await requireCommercialMember()

  if (!isDataForSeoConfigured()) {
    return {
      configured: false,
      usage: null,
      errorMessage: null,
    }
  }

  const fetched = await fetchDataForSeoUserData()
  if (fetched.status === "error") {
    return { configured: true, usage: null, errorMessage: fetched.message }
  }
  return { configured: true, usage: fetched.data, errorMessage: null }
}
