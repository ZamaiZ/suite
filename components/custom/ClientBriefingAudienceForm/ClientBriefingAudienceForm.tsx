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
  RiMapPin2Line,
  RiMegaphoneLine,
  RiUserHeartLine,
} from "react-icons/ri"
import {
  completeBriefingAudience,
  geocodeBriefingAddress,
  saveBriefingAudience,
} from "@/app/actions/briefing"
import { useBriefingAutosave } from "@/components/custom/BriefingAutosave"
import { BriefingChipField } from "@/components/custom/BriefingChipField"
import { BriefingSectionCard } from "@/components/custom/BriefingSectionCard"
import { BriefingServiceRadiusMap } from "@/components/custom/BriefingServiceRadiusMap"
import {
  attachBriefingClientId,
  useBriefingWriterClientId,
  useBriefingWriterFlushRegistration,
  useWrappedBriefingSave,
} from "@/components/custom/BriefingWriter"
import { Button } from "@/components/ui/button"
import {
  BriefingCheckbox as Checkbox,
  BriefingRadio as Radio,
  BriefingRadioGroup as RadioGroup,
  BriefingSliderField as Slider,
  BriefingTextareaField as Textarea,
  BriefingTextField as Input,
} from "@/components/custom/BriefingFormControls/BriefingFormControls"
import {
  AUDIENCE_MISSING_LABELS,
  PERSONA_AGE_RANGE_IDS,
  PERSONA_AGE_RANGE_LABELS,
  PERSONA_INCOME_RANGE_IDS,
  PERSONA_INCOME_RANGE_LABELS,
  PERSONA_SEX_IDS,
  PERSONA_SEX_LABELS,
  SERVICE_RADIUS_KM_DEFAULT,
  SERVICE_RADIUS_KM_MAX,
  SERVICE_RADIUS_KM_MIN,
  getAudienceMissingGroups,
  isAudienceReadyToComplete,
  type BriefingAudiencePayload,
  type PersonaAgeRangeId,
  type PersonaIncomeRangeId,
  type PersonaSexId,
} from "@/lib/briefing/audience"
import { cn } from "cn"
import { formatTimeShort } from "@/lib/date-time"
import type { ClientBriefingAudienceFormProps } from "./ClientBriefingAudienceForm.types"

