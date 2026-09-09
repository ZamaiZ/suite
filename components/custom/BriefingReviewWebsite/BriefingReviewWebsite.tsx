"use client"

import { useEffect, useState } from "react"
import { RiExternalLinkLine } from "react-icons/ri"
import { signStaffBriefingWebsiteAsset } from "@/app/actions/briefing"
import {
  BriefingReviewChips,
  BriefingReviewField,
  BriefingReviewSection,
  formatYesNo,
} from "@/components/custom/BriefingReviewField"
import {
  COLOR_POLICY_LABELS,
  LOGO_STATUS_LABELS,
  type BriefingAssetRef,
} from "@/lib/briefing/website"
import type { BriefingReviewWebsiteProps } from "./BriefingReviewWebsite.types"
import { Spinner } from "@/components/ui/spinner"

function AssetLink({
  clientId,
  asset,
  canOpen,
}: {
  clientId: string
  asset: BriefingAssetRef
  canOpen: boolean
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!canOpen) {
      setUrl(null)
      setLoading(false)
      return
    }
    let cancelled = false
    void signStaffBriefingWebsiteAsset(clientId, asset.storagePath).then(
      (result) => {
        if (cancelled) return
        setLoading(false)
        if (result.status === "error") {
          setError(result.message)
          return
        }
        setUrl(result.url)
      },
    )
    return () => {
      cancelled = true
    }
  }, [canOpen, clientId, asset.storagePath])

  return (
    <div className="flex flex-col gap-1 rounded-lg bg-background px-3 py-2">
      <p className="text-xs/relaxed font-medium text-foreground">
        {asset.fileName}
      </p>
      <p className="text-xs/relaxed text-muted-foreground">
        {asset.mimeType} · {Math.round(asset.sizeBytes / 1024)} KB
      </p>
      {loading ? (
        <span className="inline-flex items-center gap-1 text-xs/relaxed text-muted-foreground">
          <Spinner aria-hidden className="size-3.5" />
          Gerando link…
        </span>
      ) : null}
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs/relaxed font-medium text-primary"
        >
          Abrir
          <RiExternalLinkLine size={14} aria-hidden />
        </a>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs/relaxed text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function BriefingReviewWebsite({
  clientId,
  payload,
  canOpenAssets = true,
}: BriefingReviewWebsiteProps) {
  return (
    <div className="flex flex-col gap-3">
      <BriefingReviewSection title="Identidade">
        <BriefingReviewField
          label="Logo"
          value={
            payload.logoStatus ? LOGO_STATUS_LABELS[payload.logoStatus] : ""
          }
        />
        <BriefingReviewField
          label="Política de cores"
          value={
            payload.colorPolicy ? COLOR_POLICY_LABELS[payload.colorPolicy] : ""
          }
        />
      </BriefingReviewSection>
      <BriefingReviewSection title="Arquivos">
        {payload.logos.length === 0 &&
        !payload.brandBook &&
        payload.iconKit.length === 0 ? (
          <BriefingReviewField label="Uploads" value="" />
        ) : (
          <div className="flex flex-col gap-2">
            {payload.logos.map((asset) => (
              <AssetLink
                key={asset.id}
                clientId={clientId}
                asset={asset}
                canOpen={canOpenAssets}
              />
            ))}
            {payload.brandBook ? (
              <AssetLink
                clientId={clientId}
                asset={payload.brandBook}
                canOpen={canOpenAssets}
              />
            ) : null}
            {payload.iconKit.map((asset) => (
              <AssetLink
                key={asset.id}
                clientId={clientId}
                asset={asset}
                canOpen={canOpenAssets}
              />
            ))}
          </div>
        )}
      </BriefingReviewSection>
      <BriefingReviewSection title="Inventário">
        <BriefingReviewField
          label="Brand book"
          value={formatYesNo(payload.assetInventory.brandBook)}
        />
        <BriefingReviewField
          label="Ícones"
          value={formatYesNo(payload.assetInventory.icons)}
        />
        <BriefingReviewField
          label="Paleta documentada"
          value={formatYesNo(payload.assetInventory.documentedPalette)}
        />
        <BriefingReviewField
          label="Outras diretrizes"
          value={formatYesNo(payload.assetInventory.otherGuidelines)}
        />
        <BriefingReviewChips label="Links" items={payload.assetLinks} />
      </BriefingReviewSection>
      <BriefingReviewSection title="Referências">
        <BriefingReviewChips
          label="Sites que gostam"
          items={payload.likedSites}
        />
        <BriefingReviewChips
          label="Sites que não gostam"
          items={payload.dislikedSites}
        />
        <BriefingReviewField label="Notas" value={payload.notes} />
      </BriefingReviewSection>
    </div>
  )
}
