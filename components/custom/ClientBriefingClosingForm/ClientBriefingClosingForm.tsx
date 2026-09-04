"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
import { LazyMotion, domAnimation } from "motion/react"
import {
  RiCheckLine,
  RiCloseLine,
  RiLoader4Line,
  RiSpeakLine,
} from "react-icons/ri"
import {
  completeBriefingClosing,
  saveBriefingClosing,
} from "@/app/actions/briefing"
import { useBriefingAutosave } from "@/components/custom/BriefingAutosave"
import { BriefingSectionCard } from "@/components/custom/BriefingSectionCard"
import {
  attachBriefingClientId,
  useBriefingWriterClientId,
  useBriefingWriterFlushRegistration,
  useWrappedBriefingSave,
} from "@/components/custom/BriefingWriter"
import { Button } from "@/components/ui/Button"
import { Radio, RadioGroup } from "@/components/ui/RadioGroup"
import { Textarea } from "@/components/ui/Textarea"
import {
  CLOSING_ANSWER_IDS,
  CLOSING_MISSING_LABELS,
  getClosingMissingGroups,
  isClosingReadyToComplete,
  sanitizeClosingPayload,
  type BriefingClosingPayload,
  type ClosingAnswerId,
} from "@/lib/briefing/closing"
import { formatTimeShort } from "@/lib/date-time"
import type { ClientBriefingClosingFormProps } from "./ClientBriefingClosingForm.types"

export function ClientBriefingClosingForm({
  initialPayload,
  initialUpdatedAt,
  initialCompletedAt,
  variant = "portal",
  onBack,
  onFinalize,
}: ClientBriefingClosingFormProps) {
  const writerClientId = useBriefingWriterClientId()
  const persist = useWrappedBriefingSave(saveBriefingClosing)
  const [payload, setPayload] = useState<BriefingClosingPayload>(() =>
    sanitizeClosingPayload(initialPayload),
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
  } = useBriefingAutosave(
    initialUpdatedAt,
    initialCompletedAt,
    persist,
  )
  useBriefingWriterFlushRegistration(flushPending)

  const patch = useCallback(
    (partial: Partial<BriefingClosingPayload>) => {
      setPayload((current) => {
        const next = sanitizeClosingPayload({ ...current, ...partial })
        scheduleSave(next)
        return next
      })
      clearError()
    },
    [clearError, scheduleSave],
  )

  const ready = isClosingReadyToComplete(payload)
  const missingLabels = useMemo(
    () =>
      getClosingMissingGroups(payload).map(
        (group) => CLOSING_MISSING_LABELS[group],
      ),
    [payload],
  )
  const completed = Boolean(completedAt)
  const showAdditionalInfo = payload.hasAdditionalInfo === "yes"

  function handleFinalize() {
    if (!ready) return
    clearError()
    startComplete(async () => {
      if (!(await flushPending())) return
      const result = await completeBriefingClosing(
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
      if (result.completedAt) {
        const finalizedAt = result.finalizedAt ?? result.completedAt
        onFinalize?.(finalizedAt, result.completedAt)
      }
    })
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 pb-24">
        <BriefingSectionCard
          index={1}
          icon={<RiSpeakLine size={18} aria-hidden />}
          title="Considerações finais"
          description="Espaço livre para o que não coube nas etapas anteriores."
        >
          <RadioGroup
            label="Existe alguma outra informação não perguntada que é relevante que a gente saiba?"
            orientation="horizontal"
            value={payload.hasAdditionalInfo ?? ""}
            onValueChange={(next) =>
              patch({
                hasAdditionalInfo: (
                  CLOSING_ANSWER_IDS as readonly string[]
                ).includes(next)
                  ? (next as ClosingAnswerId)
                  : null,
              })
            }
          >
            <Radio value="yes" label="Sim" />
            <Radio value="no" label="Não" />
          </RadioGroup>

          {showAdditionalInfo ? (
            <Textarea
              id="briefing-additional-info"
              label="O que mais devemos saber?"
              rows={6}
              value={payload.additionalInfo}
              onChange={(event) =>
                patch({ additionalInfo: event.target.value })
              }
              placeholder="Contexto, preferências, restrições, prazos ou qualquer detalhe importante…"
            />
          ) : null}
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
            Briefing finalizado. Você pode continuar editando; as alterações
            ficam registradas para a equipe.
          </div>
        ) : null}

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
          <div className="pointer-events-auto border-t border-border bg-canvas/90 backdrop-blur-md">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-[var(--page-padding-x)] py-3">
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
                  onClick={handleFinalize}
                  trailingIcon={
                    completed ? (
                      <RiCheckLine size={16} aria-hidden />
                    ) : undefined
                  }
                >
                  {isCompleting
                    ? "Finalizando..."
                    : completed
                      ? "Etapa concluída"
                      : "Finalizar briefing"}
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
