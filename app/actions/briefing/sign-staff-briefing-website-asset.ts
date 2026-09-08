"use server"

import { z } from "zod"
import { BRIEFING_ASSETS_BUCKET } from "@/lib/briefing/website"
import { denyUnlessCanManage, loadStaffClient } from "@/lib/clients/staff"
import { createAdminClient } from "@/lib/supabase/admin"

const SIGNED_TTL_SECONDS = 60 * 30

export type SignStaffBriefingWebsiteAssetState =
  { status: "success"; url: string } | { status: "error"; message: string }

function belongsToClient(clientId: string, path: string): boolean {
  return path.startsWith(`${clientId}/website/`)
}

export async function signStaffBriefingWebsiteAsset(
  clientId: string,
  storagePath: string,
): Promise<SignStaffBriefingWebsiteAssetState> {
  const parsedId = z.uuid().safeParse(clientId)
  if (!parsedId.success) {
    return { status: "error", message: "Cliente inválido." }
  }
  if (typeof storagePath !== "string" || storagePath.trim().length === 0) {
    return { status: "error", message: "Arquivo inválido." }
  }

  const path = storagePath.trim()
  const loaded = await loadStaffClient(parsedId.data)
  if (loaded.status === "error") return loaded
  const denied = denyUnlessCanManage(loaded.context)
  if (denied) return denied

  if (!belongsToClient(loaded.context.client.id, path)) {
    return { status: "error", message: "Arquivo inválido." }
  }

  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(BRIEFING_ASSETS_BUCKET)
    .createSignedUrl(path, SIGNED_TTL_SECONDS)

  if (error || !data?.signedUrl) {
    return { status: "error", message: "Não foi possível gerar a prévia." }
  }

  return { status: "success", url: data.signedUrl }
}
