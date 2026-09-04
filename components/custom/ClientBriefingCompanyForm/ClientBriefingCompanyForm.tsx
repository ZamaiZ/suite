"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
import {
  applyBriefingPlace,
  completeBriefingCompany,
  lookupBriefingPostalCode,
  saveBriefingCompany,
} from "@/app/actions/briefing"
import { useBriefingAutosave } from "@/components/custom/BriefingAutosave"
import { BriefingAddressSearch } from "@/components/custom/BriefingAddressSearch"
import { BriefingChipField } from "@/components/custom/BriefingChipField"
import { BriefingHoursEditor } from "@/components/custom/BriefingHoursEditor"
import { BriefingSectionCard } from "@/components/custom/BriefingSectionCard"
import {
  attachBriefingClientId,
  useBriefingWriterClientId,
  useBriefingWriterFlushRegistration,
  useWrappedBriefingSave,
} from "@/components/custom/BriefingWriter"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { joinBrazilianAddress } from "@/lib/briefing/address"
import {
  COMPANY_MISSING_LABELS,
  ensureWebsiteChannel,
  getCompanyMissingGroups,
  isCompanyReadyToComplete,
  taxIdInputVariant,
  type BriefingCompanyChannel,
  type BriefingCompanyPayload,
} from "@/lib/briefing/company"
import { BR_STATES } from "@/lib/br-locations"
import {
  digitsOnly,
  formatPhone,
  formatPostalCode,
} from "@/lib/br-documents"
import { formatTimeShort } from "@/lib/date-time"
import {
  DIGITAL_CHANNEL_LABELS,
  DIGITAL_CHANNEL_PLACEHOLDERS,
  DIGITAL_CHANNELS_MAX,
  SOCIAL_CHANNEL_TYPES,
  type DigitalChannelType,
  type SocialChannelType,
} from "@/lib/leads/digital-channels"
import { CHANNEL_ICONS } from "@/lib/leads/digital-channel-icons"
import {
  RiAddLine,
  RiBuilding2Line,
  RiBuilding4Line,
  RiCheckLine,
  RiCloseLine,
  RiCommunityLine,
  RiDeleteBinLine,
  RiFileList3Line,
  RiFlagLine,
  RiGlobalLine,
  RiHashtag,
  RiHomeGearLine,
  RiInboxLine,
  RiLoader4Line,
  RiMailLine,
  RiMapPinLine,
  RiPhoneLine,
  RiShareLine,
  RiUserLine,
  RiWhatsappLine,
} from "react-icons/ri"
import type { ClientBriefingCompanyFormProps } from "./ClientBriefingCompanyForm.types"

const STATE_ITEMS = BR_STATES.map((state) => ({
  value: state.code,
  label: state.code,
  description: state.name,
}))

const SOCIAL_TYPE_ITEMS = SOCIAL_CHANNEL_TYPES.map((type) => {
  const Icon = CHANNEL_ICONS[type]
  return {
    value: type,
    label: DIGITAL_CHANNEL_LABELS[type],
    icon: <Icon size={16} aria-hidden />,
  }
})

function isSocialChannelType(value: string): value is SocialChannelType {
  return (SOCIAL_CHANNEL_TYPES as readonly string[]).includes(value)
}

