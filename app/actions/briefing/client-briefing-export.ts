"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import {
  briefingExportFileName,
  briefingExportStoragePath,
  buildClientBriefingExportSource,
  CLIENT_BRIEFING_EXPORTS_BUCKET,
  renderClientBriefingDocx,
} from "@/lib/briefing/export-document"
import { denyUnlessCanManage, loadStaffClient } from "@/lib/clients/staff"
import { createAdminClient } from "@/lib/supabase/admin"

const SIGNED_TTL_SECONDS = 60 * 15
const FAILED = "Não foi possível gerar o Word. Tente novamente."

export type ClientBriefingExportSummary = {
  id: string
  fileName: string
  exportedAt: string
}

export type ClientBriefingExportState =
  | { status: "success"; finalized: boolean; current: ClientBriefingExportSummary | null; stale: boolean }
  | { status: "error"; message: string }

type AuthorizedExportContext = Awaited<ReturnType<typeof loadStaffClient>>

async function authorize(clientId: string): Promise<AuthorizedExportContext> {
  const parsed = z.uuid().safeParse(clientId)
  if (!parsed.success) return { status: "error", message: "Cliente inválido." }
  const loaded = await loadStaffClient(parsed.data)
  if (loaded.status === "error") return loaded
  return denyUnlessCanManage(loaded.context) ?? loaded
}

function readSummary(value: unknown): ClientBriefingExportSummary | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (typeof row.id !== "string" || typeof row.file_name !== "string" || typeof row.exported_at !== "string") return null
  return { id: row.id, fileName: row.file_name, exportedAt: row.exported_at }
}

export async function loadClientBriefingExport(clientId: string): Promise<ClientBriefingExportState> {
  const authorized = await authorize(clientId)
  if (authorized.status === "error") return authorized
  const { client } = authorized.context
  try {
    const source = await buildClientBriefingExportSource(client.id)
    const admin = createAdminClient()
    const { data, error } = await admin.from("client_briefing_exports").select("id, file_name, exported_at, content_fingerprint").eq("client_id", client.id).eq("is_current", true).maybeSingle()
    if (error) return { status: "error", message: "Não foi possível carregar a exportação." }
    const current = readSummary(data)
    return { status: "success", finalized: true, current, stale: Boolean(data && data.content_fingerprint !== source.fingerprint) }
  } catch (error) {
    if (error instanceof Error && error.message === "briefing_not_finalized") return { status: "success", finalized: false, current: null, stale: false }
    if (error instanceof Error && error.message === "briefing_secrets_not_configured") return { status: "error", message: "Criptografia de acessos não configurada." }
    return { status: "error", message: "Não foi possível carregar a exportação." }
  }
}

export async function exportClientBriefingWord(clientId: string): Promise<
  | { status: "success"; current: ClientBriefingExportSummary; url: string }
  | { status: "error"; message: string }
> {
  const authorized = await authorize(clientId)
  if (authorized.status === "error") return authorized
  const { client, user } = authorized.context

  try {
    const source = await buildClientBriefingExportSource(client.id)
    const buffer = await renderClientBriefingDocx(source.document)
    const fileName = briefingExportFileName(source.document.companyName)
    const storagePath = briefingExportStoragePath(client.id, fileName)
    const admin = createAdminClient()
    const { error: uploadError } = await admin.storage.from(CLIENT_BRIEFING_EXPORTS_BUCKET).upload(storagePath, buffer, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: false })
    if (uploadError) return { status: "error", message: FAILED }

    const { error: clearError } = await admin.from("client_briefing_exports").update({ is_current: false }).eq("client_id", client.id).eq("is_current", true)
    if (clearError) {
      await admin.storage.from(CLIENT_BRIEFING_EXPORTS_BUCKET).remove([storagePath])
      return { status: "error", message: FAILED }
    }
    const exportedAt = new Date().toISOString()
    const { data, error: insertError } = await admin.from("client_briefing_exports").insert({ client_id: client.id, document: source.document, content_fingerprint: source.fingerprint, storage_path: storagePath, file_name: fileName, is_current: true, exported_at: exportedAt, exported_by: user.id }).select("id, file_name, exported_at").single()
    const current = readSummary(data)
    if (insertError || !current) {
      await admin.storage.from(CLIENT_BRIEFING_EXPORTS_BUCKET).remove([storagePath])
      return { status: "error", message: FAILED }
    }
    const { data: signed } = await admin.storage.from(CLIENT_BRIEFING_EXPORTS_BUCKET).createSignedUrl(storagePath, SIGNED_TTL_SECONDS)
    revalidatePath("/clients")
    return { status: "success", current, url: signed?.signedUrl ?? "" }
  } catch (error) {
    if (error instanceof Error && error.message === "briefing_not_finalized") return { status: "error", message: "Finalize o briefing antes de gerar o Word." }
    if (error instanceof Error && error.message === "briefing_secrets_not_configured") return { status: "error", message: "Criptografia de acessos não configurada." }
    return { status: "error", message: FAILED }
  }
}

export async function getClientBriefingWordUrl(clientId: string): Promise<
  | { status: "success"; url: string; fileName: string }
  | { status: "error"; message: string }
> {
  const authorized = await authorize(clientId)
  if (authorized.status === "error") return authorized
  const admin = createAdminClient()
  const { data, error } = await admin.from("client_briefing_exports").select("file_name, storage_path").eq("client_id", authorized.context.client.id).eq("is_current", true).maybeSingle()
  if (error) return { status: "error", message: "Não foi possível abrir o Word." }
  if (!data || typeof data.file_name !== "string" || typeof data.storage_path !== "string") return { status: "error", message: "Nenhum Word foi gerado ainda." }
  const { data: signed, error: signedError } = await admin.storage.from(CLIENT_BRIEFING_EXPORTS_BUCKET).createSignedUrl(data.storage_path, SIGNED_TTL_SECONDS)
  if (signedError || !signed?.signedUrl) return { status: "error", message: "Não foi possível abrir o Word." }
  return { status: "success", url: signed.signedUrl, fileName: data.file_name }
}
