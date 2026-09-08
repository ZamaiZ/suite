"use server"

import { randomUUID } from "node:crypto"
import {
  ASSET_KIND_IDS,
  BRIEFING_ASSETS_BUCKET,
  WEBSITE_IMAGE_MAX_BYTES,
  WEBSITE_IMAGE_MIME_TYPES,
  WEBSITE_PDF_MAX_BYTES,
  WEBSITE_PDF_MIME_TYPES,
  type BriefingAssetKind,
  type BriefingAssetRef,
} from "@/lib/briefing/website"
import { touchBriefingContentUpdatedAt } from "@/lib/briefing/touch-content"
import { requireBriefingWriter } from "@/lib/briefing/writer"

const SIGNED_TTL_SECONDS = 60 * 30

export type UploadBriefingWebsiteAssetState =
  | {
      status: "success"
      asset: BriefingAssetRef
      previewUrl: string
    }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

export type RemoveBriefingWebsiteAssetState =
  | { status: "success" }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

export type SignBriefingWebsiteAssetState =
  | { status: "success"; url: string }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

function isAssetKind(value: unknown): value is BriefingAssetKind {
  return (
    typeof value === "string" &&
    (ASSET_KIND_IDS as readonly string[]).includes(value)
  )
}

function allowedMimeForKind(kind: BriefingAssetKind): readonly string[] {
  if (kind === "brand_book") return WEBSITE_PDF_MIME_TYPES
  return WEBSITE_IMAGE_MIME_TYPES
}

function maxBytesForKind(kind: BriefingAssetKind): number {
  if (kind === "brand_book") return WEBSITE_PDF_MAX_BYTES
  return WEBSITE_IMAGE_MAX_BYTES
}

function safeFileName(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120)
  return base.length > 0 ? base : "file"
}

function storagePathFor(
  clientId: string,
  assetId: string,
  fileName: string,
): string {
  return `${clientId}/website/${assetId}-${safeFileName(fileName)}`
}

function belongsToClient(clientId: string, path: string): boolean {
  return path.startsWith(`${clientId}/website/`)
}

export async function uploadBriefingWebsiteAsset(
  formData: FormData,
): Promise<UploadBriefingWebsiteAssetState> {
  const clientIdRaw = formData.get("client_id")
  const loaded = await requireBriefingWriter(
    typeof clientIdRaw === "string" && clientIdRaw.length > 0
      ? clientIdRaw
      : undefined,
  )
  if (loaded.status !== "ok") return loaded

  const kindRaw = formData.get("kind")
  if (!isAssetKind(kindRaw)) {
    return { status: "error", message: "Tipo de arquivo inválido." }
  }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return { status: "error", message: "Arquivo não enviado." }
  }

  const mimeType = file.type
  if (!allowedMimeForKind(kindRaw).includes(mimeType)) {
    return {
      status: "error",
      message:
        kindRaw === "brand_book"
          ? "Envie um PDF."
          : "Envie um arquivo PNG ou SVG.",
    }
  }

  const maxBytes = maxBytesForKind(kindRaw)
  if (file.size <= 0 || file.size > maxBytes) {
    return {
      status: "error",
      message:
        kindRaw === "brand_book"
          ? "PDF deve ter no máximo 10 MB."
          : "Arquivo deve ter no máximo 2 MB.",
    }
  }

  const assetId = randomUUID()
  const fileName = file.name || "file"
  const storagePath = storagePathFor(
    loaded.context.client.id,
    assetId,
    fileName,
  )
  const buffer = Buffer.from(await file.arrayBuffer())
  const { admin } = loaded.context

  const { error: uploadError } = await admin.storage
    .from(BRIEFING_ASSETS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (uploadError) {
    return { status: "error", message: "Não foi possível enviar o arquivo." }
  }

  const asset: BriefingAssetRef = {
    id: assetId,
    kind: kindRaw,
    fileName: safeFileName(fileName),
    mimeType,
    sizeBytes: file.size,
    storagePath,
  }

  const { data: signed, error: signedError } = await admin.storage
    .from(BRIEFING_ASSETS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_TTL_SECONDS)

  await touchBriefingContentUpdatedAt(admin, loaded.context.client.id)

  return {
    status: "success",
    asset,
    previewUrl: !signedError && signed?.signedUrl ? signed.signedUrl : "",
  }
}

export async function removeBriefingWebsiteAsset(
  storagePath: string,
  clientId?: string,
): Promise<RemoveBriefingWebsiteAssetState> {
  const loaded = await requireBriefingWriter(clientId)
  if (loaded.status !== "ok") return loaded

  if (typeof storagePath !== "string" || storagePath.trim().length === 0) {
    return { status: "error", message: "Arquivo inválido." }
  }

  const path = storagePath.trim()
  if (!belongsToClient(loaded.context.client.id, path)) {
    return { status: "error", message: "Arquivo inválido." }
  }

  await loaded.context.admin.storage.from(BRIEFING_ASSETS_BUCKET).remove([path])
  await touchBriefingContentUpdatedAt(
    loaded.context.admin,
    loaded.context.client.id,
  )
  return { status: "success" }
}

export async function signBriefingWebsiteAsset(
  storagePath: string,
  clientId?: string,
): Promise<SignBriefingWebsiteAssetState> {
  const loaded = await requireBriefingWriter(clientId)
  if (loaded.status !== "ok") return loaded

  if (typeof storagePath !== "string" || storagePath.trim().length === 0) {
    return { status: "error", message: "Arquivo inválido." }
  }

  const path = storagePath.trim()
  if (!belongsToClient(loaded.context.client.id, path)) {
    return { status: "error", message: "Arquivo inválido." }
  }

  const { data, error } = await loaded.context.admin.storage
    .from(BRIEFING_ASSETS_BUCKET)
    .createSignedUrl(path, SIGNED_TTL_SECONDS)

  if (error || !data?.signedUrl) {
    return { status: "error", message: "Não foi possível gerar a prévia." }
  }

  return { status: "success", url: data.signedUrl }
}
