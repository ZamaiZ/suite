import type { BriefingAssetKind, BriefingAssetRef } from "@/lib/briefing/website"

export type BriefingAssetUploadProps = {
  id: string
  label: string
  description?: string
  kind: BriefingAssetKind
  accept: string
  multiple?: boolean
  maxFiles: number
  assets: BriefingAssetRef[]
  previewUrls: Record<string, string>
  disabled?: boolean
  onUploaded: (asset: BriefingAssetRef, previewUrl: string) => void
  onRemoved: (asset: BriefingAssetRef) => void
}
