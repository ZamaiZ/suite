"use client"

import { useRef, useState, useTransition } from "react"
import { RiCloseLine, RiUpload2Line } from "react-icons/ri"
import {
  removeBriefingWebsiteAsset,
  uploadBriefingWebsiteAsset,
} from "@/app/actions/briefing"
import { useBriefingWriterClientId } from "@/components/custom/BriefingWriter"
import { cn } from "cn"
import type { BriefingAssetUploadProps } from "./BriefingAssetUpload.types"
import { Spinner } from "@/components/ui/spinner"

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function BriefingAssetUpload({
  id,
  label,
  description,
  kind,
  accept,
  multiple = false,
  maxFiles,
  assets,
  previewUrls,
  disabled,
  onUploaded,
  onRemoved,
}: BriefingAssetUploadProps) {
  const writerClientId = useBriefingWriterClientId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, startUpload] = useTransition()
  const atLimit = assets.length >= maxFiles
  const busy = disabled || isUploading || atLimit

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const remaining = maxFiles - assets.length
    if (remaining <= 0) return
    const files = Array.from(fileList).slice(0, remaining)
    setError(null)
    startUpload(async () => {
      for (const file of files) {
        const formData = new FormData()
        formData.set("kind", kind)
        formData.set("file", file)
        if (writerClientId) formData.set("client_id", writerClientId)
        const result = await uploadBriefingWebsiteAsset(formData)
        if (result.status === "unauthenticated") {
          setError("Sessão expirada. Atualize a página.")
          return
        }
        if (result.status === "error") {
          setError(result.message)
          return
        }
        onUploaded(result.asset, result.previewUrl)
      }
    })
  }

  function handleRemove(asset: BriefingAssetUploadProps["assets"][number]) {
    setError(null)
    startUpload(async () => {
      const result = await removeBriefingWebsiteAsset(
        asset.storagePath,
        writerClientId ?? undefined,
      )
      if (result.status === "unauthenticated") {
        setError("Sessão expirada. Atualize a página.")
        return
      }
      if (result.status === "error") {
        setError(result.message)
        return
      }
      onRemoved(asset)
    })
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <label
          htmlFor={id}
          className="text-xs/relaxed font-medium text-muted-foreground"
        >
          {label}
        </label>
        {description ? (
          <p className="text-xs/relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={busy}
        className="sr-only"
        onChange={(event) => {
          handleFiles(event.target.files)
          event.target.value = ""
        }}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-popover/40 px-4 py-6",
          "text-xs/relaxed text-muted-foreground transition-[border-color,background-color] duration-150",
          "hover:border-primary/40 hover:bg-popover",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        {isUploading ? (
          <Spinner aria-hidden className="size-5 text-primary" />
        ) : (
          <RiUpload2Line size={20} aria-hidden className="text-primary" />
        )}
        <span>
          {atLimit
            ? "Limite de arquivos atingido"
            : isUploading
              ? "Enviando…"
              : "Clique para enviar"}
        </span>
      </button>

      {assets.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {assets.map((asset) => {
            const preview = previewUrls[asset.id]
            const isImage = asset.mimeType.startsWith("image/")
            return (
              <li
                key={asset.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2"
              >
                {isImage && preview ? (
                  <img
                    src={preview}
                    alt=""
                    className="size-10 shrink-0 rounded-md object-contain bg-popover"
                  />
                ) : (
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-popover text-xs/relaxed font-medium text-muted-foreground">
                    PDF
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs/relaxed font-medium text-foreground">
                    {asset.fileName}
                  </p>
                  <p className="text-xs/relaxed text-muted-foreground">
                    {formatBytes(asset.sizeBytes)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={disabled || isUploading}
                  aria-label={`Remover ${asset.fileName}`}
                  onClick={() => handleRemove(asset)}
                  className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  <RiCloseLine size={16} aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs/relaxed text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
