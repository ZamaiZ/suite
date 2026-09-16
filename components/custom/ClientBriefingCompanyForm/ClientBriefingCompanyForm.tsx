"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
import {
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
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import type { BriefingAddressCandidate } from "@/lib/locationiq"
import {
  digitsOnly,
  formatCnpj,
  formatCpf,
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
  } = useBriefingAutosave(initialUpdatedAt, initialCompletedAt, persist)
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

  /**
   * Síncrona: não há mais chamada.
   *
   * O `applyBriefingPlace` existia para buscar os detalhes do Places depois da
   * sugestão. O autocomplete do LocationIQ já traz o endereço estruturado, e o
   * candidato escolhido carrega tudo que o formulário precisa.
   *
   * **O horário não entra mais.** O LocationIQ não devolve horário de
   * funcionamento; com perfil do Google vinculado ele continua vindo do
   * snapshot, que é a fonte melhor, e sem perfil fica para o cliente preencher.
   */
  function handlePlacePick(candidate: BriefingAddressCandidate) {
    const { address } = candidate
    // O LocationIQ devolve o estado por extenso ("São Paulo"), e o formulário
    // grava a sigla. `sensitivity: "base"` casa com e sem acento.
    const stateCode =
      BR_STATES.find(
        (state) =>
          state.name.localeCompare(address.stateName, "pt-BR", {
            sensitivity: "base",
          }) === 0,
      )?.code ?? ""

    const next = {
      street: address.street || payload.street,
      number: address.number || payload.number,
      complement: payload.complement,
      neighborhood: address.neighborhood || payload.neighborhood,
      city: address.city || payload.city,
      stateCode: stateCode || payload.stateCode,
      postalCode: address.postalCode || payload.postalCode,
    }
    patch({ ...next, formattedAddress: joinBrazilianAddress(next) })
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
      channels: [...payload.channels, { type: "instagram", value: "" }],
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
        <Field>
          <FieldLabel htmlFor="briefing-company-name">
            Nome da empresa
          </FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <RiBuilding4Line size={16} aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              id="briefing-company-name"
              value={payload.companyName}
              onChange={(event) => patch({ companyName: event.target.value })}
            />
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="briefing-contact-name">
            Nome do responsável
          </FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <RiUserLine size={16} aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              id="briefing-contact-name"
              value={payload.contactName}
              onChange={(event) => patch({ contactName: event.target.value })}
            />
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="briefing-tax-id">CNPJ ou CPF</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <RiFileList3Line size={16} aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              id="briefing-tax-id"
              inputMode="numeric"
              value={
                taxVariant === "cpf"
                  ? formatCpf(payload.taxId)
                  : formatCnpj(payload.taxId)
              }
              onChange={(event) =>
                patch({ taxId: digitsOnly(event.target.value) })
              }
            />
          </InputGroup>
        </Field>
      </BriefingSectionCard>

      <BriefingSectionCard
        icon={<RiMapPinLine size={18} aria-hidden />}
        title="Endereço"
        description="Busque pelo CEP ou pelo nome da rua."
      >
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <Field data-invalid={Boolean(postalError)}>
            <FieldLabel htmlFor="briefing-postal-code">CEP</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <RiInboxLine size={16} aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                id="briefing-postal-code"
                inputMode="numeric"
                value={formatPostalCode(payload.postalCode)}
                onChange={(event) => {
                  setPostalStatus("idle")
                  setPostalError(null)
                  patchAddress({ postalCode: digitsOnly(event.target.value) })
                }}
                onBlur={() => {
                  void handlePostalBlur()
                }}
                aria-busy={postalStatus === "loading" || undefined}
                aria-invalid={Boolean(postalError)}
                aria-describedby={
                  postalError ? "briefing-postal-code-error" : undefined
                }
              />
              {postalStatus !== "idle" ? (
                <InputGroupAddon align="inline-end">
                  {postalStatus === "loading" ? (
                    <Spinner aria-hidden className="size-3.5" />
                  ) : null}
                  {postalStatus === "success" ? (
                    <RiCheckLine aria-hidden className="text-primary" />
                  ) : null}
                  {postalStatus === "error" ? (
                    <RiCloseLine aria-hidden className="text-destructive" />
                  ) : null}
                </InputGroupAddon>
              ) : null}
            </InputGroup>
            {postalError ? (
              <FieldError id="briefing-postal-code-error">
                {postalError}
              </FieldError>
            ) : null}
          </Field>
          <BriefingAddressSearch
            id="briefing-street-search"
            value={payload.street}
            onValueChange={(street) => patchAddress({ street })}
            onPick={handlePlacePick}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <Field>
            <FieldLabel htmlFor="briefing-number">Número</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <RiHashtag size={16} aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                id="briefing-number"
                value={payload.number}
                onChange={(event) =>
                  patchAddress({ number: event.target.value })
                }
              />
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="briefing-complement">
              Complemento (opcional)
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <RiHomeGearLine size={16} aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                id="briefing-complement"
                value={payload.complement}
                onChange={(event) =>
                  patchAddress({ complement: event.target.value })
                }
              />
            </InputGroup>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="briefing-neighborhood">Bairro</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <RiCommunityLine size={16} aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              id="briefing-neighborhood"
              value={payload.neighborhood}
              onChange={(event) =>
                patchAddress({ neighborhood: event.target.value })
              }
            />
          </InputGroup>
        </Field>
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <Field>
            <FieldLabel htmlFor="briefing-city">Cidade</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <RiBuilding2Line size={16} aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                id="briefing-city"
                value={payload.city}
                onChange={(event) => patchAddress({ city: event.target.value })}
              />
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="briefing-state">UF</FieldLabel>
            <Combobox
              items={STATE_ITEMS}
              value={
                STATE_ITEMS.find((item) => item.value === payload.stateCode) ??
                null
              }
              onValueChange={(item) =>
                patchAddress({ stateCode: item?.value ?? "" })
              }
              itemToStringLabel={(item) => item.label}
              isItemEqualToValue={(item, selected) =>
                item.value === selected.value
              }
            >
              <ComboboxInput
                id="briefing-state"
                placeholder="UF"
                showClear
                className="w-full"
              >
                <InputGroupAddon align="inline-start">
                  <RiFlagLine size={16} aria-hidden />
                </InputGroupAddon>
              </ComboboxInput>
              <ComboboxContent>
                <ComboboxEmpty>Nenhum estado encontrado.</ComboboxEmpty>
                <ComboboxList>
                  {STATE_ITEMS.map((item) => (
                    <ComboboxItem key={item.value} value={item}>
                      <span className="flex min-w-0 flex-col">
                        <span>{item.label}</span>
                        <span className="text-muted-foreground">
                          {item.description}
                        </span>
                      </span>
                    </ComboboxItem>
                  ))}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </Field>
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
          <Field>
            <FieldLabel htmlFor="briefing-phone">Telefone principal</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <RiPhoneLine size={16} aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                id="briefing-phone"
                type="tel"
                inputMode="tel"
                value={formatPhone(payload.phone)}
                onChange={(event) => patch({ phone: event.target.value })}
              />
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="briefing-whatsapp">WhatsApp</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <RiWhatsappLine size={16} aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                id="briefing-whatsapp"
                type="tel"
                inputMode="tel"
                value={formatPhone(payload.whatsapp)}
                onChange={(event) => patch({ whatsapp: event.target.value })}
              />
            </InputGroup>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="briefing-email">E-mail de contato</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <RiMailLine size={16} aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              id="briefing-email"
              type="email"
              value={payload.email}
              onChange={(event) => patch({ email: event.target.value })}
            />
          </InputGroup>
        </Field>
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
          <p className="inline-flex items-center gap-1.5 text-xs/relaxed font-medium text-muted-foreground">
            <RiGlobalLine size={14} aria-hidden className="text-primary" />
            Site
          </p>
          {websiteChannel && websiteIndex >= 0 ? (
            <Field>
              <FieldLabel htmlFor="briefing-website">
                Endereço do site
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  {(() => {
                    const WebsiteIcon = CHANNEL_ICONS.website
                    return <WebsiteIcon size={16} aria-hidden />
                  })()}
                </InputGroupAddon>
                <InputGroupInput
                  id="briefing-website"
                  value={websiteChannel.value}
                  placeholder={DIGITAL_CHANNEL_PLACEHOLDERS.website}
                  onChange={(event) =>
                    updateChannel(websiteIndex, {
                      type: "website",
                      value: event.target.value,
                    })
                  }
                />
              </InputGroup>
            </Field>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-xs/relaxed font-medium text-muted-foreground">
              <RiGlobalLine size={14} aria-hidden className="text-primary" />
              Redes sociais
            </p>
            <Button
              type="button"
              variant="ghost"
              disabled={payload.channels.length >= DIGITAL_CHANNELS_MAX}
              onClick={addSocialChannel}
            >
              <RiAddLine size={16} aria-hidden data-icon="inline-start" />
              Adicionar
            </Button>
          </div>

          {socialChannels.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs/relaxed text-muted-foreground">
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
                  <Field>
                    {index === websiteIndex + 1 ? (
                      <FieldLabel htmlFor={`briefing-channel-type-${index}`}>
                        Tipo
                      </FieldLabel>
                    ) : null}
                    <Select
                      items={SOCIAL_TYPE_ITEMS}
                      value={channel.type}
                      onValueChange={(value) => {
                        const type =
                          typeof value === "string" &&
                          isSocialChannelType(value)
                            ? value
                            : (channel.type as SocialChannelType)
                        updateChannel(index, {
                          type: type as DigitalChannelType,
                          value: channel.value,
                        })
                      }}
                    >
                      <SelectTrigger
                        id={`briefing-channel-type-${index}`}
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SOCIAL_TYPE_ITEMS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.icon}
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    {index === websiteIndex + 1 ? (
                      <FieldLabel htmlFor={`briefing-channel-value-${index}`}>
                        Link ou @perfil
                      </FieldLabel>
                    ) : null}
                    <InputGroup>
                      <InputGroupAddon>
                        <ChannelIcon size={16} aria-hidden />
                      </InputGroupAddon>
                      <InputGroupInput
                        id={`briefing-channel-value-${index}`}
                        value={channel.value}
                        placeholder={DIGITAL_CHANNEL_PLACEHOLDERS[channel.type]}
                        onChange={(event) =>
                          updateChannel(index, {
                            ...channel,
                            value: event.target.value,
                          })
                        }
                      />
                    </InputGroup>
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Remover canal"
                    onClick={() => removeChannel(index)}
                    className="sm:mb-0"
                  >
                    <RiDeleteBinLine
                      size={16}
                      aria-hidden
                      data-icon="inline-start"
                    />
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

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-sticky">
        <div className="pointer-events-auto border-t border-border bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-[var(--page-padding-x)] py-3">
            <div className="min-w-0">
              <p className="inline-flex min-w-0 items-center gap-1.5 text-xs/relaxed text-muted-foreground">
                {saveState === "saving" || isCompleting ? (
                  <>
                    <Spinner aria-hidden className="size-3.5" />
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
            {variant === "staff" ? null : (
              <Button
                type="button"
                disabled={isCompleting || !ready}
                onClick={handleComplete}
              >
                {isCompleting
                  ? "Salvando..."
                  : completed
                    ? "Continuar"
                    : "Continuar"}
                {completed ? (
                  <RiCheckLine size={16} aria-hidden data-icon="inline-end" />
                ) : null}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
