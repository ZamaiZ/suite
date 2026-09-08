"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import { LazyMotion, domAnimation } from "motion/react"
import {
  RiCheckLine,
  RiCloseLine,
  RiLoader4Line,
  RiPaletteLine,
  RiGlobalLine,
  RiBrushLine,
} from "react-icons/ri"
import {
  completeBriefingWebsite,
  saveBriefingWebsite,
  signBriefingWebsiteAsset,
} from "@/app/actions/briefing"
import { BriefingAssetUpload } from "@/components/custom/BriefingAssetUpload"
import { useBriefingAutosave } from "@/components/custom/BriefingAutosave"
import { BriefingChipField } from "@/components/custom/BriefingChipField"
import {
  BriefingChoiceCard,
  BriefingChoiceCardGroup,
} from "@/components/custom/BriefingChoiceCard"
import { BriefingSectionCard } from "@/components/custom/BriefingSectionCard"
import {
  attachBriefingClientId,
  useBriefingWriterClientId,
  useBriefingWriterFlushRegistration,
  useWrappedBriefingSave,
} from "@/components/custom/BriefingWriter"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  COLOR_POLICY_DESCRIPTIONS,
  COLOR_POLICY_IDS,
  COLOR_POLICY_LABELS,
  getWebsiteMissingGroups,
  INVENTORY_ANSWER_IDS,
  isWebsiteReadyToComplete,
  LOGO_STATUS_DESCRIPTIONS,
  LOGO_STATUS_IDS,
  LOGO_STATUS_LABELS,
  sanitizeWebsitePayload,
  WEBSITE_ICONS_MAX,
  WEBSITE_LOGOS_MAX,
  WEBSITE_MISSING_LABELS,
  type BriefingAssetRef,
  type BriefingWebsitePayload,
  type ColorPolicyId,
  type InventoryAnswerId,
  type LogoStatusId,
} from "@/lib/briefing/website"
import { formatTimeShort } from "@/lib/date-time"
import type { ClientBriefingWebsiteFormProps } from "./ClientBriefingWebsiteForm.types"

const INVENTORY_YES_NO_LABELS: Record<InventoryAnswerId, string> = {
  yes: "Sim, tenho",
  no: "Não tenho",
}

