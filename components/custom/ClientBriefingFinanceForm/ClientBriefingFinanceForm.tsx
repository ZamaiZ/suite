"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { LazyMotion, domAnimation } from "motion/react"
import {
  RiCheckLine,
  RiCloseLine,
  RiMoneyDollarCircleLine,
  RiServiceLine,
} from "react-icons/ri"
import {
  completeBriefingFinance,
  saveBriefingFinance,
} from "@/app/actions/briefing"
import { useBriefingAutosave } from "@/components/custom/BriefingAutosave"
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  eligibleCatalogItems,
  FINANCE_MISSING_LABELS,
  getFinanceMissingGroups,
  isFinanceReadyToComplete,
  REVENUE_RANGE_IDS,
  REVENUE_RANGE_LABELS,
  sanitizeFinanceCatalogIds,
  SEASONALITY_PROFILE_DESCRIPTIONS,
  SEASONALITY_PROFILE_IDS,
  SEASONALITY_PROFILE_LABELS,
  type BriefingFinancePayload,
  type RevenueRangeId,
  type SeasonalityProfileId,
} from "@/lib/briefing/finance"
import { formatTimeShort } from "@/lib/date-time"
import type { ClientBriefingFinanceFormProps } from "./ClientBriefingFinanceForm.types"