export function ClientBriefingAudienceForm({
  initialPayload,
  initialUpdatedAt,
  initialCompletedAt,
  companyCity,
  companyFormattedAddress,
  companyAddressKey,
  variant = "portal",
  onBack,
  onContinue,
}: ClientBriefingAudienceFormProps) {
  const writerClientId = useBriefingWriterClientId()
  const persist = useWrappedBriefingSave(saveBriefingAudience)
  const [payload, setPayload] =
    useState<BriefingAudiencePayload>(initialPayload)
  const [primaryDraft, setPrimaryDraft] = useState(
    initialPayload.primaryKeyword,
  )
  const [mapLoading, setMapLoading] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [mapAddressLabel, setMapAddressLabel] = useState(
    companyFormattedAddress,
  )
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

  const payloadRef = useRef(payload)
  payloadRef.current = payload
  const geocodeAttemptKeyRef = useRef<string | null>(null)

  const patch = useCallback(
    (partial: Partial<BriefingAudiencePayload>) => {
      setPayload((current) => {
        const next = { ...current, ...partial }
        scheduleSave(next)
        return next
      })
      clearError()
    },
    [clearError, scheduleSave],
  )

  const resolveMap = useCallback(async () => {
    if (payloadRef.current.serviceRadiusNotApplicable) return
    setMapLoading(true)
    setMapError(null)
    const result = await geocodeBriefingAddress(writerClientId ?? undefined)
    setMapLoading(false)

    if (result.status === "unauthenticated") {
      setMapError("Sessão expirada. Atualize a página.")
      return
    }
    if (result.status === "error") {
      setMapError(result.message)
      return
    }

    setMapAddressLabel(result.formattedAddress)
    const current = payloadRef.current
    if (
      result.latitude === current.mapLatitude &&
      result.longitude === current.mapLongitude &&
      result.addressKey === current.mapAddressKey
    ) {
      return
    }

    patch({
      mapLatitude: result.latitude,
      mapLongitude: result.longitude,
      mapAddressKey: result.addressKey,
    })
  }, [patch, writerClientId])

  useEffect(() => {
    if (payload.serviceRadiusNotApplicable) {
      geocodeAttemptKeyRef.current = null
      return
    }
    const needsGeocode =
      payload.mapLatitude === null ||
      payload.mapLongitude === null ||
      payload.mapAddressKey !== companyAddressKey
    if (!needsGeocode) {
      if (companyFormattedAddress) setMapAddressLabel(companyFormattedAddress)
      geocodeAttemptKeyRef.current = companyAddressKey
      return
    }
    if (geocodeAttemptKeyRef.current === companyAddressKey) return
    geocodeAttemptKeyRef.current = companyAddressKey
    void resolveMap()
  }, [
    companyAddressKey,
    companyFormattedAddress,
    payload.mapAddressKey,
    payload.mapLatitude,
    payload.mapLongitude,
    payload.serviceRadiusNotApplicable,
    resolveMap,
  ])

  const ready = isAudienceReadyToComplete(payload)
  const missingLabels = useMemo(
    () =>
      getAudienceMissingGroups(payload).map(
        (group) => AUDIENCE_MISSING_LABELS[group],
      ),
    [payload],
  )
  const completed = Boolean(completedAt)

  function toggleAgeRange(id: PersonaAgeRangeId, checked: boolean) {
    const personaAgeRanges = checked
      ? [...payload.personaAgeRanges.filter((item) => item !== id), id].sort(
          (left, right) =>
            PERSONA_AGE_RANGE_IDS.indexOf(left) -
            PERSONA_AGE_RANGE_IDS.indexOf(right),
        )
      : payload.personaAgeRanges.filter((item) => item !== id)
    patch({ personaAgeRanges })
  }

  function toggleIncomeRange(id: PersonaIncomeRangeId, checked: boolean) {
    const personaIncomeRanges = checked
      ? [...payload.personaIncomeRanges.filter((item) => item !== id), id].sort(
          (left, right) =>
            PERSONA_INCOME_RANGE_IDS.indexOf(left) -
            PERSONA_INCOME_RANGE_IDS.indexOf(right),
        )
      : payload.personaIncomeRanges.filter((item) => item !== id)
    patch({ personaIncomeRanges })
  }

  function commitPrimaryKeyword(raw: string) {
    const value = raw.trim()
    setPrimaryDraft(value)
    if (!value) {
      patch({ primaryKeyword: "" })
      return
    }
    const exists = payload.keywords.some(
      (item) => item.toLowerCase() === value.toLowerCase(),
    )
    const keywords = exists ? payload.keywords : [...payload.keywords, value]
    patch({ keywords, primaryKeyword: value })
  }

  function promoteKeyword(value: string) {
    setPrimaryDraft(value)
    patch({ primaryKeyword: value })
  }

  function handleComplete() {
    if (!ready) return
    clearError()
    startComplete(async () => {
      if (!(await flushPending())) return
      const result = await completeBriefingAudience(
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

  const citiesPlaceholder = companyCity.trim()
    ? `Ex.: ${companyCity.trim()}`
    : "Digite e pressione Enter"

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <BriefingSectionCard
          index={1}
          icon={<RiUserHeartLine size={18} aria-hidden />}
          title="Sobre a persona"
          description="Descreva o cliente ideal. Quanto mais específico, melhor o direcionamento."
        >
          <div className="flex flex-col gap-2">
            <p className="text-xs/relaxed font-medium text-muted-foreground">
              Faixa etária
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {PERSONA_AGE_RANGE_IDS.map((id) => (
                <Checkbox
                  key={id}
                  id={`briefing-age-${id}`}
                  label={PERSONA_AGE_RANGE_LABELS[id]}
                  checked={payload.personaAgeRanges.includes(id)}
                  onCheckedChange={(checked) => toggleAgeRange(id, checked)}
                />
              ))}
            </div>
          </div>

          <RadioGroup
            label="Sexo"
            orientation="horizontal"
            value={payload.personaSex ?? ""}
            onValueChange={(next) =>
              patch({
                personaSex: (PERSONA_SEX_IDS as readonly string[]).includes(
                  next,
                )
                  ? (next as PersonaSexId)
                  : null,
              })
            }
          >
            {PERSONA_SEX_IDS.map((id) => (
              <Radio key={id} value={id} label={PERSONA_SEX_LABELS[id]} />
            ))}
          </RadioGroup>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              id="briefing-persona-city"
              label="Cidade do cliente ideal"
              value={payload.personaCity}
              onChange={(event) => patch({ personaCity: event.target.value })}
            />
            <Input
              id="briefing-persona-profession"
              label="Profissão"
              value={payload.personaProfession}
              onChange={(event) =>
                patch({ personaProfession: event.target.value })
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs/relaxed font-medium text-muted-foreground">
              Renda média mensal
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3">
              {PERSONA_INCOME_RANGE_IDS.map((id) => (
                <Checkbox
                  key={id}
                  id={`briefing-income-${id}`}
                  label={PERSONA_INCOME_RANGE_LABELS[id]}
                  checked={payload.personaIncomeRanges.includes(id)}
                  onCheckedChange={(checked) => toggleIncomeRange(id, checked)}
                />
              ))}
            </div>
          </div>

          <BriefingChipField
            id="briefing-persona-pains"
            label="Dores"
            values={payload.personaPains}
            onChange={(personaPains) => patch({ personaPains })}
            placeholder="Digite e pressione Enter"
          />

          <BriefingChipField
            id="briefing-persona-behaviors"
            label="Comportamentos"
            values={payload.personaBehaviors}
            onChange={(personaBehaviors) => patch({ personaBehaviors })}
            placeholder="Digite e pressione Enter"
          />

          <Textarea
            id="briefing-persona-objections"
            label="Objeções mais comuns"
            rows={4}
            value={payload.personaObjections}
            onChange={(event) =>
              patch({ personaObjections: event.target.value })
            }
          />

          <Textarea
            id="briefing-persona-traits"
            label="Características importantes"
            rows={4}
            value={payload.personaTraits}
            onChange={(event) => patch({ personaTraits: event.target.value })}
          />

          <Textarea
            id="briefing-voice-tone"
            label="Tom de voz nos conteúdos"
            rows={4}
            value={payload.voiceTone}
            onChange={(event) => patch({ voiceTone: event.target.value })}
            placeholder="Ex.: próximo, técnico, descontraído…"
          />
        </BriefingSectionCard>

        <BriefingSectionCard
          index={2}
          icon={<RiMapPin2Line size={18} aria-hidden />}
          title="Localização e atuação"
          description="Onde vocês querem aparecer e atender — diferente de onde já atendem hoje."
        >
          <Checkbox
            id="briefing-radius-na"
            label="Atendimento sem raio físico"
            checked={payload.serviceRadiusNotApplicable}
            onCheckedChange={(checked) => {
              patch({ serviceRadiusNotApplicable: checked })
              if (!checked) {
                geocodeAttemptKeyRef.current = companyAddressKey
                void resolveMap()
              }
            }}
          />

          {!payload.serviceRadiusNotApplicable ? (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs/relaxed font-medium text-muted-foreground">
                    Raio de atendimento
                  </p>
                  <span className="text-xs/relaxed tabular-nums text-muted-foreground">
                    {payload.serviceRadiusKm} km
                  </span>
                </div>
                <Slider
                  id="briefing-service-radius"
                  min={SERVICE_RADIUS_KM_MIN}
                  max={SERVICE_RADIUS_KM_MAX}
                  step={1}
                  value={payload.serviceRadiusKm}
                  onValueChange={(value) => {
                    const next = Array.isArray(value) ? value[0] : value
                    patch({
                      serviceRadiusKm:
                        typeof next === "number"
                          ? next
                          : SERVICE_RADIUS_KM_DEFAULT,
                    })
                  }}
                />
              </div>

              <BriefingServiceRadiusMap
                latitude={payload.mapLatitude}
                longitude={payload.mapLongitude}
                radiusKm={payload.serviceRadiusKm}
                formattedAddress={mapAddressLabel}
                loading={mapLoading}
                errorMessage={mapError}
                onRetry={() => {
                  void resolveMap()
                }}
              />
            </>
          ) : null}

          <BriefingChipField
            id="briefing-target-neighborhoods"
            label="Bairros para aparecer no Google"
            values={payload.targetNeighborhoods}
            onChange={(targetNeighborhoods) => patch({ targetNeighborhoods })}
            placeholder="Opcional — digite e pressione Enter"
          />

          <BriefingChipField
            id="briefing-target-cities"
            label="Cidades para aparecer no Google"
            values={payload.targetCities}
            onChange={(targetCities) => patch({ targetCities })}
            placeholder={citiesPlaceholder}
          />

          <Input
            id="briefing-priority-region"
            label="Região prioridade para dominar"
            value={payload.priorityRegion}
            onChange={(event) => patch({ priorityRegion: event.target.value })}
          />

          <div className="flex flex-col gap-2">
            <BriefingChipField
              id="briefing-keywords"
              label="Palavras-chave"
              values={payload.keywords}
              onChange={(keywords) => {
                const primaryStillExists = keywords.some(
                  (item) =>
                    item.toLowerCase() ===
                    payload.primaryKeyword.trim().toLowerCase(),
                )
                patch({
                  keywords,
                  primaryKeyword: primaryStillExists
                    ? payload.primaryKeyword
                    : "",
                })
                if (!primaryStillExists) setPrimaryDraft("")
              }}
              placeholder="Digite e pressione Enter"
            />
            {payload.keywords.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {payload.keywords.map((item) => {
                  const selected =
                    item.toLowerCase() ===
                    payload.primaryKeyword.trim().toLowerCase()
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => promoteKeyword(item)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs/relaxed transition-colors",
                        selected
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-border bg-popover text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      {selected ? "Principal · " : "Definir principal · "}
                      {item}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>

          <Input
            id="briefing-primary-keyword"
            label="Palavra-chave principal"
            value={primaryDraft}
            onChange={(event) => setPrimaryDraft(event.target.value)}
            onBlur={() => commitPrimaryKeyword(primaryDraft)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                commitPrimaryKeyword(primaryDraft)
              }
            }}
            leadingIcon={<RiMegaphoneLine size={16} aria-hidden />}
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