export function ClientBriefingWebsiteForm({
  initialPayload,
  initialUpdatedAt,
  initialCompletedAt,
  variant = "portal",
  onBack,
  onContinue,
}: ClientBriefingWebsiteFormProps) {
  const writerClientId = useBriefingWriterClientId()
  const persist = useWrappedBriefingSave(saveBriefingWebsite)
  const [payload, setPayload] = useState<BriefingWebsitePayload>(() =>
    sanitizeWebsitePayload(initialPayload),
  )
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const previewUrlsRef = useRef(previewUrls)
  const [isCompleting, startComplete] = useTransition()

  useEffect(() => {
    previewUrlsRef.current = previewUrls
  }, [previewUrls])

  const {
    saveState,
    savedAt,
    completedAt,
    errorMessage,
    scheduleSave,
    flushPending,
    markComplete,
    setError,
    clearError,
  } = useBriefingAutosave(initialUpdatedAt, initialCompletedAt, persist)
  useBriefingWriterFlushRegistration(flushPending)

  const patch = useCallback(
    (partial: Partial<BriefingWebsitePayload>) => {
      setPayload((current) => {
        const next = sanitizeWebsitePayload({ ...current, ...partial })
        scheduleSave(next)
        return next
      })
      clearError()
    },
    [clearError, scheduleSave],
  )

  useEffect(() => {
    const assets = [
      ...payload.logos,
      ...(payload.brandBook ? [payload.brandBook] : []),
      ...payload.iconKit,
    ]
    let cancelled = false
    void (async () => {
      const additions: Record<string, string> = {}
      for (const asset of assets) {
        if (previewUrlsRef.current[asset.id]) continue
        const result = await signBriefingWebsiteAsset(
          asset.storagePath,
          writerClientId ?? undefined,
        )
        if (cancelled) return
        if (result.status === "success") {
          additions[asset.id] = result.url
        }
      }
      if (cancelled || Object.keys(additions).length === 0) return
      setPreviewUrls((current) => ({ ...current, ...additions }))
    })()
    return () => {
      cancelled = true
    }
  }, [payload.logos, payload.brandBook, payload.iconKit, writerClientId])

  const ready = isWebsiteReadyToComplete(payload)
  const missingLabels = useMemo(
    () =>
      getWebsiteMissingGroups(payload).map(
        (group) => WEBSITE_MISSING_LABELS[group],
      ),
    [payload],
  )
  const completed = Boolean(completedAt)
  const showLogoUpload = payload.logoStatus === "have_file"
  const showBrandBookUpload = payload.assetInventory.brandBook === "yes"
  const showIconUpload = payload.assetInventory.icons === "yes"

  function handleAssetUploaded(asset: BriefingAssetRef, previewUrl: string) {
    setPreviewUrls((current) => ({ ...current, [asset.id]: previewUrl }))
    setPayload((current) => {
      let next: BriefingWebsitePayload
      if (asset.kind === "logo") {
        next = sanitizeWebsitePayload({
          ...current,
          logos: [...current.logos, asset].slice(0, WEBSITE_LOGOS_MAX),
        })
      } else if (asset.kind === "brand_book") {
        next = sanitizeWebsitePayload({
          ...current,
          brandBook: asset,
        })
      } else {
        next = sanitizeWebsitePayload({
          ...current,
          iconKit: [...current.iconKit, asset].slice(0, WEBSITE_ICONS_MAX),
        })
      }
      scheduleSave(next)
      return next
    })
    clearError()
  }

  function removePreview(assetId: string) {
    setPreviewUrls((current) => {
      const next = { ...current }
      delete next[assetId]
      return next
    })
  }

  function handleAssetRemoved(asset: BriefingAssetRef) {
    removePreview(asset.id)
    setPayload((current) => {
      let next: BriefingWebsitePayload
      if (asset.kind === "logo") {
        next = sanitizeWebsitePayload({
          ...current,
          logos: current.logos.filter((item) => item.id !== asset.id),
        })
      } else if (asset.kind === "brand_book") {
        next = sanitizeWebsitePayload({
          ...current,
          brandBook: null,
        })
      } else {
        next = sanitizeWebsitePayload({
          ...current,
          iconKit: current.iconKit.filter((item) => item.id !== asset.id),
        })
      }
      scheduleSave(next)
      return next
    })
    clearError()
  }

  function handleComplete() {
    if (!ready) return
    clearError()
    startComplete(async () => {
      if (!(await flushPending())) return
      const result = await completeBriefingWebsite(
        attachBriefingClientId(payload, writerClientId),
      )
      if (result.status === "unauthenticated") {
        setError("Sessão expirada. Atualize a página.")
        return
      }
      if (result.status === "error") {
        setError(result.message)
        return
      }
      markComplete(result.updatedAt, result.completedAt)
      if (result.completedAt) onContinue?.(result.completedAt)
    })
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 pb-24">
        <BriefingSectionCard
          index={1}
          icon={<RiBrushLine size={18} aria-hidden />}
          title="Identidade visual"
          description="Logo, o que vocês já têm de marca e links do kit."
        >
          <BriefingChoiceCardGroup
            label="Sobre o logo da marca"
            value={payload.logoStatus ?? ""}
            onValueChange={(next) => {
              const logoStatus = (
                LOGO_STATUS_IDS as readonly string[]
              ).includes(next)
                ? (next as LogoStatusId)
                : null
              patch({ logoStatus })
            }}
            contentClassName="grid-cols-1 sm:grid-cols-2"
          >
            {LOGO_STATUS_IDS.map((id) => (
              <BriefingChoiceCard
                key={id}
                value={id}
                title={LOGO_STATUS_LABELS[id]}
                description={LOGO_STATUS_DESCRIPTIONS[id]}
              />
            ))}
          </BriefingChoiceCardGroup>

          {showLogoUpload ? (
            <BriefingAssetUpload
              id="briefing-website-logos"
              label="Arquivos de logo"
              description="PNG ou SVG, até 3 arquivos, 2 MB cada."
              kind="logo"
              accept="image/png,image/svg+xml"
              multiple
              maxFiles={WEBSITE_LOGOS_MAX}
              assets={payload.logos}
              previewUrls={previewUrls}
              onUploaded={handleAssetUploaded}
              onRemoved={handleAssetRemoved}
            />
          ) : null}

          {(
            [
              ["brandBook", "Vocês têm brand book / manual de marca?"],
              ["icons", "Vocês têm kit de ícones da marca?"],
              ["documentedPalette", "Vocês têm paleta de cores documentada?"],
              ["otherGuidelines", "Há outras guidelines de marca?"],
            ] as const
          ).map(([key, label]) => (
            <BriefingChoiceCardGroup
              key={key}
              label={label}
              value={payload.assetInventory[key] ?? ""}
              onValueChange={(next) => {
                const answer = (
                  INVENTORY_ANSWER_IDS as readonly string[]
                ).includes(next)
                  ? (next as InventoryAnswerId)
                  : null
                patch({
                  assetInventory: {
                    ...payload.assetInventory,
                    [key]: answer,
                  },
                })
              }}
              contentClassName="grid-cols-2"
            >
              {INVENTORY_ANSWER_IDS.map((id) => (
                <BriefingChoiceCard
                  key={id}
                  value={id}
                  title={INVENTORY_YES_NO_LABELS[id]}
                />
              ))}
            </BriefingChoiceCardGroup>
          ))}

          {showBrandBookUpload ? (
            <BriefingAssetUpload
              id="briefing-website-brand-book"
              label="Brand book (PDF)"
              description="Ou envie um link do kit abaixo. PDF até 10 MB."
              kind="brand_book"
              accept="application/pdf"
              maxFiles={1}
              assets={payload.brandBook ? [payload.brandBook] : []}
              previewUrls={previewUrls}
              onUploaded={handleAssetUploaded}
              onRemoved={handleAssetRemoved}
            />
          ) : null}

          {showIconUpload ? (
            <BriefingAssetUpload
              id="briefing-website-icons"
              label="Ícones da marca"
              description="PNG ou SVG, até 10 arquivos — ou um link do kit abaixo."
              kind="icon"
              accept="image/png,image/svg+xml"
              multiple
              maxFiles={WEBSITE_ICONS_MAX}
              assets={payload.iconKit}
              previewUrls={previewUrls}
              onUploaded={handleAssetUploaded}
              onRemoved={handleAssetRemoved}
            />
          ) : null}

          <BriefingChipField
            id="briefing-website-asset-links"
            label="Links do kit (Drive, Figma…)"
            values={payload.assetLinks}
            onChange={(assetLinks) => patch({ assetLinks })}
            placeholder="Cole o link e pressione Enter"
          />

          <Field>
            <FieldLabel htmlFor="briefing-website-notes">
              Observações (opcional)
            </FieldLabel>
            <Textarea
              id="briefing-website-notes"
              rows={4}
              value={payload.notes}
              onChange={(event) => patch({ notes: event.target.value })}
              placeholder="Restrições de uso do logo, tipografia, o que evitar…"
            />
          </Field>
        </BriefingSectionCard>

        <BriefingSectionCard
          index={2}
          icon={<RiPaletteLine size={18} aria-hidden />}
          title="Cores"
          description="Como devemos tratar a paleta no site novo."
        >
          <BriefingChoiceCardGroup
            label="Política de cores"
            value={payload.colorPolicy ?? ""}
            onValueChange={(next) => {
              const colorPolicy = (
                COLOR_POLICY_IDS as readonly string[]
              ).includes(next)
                ? (next as ColorPolicyId)
                : null
              patch({ colorPolicy })
            }}
            contentClassName="grid-cols-1 sm:grid-cols-2"
          >
            {COLOR_POLICY_IDS.map((id) => (
              <BriefingChoiceCard
                key={id}
                value={id}
                title={COLOR_POLICY_LABELS[id]}
                description={COLOR_POLICY_DESCRIPTIONS[id]}
              />
            ))}
          </BriefingChoiceCardGroup>
          {payload.colorPolicy === "keep_current" ? (
            <p className="text-xs/relaxed text-muted-foreground">
              Usaremos o site informado na etapa Empresa como referência de
              cores.
            </p>
          ) : null}
        </BriefingSectionCard>

        <BriefingSectionCard
          index={3}
          icon={<RiGlobalLine size={18} aria-hidden />}
          title="Referências"
          description="Sites que você gosta e não gosta, em aparência e funcionalidade."
        >
          <BriefingChipField
            id="briefing-website-liked-sites"
            label="Sites que você gosta"
            values={payload.likedSites}
            onChange={(likedSites) => patch({ likedSites })}
            placeholder="https://exemplo.com"
          />
          <BriefingChipField
            id="briefing-website-disliked-sites"
            label="Sites que você não gosta"
            values={payload.dislikedSites}
            onChange={(dislikedSites) => patch({ dislikedSites })}
            placeholder="https://exemplo.com"
          />
        </BriefingSectionCard>

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-xs/relaxed text-destructive"
          >
            {errorMessage}
          </p>
        ) : null}

        {completed ? (
          <div className="rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-xs/relaxed text-success">
            Etapa concluída. Você pode continuar editando; as alterações seguem
            sendo salvas.
          </div>
        ) : null}

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
          <div className="pointer-events-auto border-t border-border bg-background/90 backdrop-blur-md">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-[var(--page-padding-x)] py-3">
              <div className="min-w-0">
                <p className="inline-flex min-w-0 items-center gap-1.5 text-xs/relaxed text-muted-foreground">
                  {saveState === "saving" || isCompleting ? (
                    <>
                      <RiLoader4Line
                        size={14}
                        aria-hidden
                        className="animate-spin"
                      />
                      Salvando…
                    </>
                  ) : saveState === "saved" && savedAt ? (
                    <>
                      <RiCheckLine
                        size={14}
                        aria-hidden
                        className="text-success"
                      />
                      Salvo · {formatTimeShort(savedAt)}
                    </>
                  ) : saveState === "error" ? (
                    <>
                      <RiCloseLine
                        size={14}
                        aria-hidden
                        className="text-destructive"
                      />
                      Não foi possível salvar
                    </>
                  ) : (
                    "Rascunho salvo automaticamente"
                  )}
                </p>
                {!ready && missingLabels.length > 0 ? (
                  <p className="mt-0.5 truncate text-xs/relaxed text-muted-foreground">
                    Falta: {missingLabels.join(", ")}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {onBack ? (
                  <Button type="button" variant="ghost" onClick={onBack}>
                    Voltar
                  </Button>
                ) : null}
                {variant === "staff" ? null : (
                  <Button
                    type="button"
                    disabled={isCompleting || !ready}
                    onClick={handleComplete}
                  >
                    {isCompleting
                      ? "Salvando..."
                      : completed
                        ? "Etapa concluída"
                        : "Continuar"}
                    {completed ? (
                      <RiCheckLine
                        size={16}
                        aria-hidden
                        data-icon="inline-end"
                      />
                    ) : null}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </LazyMotion>
  )
}