export function ClientBriefingFinanceForm({
  initialPayload,
  initialUpdatedAt,
  initialCompletedAt,
  productsAndServices,
  variant = "portal",
  onBack,
  onContinue,
}: ClientBriefingFinanceFormProps) {
  const writerClientId = useBriefingWriterClientId()
  const persist = useWrappedBriefingSave(saveBriefingFinance)
  const [payload, setPayload] = useState<BriefingFinancePayload>(() =>
    sanitizeFinanceCatalogIds(initialPayload, productsAndServices),
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

  const patch = useCallback(
    (partial: Partial<BriefingFinancePayload>) => {
      setPayload((current) => {
        const next = sanitizeFinanceCatalogIds(
          { ...current, ...partial },
          productsAndServices,
        )
        scheduleSave(next)
        return next
      })
      clearError()
    },
    [clearError, productsAndServices, scheduleSave],
  )

  useEffect(() => {
    setPayload((current) => {
      const next = sanitizeFinanceCatalogIds(current, productsAndServices)
      if (
        next.highestProfitProductId === current.highestProfitProductId &&
        next.highestProfitServiceId === current.highestProfitServiceId
      ) {
        return current
      }
      scheduleSave(next)
      return next
    })
  }, [productsAndServices, scheduleSave])

  const eligible = useMemo(
    () => eligibleCatalogItems(productsAndServices),
    [productsAndServices],
  )
  const products = useMemo(
    () => eligible.filter((item) => item.kind === "product"),
    [eligible],
  )
  const services = useMemo(
    () => eligible.filter((item) => item.kind === "service"),
    [eligible],
  )

  const ready = isFinanceReadyToComplete(payload, productsAndServices)
  const missingLabels = useMemo(
    () =>
      getFinanceMissingGroups(payload, productsAndServices).map(
        (group) => FINANCE_MISSING_LABELS[group],
      ),
    [payload, productsAndServices],
  )
  const completed = Boolean(completedAt)
  const showSeasonalityNotes =
    payload.seasonalityProfile !== null &&
    payload.seasonalityProfile !== "predictable"

  function handleComplete() {
    if (!ready) return
    clearError()
    startComplete(async () => {
      if (!(await flushPending())) return
      const result = await completeBriefingFinance(
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
          icon={<RiMoneyDollarCircleLine size={18} aria-hidden />}
          title="Faturamento e sazonalidade"
          description="Ordens de grandeza e o ritmo do caixa ao longo do ano."
        >
          <BriefingChoiceCardGroup
            label="Quanto você fatura em média por mês atualmente?"
            value={payload.monthlyRevenueRange ?? ""}
            onValueChange={(next) =>
              patch({
                monthlyRevenueRange: (
                  REVENUE_RANGE_IDS as readonly string[]
                ).includes(next)
                  ? (next as RevenueRangeId)
                  : null,
              })
            }
            contentClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          >
            {REVENUE_RANGE_IDS.map((id) => (
              <BriefingChoiceCard
                key={id}
                value={id}
                title={REVENUE_RANGE_LABELS[id]}
              />
            ))}
          </BriefingChoiceCardGroup>

          <BriefingChoiceCardGroup
            label="Qual foi o seu maior pico de faturamento?"
            value={payload.peakRevenueRange ?? ""}
            onValueChange={(next) =>
              patch({
                peakRevenueRange: (
                  REVENUE_RANGE_IDS as readonly string[]
                ).includes(next)
                  ? (next as RevenueRangeId)
                  : null,
              })
            }
            contentClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          >
            {REVENUE_RANGE_IDS.map((id) => (
              <BriefingChoiceCard
                key={id}
                value={id}
                title={REVENUE_RANGE_LABELS[id]}
              />
            ))}
          </BriefingChoiceCardGroup>

          <Field>
            <FieldLabel htmlFor="briefing-peak-revenue-reason">
              Teve algum motivo específico?
            </FieldLabel>
            <Textarea
              id="briefing-peak-revenue-reason"
              rows={4}
              value={payload.peakRevenueReason}
              onChange={(event) =>
                patch({ peakRevenueReason: event.target.value })
              }
              placeholder="Ex.: campanha, sazonalidade, contrato pontual…"
            />
          </Field>

          <BriefingChoiceCardGroup
            label="Existe alguma sazonalidade que influencie o faturamento?"
            value={payload.seasonalityProfile ?? ""}
            onValueChange={(next) => {
              const seasonalityProfile = (
                SEASONALITY_PROFILE_IDS as readonly string[]
              ).includes(next)
                ? (next as SeasonalityProfileId)
                : null
              patch({
                seasonalityProfile,
                seasonalityNotes:
                  seasonalityProfile === "predictable"
                    ? ""
                    : payload.seasonalityNotes,
              })
            }}
            contentClassName="grid-cols-1 lg:grid-cols-3"
          >
            {SEASONALITY_PROFILE_IDS.map((id) => (
              <BriefingChoiceCard
                key={id}
                value={id}
                title={SEASONALITY_PROFILE_LABELS[id]}
                description={SEASONALITY_PROFILE_DESCRIPTIONS[id]}
              />
            ))}
          </BriefingChoiceCardGroup>

          {showSeasonalityNotes ? (
            <Field>
              <FieldLabel htmlFor="briefing-seasonality-notes">
                Quando e por quê?
              </FieldLabel>
              <Textarea
                id="briefing-seasonality-notes"
                rows={4}
                value={payload.seasonalityNotes}
                onChange={(event) =>
                  patch({ seasonalityNotes: event.target.value })
                }
                placeholder="Quais meses ou datas mais importam, e o que costuma acontecer?"
              />
            </Field>
          ) : null}
        </BriefingSectionCard>

        <BriefingSectionCard
          index={2}
          icon={<RiServiceLine size={18} aria-hidden />}
          title="Oferta e ticket"
          description="O que mais lucra hoje e o ticket médio da operação."
        >
          {eligible.length === 0 ? (
            <Empty className="rounded-xl border border-dashed border-border bg-popover/40 px-4 py-8">
              <EmptyHeader>
                <EmptyTitle>
                  Cadastre produtos ou serviços na etapa Marca
                </EmptyTitle>
                <EmptyDescription>
                  Volte e complete o catálogo para escolher o item de maior
                  lucro.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div
              className={
                products.length > 0 && services.length > 0
                  ? "grid gap-4 lg:grid-cols-2"
                  : "grid gap-4"
              }
            >
              {products.length > 0 ? (
                <BriefingChoiceCardGroup
                  label="Produto com maior porcentagem de lucro"
                  value={payload.highestProfitProductId ?? ""}
                  onValueChange={(next) =>
                    patch({ highestProfitProductId: next || null })
                  }
                  contentClassName="grid-cols-1"
                >
                  {products.map((item) => (
                    <BriefingChoiceCard
                      key={item.id}
                      value={item.id}
                      title={item.name}
                      description={item.description}
                    />
                  ))}
                </BriefingChoiceCardGroup>
              ) : null}

              {services.length > 0 ? (
                <BriefingChoiceCardGroup
                  label="Serviço com maior porcentagem de lucro"
                  value={payload.highestProfitServiceId ?? ""}
                  onValueChange={(next) =>
                    patch({ highestProfitServiceId: next || null })
                  }
                  contentClassName="grid-cols-1"
                >
                  {services.map((item) => (
                    <BriefingChoiceCard
                      key={item.id}
                      value={item.id}
                      title={item.name}
                      description={item.description}
                    />
                  ))}
                </BriefingChoiceCardGroup>
              ) : null}
            </div>
          )}

          <BriefingChoiceCardGroup
            label="Qual é o ticket médio atual?"
            value={payload.averageTicketRange ?? ""}
            onValueChange={(next) =>
              patch({
                averageTicketRange: (
                  REVENUE_RANGE_IDS as readonly string[]
                ).includes(next)
                  ? (next as RevenueRangeId)
                  : null,
              })
            }
            contentClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          >
            {REVENUE_RANGE_IDS.map((id) => (
              <BriefingChoiceCard
                key={id}
                value={id}
                title={REVENUE_RANGE_LABELS[id]}
              />
            ))}
          </BriefingChoiceCardGroup>
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
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-[var(--page-padding-x)] py-3">
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
