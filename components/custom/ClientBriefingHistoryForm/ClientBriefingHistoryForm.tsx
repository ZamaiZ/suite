"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
import { LazyMotion, domAnimation } from "motion/react"
import {
  RiCheckLine,
  RiCloseLine,
  RiFlag2Line,
  RiHistoryLine,
  RiLoader4Line,
} from "react-icons/ri"
import {
  completeBriefingHistory,
  saveBriefingHistory,
} from "@/app/actions/briefing"
import { useBriefingAutosave } from "@/components/custom/BriefingAutosave"
import { BriefingSectionCard } from "@/components/custom/BriefingSectionCard"
import { Button } from "@/components/ui/Button"
import { Radio, RadioGroup } from "@/components/ui/RadioGroup"
import { Textarea } from "@/components/ui/Textarea"
import {
  getHistoryMissingGroups,
  HISTORY_ANSWER_IDS,
  HISTORY_MISSING_LABELS,
  isHistoryReadyToComplete,
  sanitizeHistoryPayload,
  type BriefingHistoryPayload,
  type HistoryAnswerId,
} from "@/lib/briefing/history"
import { formatTimeShort } from "@/lib/date-time"
import type { ClientBriefingHistoryFormProps } from "./ClientBriefingHistoryForm.types"

export function ClientBriefingHistoryForm({
  initialPayload,
  initialUpdatedAt,
  initialCompletedAt,
  onBack,
  onContinue,
}: ClientBriefingHistoryFormProps) {
  const [payload, setPayload] = useState<BriefingHistoryPayload>(() =>
    sanitizeHistoryPayload(initialPayload),
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
    saveBriefingHistory,
  )

  const patch = useCallback(
    (partial: Partial<BriefingHistoryPayload>) => {
      setPayload((current) => {
        const next = sanitizeHistoryPayload({ ...current, ...partial })
        scheduleSave(next)
        return next
      })
      clearError()
    },
    [clearError, scheduleSave],
  )

  const ready = isHistoryReadyToComplete(payload)
  const missingLabels = useMemo(
    () =>
      getHistoryMissingGroups(payload).map(
        (group) => HISTORY_MISSING_LABELS[group],
      ),
    [payload],
  )
  const completed = Boolean(completedAt)
  const showInvestmentDetails = payload.hasMarketingInvestment === "yes"
  const showDissatisfactionNotes =
    showInvestmentDetails && payload.hasProviderDissatisfaction === "yes"

  function handleComplete() {
    if (!ready) return
    clearError()
    startComplete(async () => {
      flushPending()
      const result = await completeBriefingHistory(payload)
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
          icon={<RiHistoryLine size={18} aria-hidden />}
          title="Experiências anteriores"
          description="Histórico de investimento em marketing e relação com prestadores."
        >
          <RadioGroup
            label="Já investiu em marketing?"
            orientation="horizontal"
            value={payload.hasMarketingInvestment ?? ""}
            onValueChange={(next) =>
              patch({
                hasMarketingInvestment: (HISTORY_ANSWER_IDS as readonly string[]).includes(
                  next,
                )
                  ? (next as HistoryAnswerId)
                  : null,
              })
            }
          >
            <Radio value="yes" label="Sim" />
            <Radio value="no" label="Não" />
          </RadioGroup>

          {showInvestmentDetails ? (
            <>
              <Textarea
                id="briefing-marketing-channels"
                label="Em que investiu?"
                rows={4}
                value={payload.marketingChannels}
                onChange={(event) =>
                  patch({ marketingChannels: event.target.value })
                }
                placeholder="Canais, campanhas ou ações em que já investiu…"
              />
              <Textarea
                id="briefing-marketing-results"
                label="Quais resultados teve?"
                rows={4}
                value={payload.marketingResults}
                onChange={(event) =>
                  patch({ marketingResults: event.target.value })
                }
                placeholder="O que funcionou, o que não funcionou, números se tiver…"
              />
              <RadioGroup
                label="Tinha algo que não te agradava no antigo prestador de serviço?"
                orientation="horizontal"
                value={payload.hasProviderDissatisfaction ?? ""}
                onValueChange={(next) =>
                  patch({
                    hasProviderDissatisfaction: (
                      HISTORY_ANSWER_IDS as readonly string[]
                    ).includes(next)
                      ? (next as HistoryAnswerId)
                      : null,
                  })
                }
              >
                <Radio value="yes" label="Sim" />
                <Radio value="no" label="Não" />
              </RadioGroup>
            </>
          ) : null}

          {showDissatisfactionNotes ? (
            <Textarea
              id="briefing-provider-dissatisfaction-notes"
              label="O que não agradava?"
              rows={4}
              value={payload.providerDissatisfactionNotes}
              onChange={(event) =>
                patch({ providerDissatisfactionNotes: event.target.value })
              }
              placeholder="Comunique, prazo, resultado, relacionamento…"
            />
          ) : null}
        </BriefingSectionCard>

        <BriefingSectionCard
          index={2}
          icon={<RiFlag2Line size={18} aria-hidden />}
          title="Expectativas"
          description="Objetivos do projeto e o que define uma parceria nota 10."
        >
          <Textarea
            id="briefing-project-goals"
            label="O que espera do projeto? Quais objetivos?"
            rows={5}
            value={payload.projectGoals}
            onChange={(event) => patch({ projectGoals: event.target.value })}
            placeholder="Resultados, prazos, prioridades…"
          />
          <Textarea
            id="briefing-nps-ten-criteria"
            label="O que precisa acontecer na prestação de serviço, além das metas, para que você nos dê uma nota 10 de NPS e nos indique futuramente para algum parceiro?"
            rows={5}
            value={payload.npsTenCriteria}
            onChange={(event) => patch({ npsTenCriteria: event.target.value })}
            placeholder="Comunicação, proatividade, clareza, suporte…"
          />
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
                      ? "Etapa concluída"
                      : "Continuar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </LazyMotion>
  )
}