export function ClientBriefingCompanyForm({
  initialPayload,
  sourceSnapshot,
  initialUpdatedAt,
  initialCompletedAt,
  variant = "portal",
  onContinue,
}: ClientBriefingCompanyFormProps) {
  const writerClientId = useBriefingWriterClientId()
  const persist = useWrappedBriefingSave(saveBriefingCompany)
  const [payload, setPayload] = useState<BriefingCompanyPayload>(() => ({
    ...initialPayload,
    channels: ensureWebsiteChannel(initialPayload.channels),
  }))
  const [postalStatus, setPostalStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle")
  const [postalError, setPostalError] = useState<string | null>(null)
  const [isCompleting, startComplete] = useTransition()

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
  } = useBriefingAutosave(
    initialUpdatedAt,
    initialCompletedAt,
    persist,
  )
  useBriefingWriterFlushRegistration(flushPending)

  const patch = useCallback(
    (partial: Partial<BriefingCompanyPayload>) => {
      setPayload((current) => {
        const next = { ...current, ...partial }
        scheduleSave(next)
        return next
      })
      clearError()
    },
    [clearError, scheduleSave],
  )

  function patchAddress(
    partial: Partial<
      Pick<
        BriefingCompanyPayload,
        | "street"
        | "number"
        | "complement"
        | "neighborhood"
        | "city"
        | "stateCode"
        | "postalCode"
        | "formattedAddress"
      >
    >,
  ) {
    const next = { ...payload, ...partial }
    patch({
      ...partial,
      formattedAddress:
        partial.formattedAddress ??
        joinBrazilianAddress({
          street: next.street,
          number: next.number,
          complement: next.complement,
          neighborhood: next.neighborhood,
          city: next.city,
          stateCode: next.stateCode,
          postalCode: next.postalCode,
        }),
    })
  }

  async function handlePostalBlur() {
    const digits = digitsOnly(payload.postalCode)
    if (digits.length === 0) {
      setPostalStatus("idle")
      setPostalError(null)
      return
    }
    if (digits.length !== 8) {
      setPostalStatus("error")
      setPostalError("CEP inválido.")
      return
    }
    setPostalStatus("loading")
    setPostalError(null)
    const result = await lookupBriefingPostalCode(
      digits,
      writerClientId ?? undefined,
    )
    if (result.status === "unauthenticated") {
      setPostalStatus("error")
      setPostalError("Sessão expirada. Atualize a página.")
      return
    }
    if (result.status === "error") {
      setPostalStatus("error")
      setPostalError(result.message)
      return
    }
    setPostalStatus("success")
    patchAddress({
      postalCode: result.postalCode,
      street: result.street || payload.street,
      neighborhood: result.neighborhood || payload.neighborhood,
      city: result.city || payload.city,
      stateCode: result.stateCode || payload.stateCode,
    })
  }

  async function handlePlacePick(placeId: string, sessionToken: string) {
    const result = await applyBriefingPlace({
      placeId,
      sessionToken,
      currentHours: payload.hoursLines,
      snapshotHours: sourceSnapshot.hoursLines,
      clientId: writerClientId ?? undefined,
    })
    if (result.status === "unauthenticated") {
      setError("Sessão expirada. Atualize a página.")
      return
    }
    if (result.status === "error") {
      setError(result.message)
      return
    }
    patch({
      street: result.street,
      number: result.number || payload.number,
      complement: result.complement || payload.complement,
      neighborhood: result.neighborhood || payload.neighborhood,
      city: result.city || payload.city,
      stateCode: result.stateCode || payload.stateCode,
      postalCode: result.postalCode || payload.postalCode,
      formattedAddress:
        result.formattedAddress ||
        joinBrazilianAddress({
          street: result.street,
          number: result.number || payload.number,
          complement: result.complement || payload.complement,
          neighborhood: result.neighborhood || payload.neighborhood,
          city: result.city || payload.city,
          stateCode: result.stateCode || payload.stateCode,
          postalCode: result.postalCode || payload.postalCode,
        }),
      ...(result.hoursLines ? { hoursLines: result.hoursLines } : {}),
    })
  }

  function updateChannel(index: number, next: BriefingCompanyChannel) {
    const channels = payload.channels.map((channel, i) =>
      i === index ? next : channel,
    )
    patch({ channels: ensureWebsiteChannel(channels) })
  }

  function addSocialChannel() {
    if (payload.channels.length >= DIGITAL_CHANNELS_MAX) return
    patch({
      channels: [
        ...payload.channels,
        { type: "instagram", value: "" },
      ],
    })
  }

  function removeChannel(index: number) {
    const channel = payload.channels[index]
    if (!channel || channel.type === "website") return
    patch({
      channels: payload.channels.filter((_, i) => i !== index),
    })
  }

  function handleComplete() {
    if (!isCompanyReadyToComplete(payload)) return
    if (completedAt) {
      onContinue?.(completedAt)
      return
    }
    clearError()
    startComplete(async () => {
      if (!(await flushPending())) return
      const result = await completeBriefingCompany(
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

  const taxVariant = taxIdInputVariant(payload.taxId)
  const completed = Boolean(completedAt)
  const ready = isCompanyReadyToComplete(payload)
  const missingLabels = useMemo(
    () =>
      getCompanyMissingGroups(payload).map(
        (group) => COMPANY_MISSING_LABELS[group],
      ),
    [payload],
  )
  const socialChannels = payload.channels
    .map((channel, index) => ({ channel, index }))
    .filter(({ channel }) => channel.type !== "website")
  const websiteChannel = payload.channels.find(
    (channel) => channel.type === "website",
  )
  const websiteIndex = payload.channels.findIndex(
    (channel) => channel.type === "website",
  )

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <BriefingSectionCard
        icon={<RiBuilding4Line size={18} aria-hidden />}
        title="Identidade"
        description="Dados básicos da empresa e do responsável."
      >
        <Input
          id="briefing-company-name"
          label="Nome da empresa"
          value={payload.companyName}
          onChange={(event) => patch({ companyName: event.target.value })}
          leadingIcon={<RiBuilding4Line size={16} aria-hidden />}
        />
        <Input
          id="briefing-contact-name"
          label="Nome do responsável"
          value={payload.contactName}
          onChange={(event) => patch({ contactName: event.target.value })}
          leadingIcon={<RiUserLine size={16} aria-hidden />}
        />
        <Input
          id="briefing-tax-id"
          label="CNPJ ou CPF"
          variant={taxVariant === "cpf" ? "cpf" : "cnpj"}
          value={payload.taxId}
          onChange={(event) =>
            patch({ taxId: digitsOnly(event.target.value) })
          }
          leadingIcon={<RiFileList3Line size={16} aria-hidden />}
        />
      </BriefingSectionCard>

      <BriefingSectionCard
        icon={<RiMapPinLine size={18} aria-hidden />}
        title="Endereço"
        description="Busque pelo CEP ou pelo nome da rua."
      >
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <Input
            id="briefing-postal-code"
            label="CEP"
            variant="cep"
            value={formatPostalCode(payload.postalCode)}
            onChange={(event) => {
              setPostalStatus("idle")
              setPostalError(null)
              patchAddress({ postalCode: digitsOnly(event.target.value) })
            }}
            onBlur={() => {
              void handlePostalBlur()
            }}
            status={postalStatus}
            error={postalError ?? undefined}
            leadingIcon={<RiInboxLine size={16} aria-hidden />}
          />
          <BriefingAddressSearch
            id="briefing-street-search"
            value={payload.street}
            onValueChange={(street) => patchAddress({ street })}
            onPick={(item, sessionToken) => {
              void handlePlacePick(item.placeId, sessionToken)
            }}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <Input
            id="briefing-number"
            label="Número"
            value={payload.number}
            onChange={(event) => patchAddress({ number: event.target.value })}
            leadingIcon={<RiHashtag size={16} aria-hidden />}
          />
          <Input
            id="briefing-complement"
            label="Complemento (opcional)"
            value={payload.complement}
            onChange={(event) =>
              patchAddress({ complement: event.target.value })
            }
            leadingIcon={<RiHomeGearLine size={16} aria-hidden />}
          />
        </div>
        <Input
          id="briefing-neighborhood"
          label="Bairro"
          value={payload.neighborhood}
          onChange={(event) =>
            patchAddress({ neighborhood: event.target.value })
          }
          leadingIcon={<RiCommunityLine size={16} aria-hidden />}
        />
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <Input
            id="briefing-city"
            label="Cidade"
            value={payload.city}
            onChange={(event) => patchAddress({ city: event.target.value })}
            leadingIcon={<RiBuilding2Line size={16} aria-hidden />}
          />
          <Select
            id="briefing-state"
            label="UF"
            items={STATE_ITEMS}
            value={payload.stateCode}
            onValueChange={(value) =>
              patchAddress({
                stateCode: typeof value === "string" ? value : "",
              })
            }
            leadingIcon={<RiFlagLine size={16} aria-hidden />}
            searchable
            clearable
            placeholder="UF"
          />
        </div>
        <BriefingChipField
          id="briefing-served-areas"
          label="Bairros / cidades atendidos"
          values={payload.servedAreas}
          onChange={(servedAreas) => patch({ servedAreas })}
          placeholder="Digite e pressione Enter"
        />
      </BriefingSectionCard>

      <BriefingSectionCard
        icon={<RiPhoneLine size={18} aria-hidden />}
        title="Contato"
        description="Telefone, WhatsApp e e-mail principais."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            id="briefing-phone"
            label="Telefone principal"
            variant="phone"
            value={formatPhone(payload.phone)}
            onChange={(event) => patch({ phone: event.target.value })}
            leadingIcon={<RiPhoneLine size={16} aria-hidden />}
          />
          <Input
            id="briefing-whatsapp"
            label="WhatsApp"
            variant="phone"
            value={formatPhone(payload.whatsapp)}
            onChange={(event) => patch({ whatsapp: event.target.value })}
            leadingIcon={<RiWhatsappLine size={16} aria-hidden />}
          />
        </div>
        <Input
          id="briefing-email"
          label="E-mail de contato"
          variant="email"
          value={payload.email}
          onChange={(event) => patch({ email: event.target.value })}
          leadingIcon={<RiMailLine size={16} aria-hidden />}
        />
      </BriefingSectionCard>

      <BriefingSectionCard
        icon={<RiShareLine size={18} aria-hidden />}
        title="Presença digital"
        description="Horário, site e redes. Ajuste o que estiver diferente."
      >
        <BriefingHoursEditor
          id="briefing-hours"
          value={payload.hoursLines}
          onChange={(hoursLines) => patch({ hoursLines })}
        />

        <div className="flex flex-col gap-3">
          <p className="inline-flex items-center gap-1.5 font-sans text-body-sm font-medium text-fg-secondary">
            <RiGlobalLine size={14} aria-hidden className="text-accent" />
            Site
          </p>
          {websiteChannel && websiteIndex >= 0 ? (
            <Input
              id="briefing-website"
              label="Endereço do site"
              value={websiteChannel.value}
              placeholder={DIGITAL_CHANNEL_PLACEHOLDERS.website}
              onChange={(event) =>
                updateChannel(websiteIndex, {
                  type: "website",
                  value: event.target.value,
                })
              }
              leadingIcon={
                (() => {
                  const WebsiteIcon = CHANNEL_ICONS.website
                  return <WebsiteIcon size={16} aria-hidden />
                })()
              }
            />
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 font-sans text-body-sm font-medium text-fg-secondary">
              <RiGlobalLine size={14} aria-hidden className="text-accent" />
              Redes sociais
            </p>
            <Button
              type="button"
              variant="ghost"
              leadingIcon={<RiAddLine size={16} aria-hidden />}
              disabled={payload.channels.length >= DIGITAL_CHANNELS_MAX}
              onClick={addSocialChannel}
            >
              Adicionar
            </Button>
          </div>

          {socialChannels.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-4 text-center font-sans text-caption text-fg-muted">
              Nenhuma rede informada. Adicione se quiser.
            </p>
          ) : (
            socialChannels.map(({ channel, index }) => {
              const ChannelIcon = CHANNEL_ICONS[channel.type]
              return (
                <div
                  key={`channel-${index}`}
                  className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
                >
                  <Select
                    id={`briefing-channel-type-${index}`}
                    label={index === websiteIndex + 1 ? "Tipo" : undefined}
                    items={SOCIAL_TYPE_ITEMS}
                    value={channel.type}
                    onValueChange={(value) => {
                      const type =
                        typeof value === "string" && isSocialChannelType(value)
                          ? value
                          : (channel.type as SocialChannelType)
                      updateChannel(index, {
                        type: type as DigitalChannelType,
                        value: channel.value,
                      })
                    }}
                    searchable={false}
                  />
                  <Input
                    id={`briefing-channel-value-${index}`}
                    label={
                      index === websiteIndex + 1 ? "Link ou @perfil" : undefined
                    }
                    value={channel.value}
                    placeholder={DIGITAL_CHANNEL_PLACEHOLDERS[channel.type]}
                    onChange={(event) =>
                      updateChannel(index, {
                        ...channel,
                        value: event.target.value,
                      })
                    }
                    leadingIcon={<ChannelIcon size={16} aria-hidden />}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Remover canal"
                    onClick={() => removeChannel(index)}
                    className="sm:mb-0"
                    leadingIcon={<RiDeleteBinLine size={16} aria-hidden />}
                  >
                    Remover
                  </Button>
                </div>
              )
            })
          )}
        </div>
      </BriefingSectionCard>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 font-sans text-body-sm text-danger"
        >
          {errorMessage}
        </p>
      ) : null}

      {completed ? (
        <div className="rounded-xl border border-success/25 bg-success/10 px-4 py-3 font-sans text-body-sm text-success">
          Etapa concluída. Você pode continuar editando; as alterações seguem
          sendo salvas.
        </div>
      ) : null}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
        <div className="pointer-events-auto border-t border-border bg-canvas/90 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-[var(--page-padding-x)] py-3">
            <div className="min-w-0">
              <p className="inline-flex min-w-0 items-center gap-1.5 font-sans text-caption text-fg-muted">
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
                      className="text-danger"
                    />
                    Não foi possível salvar
                  </>
                ) : (
                  "Rascunho salvo automaticamente"
                )}
              </p>
              {!ready && missingLabels.length > 0 ? (
                <p className="mt-0.5 truncate font-sans text-caption text-fg-secondary">
                  Falta: {missingLabels.join(", ")}
                </p>
              ) : null}
            </div>
            {variant === "staff" ? null : (
            <Button
              type="button"
              disabled={isCompleting || !ready}
              onClick={handleComplete}
              trailingIcon={
                completed ? (
                  <RiCheckLine size={16} aria-hidden />
                ) : undefined
              }
            >
              {isCompleting
                ? "Salvando..."
                : completed
                  ? "Continuar"
                  : "Continuar"}
            </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
