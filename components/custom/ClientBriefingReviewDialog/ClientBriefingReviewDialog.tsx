"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  useReducedMotion,
} from "motion/react"
import * as m from "motion/react-m"
import {
  RiArrowLeftLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiLoader4Line,
} from "react-icons/ri"
import {
  loadStaffBriefingOverview,
  loadStaffBriefingStep,
  type StaffBriefingOverview,
  type StaffBriefingStepResult,
} from "@/app/actions/briefing"
import { BriefingReviewAccesses } from "@/components/custom/BriefingReviewAccesses"
import { BriefingReviewAudience } from "@/components/custom/BriefingReviewAudience"
import { BriefingReviewBrand } from "@/components/custom/BriefingReviewBrand"
import { BriefingReviewClosing } from "@/components/custom/BriefingReviewClosing"
import { BriefingReviewCompany } from "@/components/custom/BriefingReviewCompany"
import { BriefingReviewFinance } from "@/components/custom/BriefingReviewFinance"
import { BriefingReviewHistory } from "@/components/custom/BriefingReviewHistory"
import { BriefingReviewOverview } from "@/components/custom/BriefingReviewOverview"
import { BriefingReviewWebsite } from "@/components/custom/BriefingReviewWebsite"
import { Button } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import type { BriefingStepId } from "@/lib/briefing/steps"
import { cn } from "@/lib/cn"
import { formatDateTimeShort } from "@/lib/date-time"
import type { ClientBriefingReviewDialogProps } from "./ClientBriefingReviewDialog.types"

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1]

type OverviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; overview: StaffBriefingOverview }

type StepCache = Partial<
  Record<BriefingStepId, Extract<StaffBriefingStepResult, { status: "success" }>>
>

type StepLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready"
      data: Extract<StaffBriefingStepResult, { status: "success" }>
    }

const STATE_LABEL: Record<string, string> = {
  empty: "Não iniciado",
  in_progress: "Em andamento",
  completed: "Concluído",
}

export function ClientBriefingReviewDialog({
  open,
  onClose,
  clientId,
  companyName,
}: ClientBriefingReviewDialogProps) {
  const reduced = !!useReducedMotion()
  const requestIdRef = useRef(0)
  const stepRequestIdRef = useRef(0)
  const [overviewState, setOverviewState] = useState<OverviewState>({
    status: "idle",
  })
  const [activeStep, setActiveStep] = useState<BriefingStepId | null>(null)
  const [stepCache, setStepCache] = useState<StepCache>({})
  const [stepLoad, setStepLoad] = useState<StepLoadState>({ status: "idle" })
  const [direction, setDirection] = useState(1)

  const reset = useCallback(() => {
    setOverviewState({ status: "idle" })
    setActiveStep(null)
    setStepCache({})
    setStepLoad({ status: "idle" })
    setDirection(1)
  }, [])

  const loadOverview = useCallback(async (id: string) => {
    const requestId = ++requestIdRef.current
    setOverviewState({ status: "loading" })
    const result = await loadStaffBriefingOverview(id)
    if (requestId !== requestIdRef.current) return
    if (result.status === "error") {
      setOverviewState({ status: "error", message: result.message })
      return
    }
    setOverviewState({ status: "ready", overview: result.overview })
  }, [])

  useEffect(() => {
    if (!open || !clientId) {
      reset()
      return
    }
    setActiveStep(null)
    setStepCache({})
    setStepLoad({ status: "idle" })
    setDirection(1)
    void loadOverview(clientId)
  }, [open, clientId, loadOverview, reset])

  async function openStep(stepId: BriefingStepId) {
    if (!clientId) return
    setDirection(1)
    setActiveStep(stepId)
    const cached = stepCache[stepId]
    if (cached) {
      setStepLoad({ status: "ready", data: cached })
      return
    }
    const requestId = ++stepRequestIdRef.current
    setStepLoad({ status: "loading" })
    const result = await loadStaffBriefingStep(clientId, stepId)
    if (requestId !== stepRequestIdRef.current) return
    if (result.status === "error") {
      setStepLoad({ status: "error", message: result.message })
      return
    }
    setStepCache((current) => ({ ...current, [stepId]: result }))
    setStepLoad({ status: "ready", data: result })
  }

  function backToOverview() {
    setDirection(-1)
    setActiveStep(null)
    setStepLoad({ status: "idle" })
  }

  const overview =
    overviewState.status === "ready" ? overviewState.overview : null
  const title = overview?.companyName ?? companyName ?? "Briefing"
  const stepMeta = overview?.steps.find((step) => step.id === activeStep)

  const statusBadgeClass =
    overview?.status === "finalized"
      ? "bg-success/10 text-success"
      : overview?.status === "edited_after_submit"
        ? "bg-warning/10 text-warning"
        : "bg-fg-muted/10 text-fg-muted"

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description="Acompanhamento do briefing do cliente"
      size="xl"
      header={
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-subtle px-4 py-4 sm:px-5">
          <div className="min-w-0 flex-1">
            {activeStep && stepMeta ? (
              <div className="flex items-start gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="Voltar"
                  onClick={backToOverview}
                  className="mt-0.5 size-9 shrink-0 px-0"
                >
                  <RiArrowLeftLine size={18} aria-hidden />
                </Button>
                <div className="min-w-0">
                  <p className="truncate font-display text-title font-semibold text-fg">
                    {stepMeta.label}
                  </p>
                  <p className="mt-1 font-sans text-body-sm text-fg-muted">
                    {STATE_LABEL[stepMeta.state]}
                    {stepMeta.updatedAt
                      ? ` · ${formatDateTimeShort(stepMeta.updatedAt)}`
                      : ""}
                  </p>
                </div>
              </div>
            ) : (
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h2 className="truncate font-display text-title font-semibold text-fg">
                    {title}
                  </h2>
                  {overview ? (
                    <>
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-0.5 font-sans text-caption font-medium",
                          statusBadgeClass,
                        )}
                      >
                        {overview.statusLabel}
                      </span>
                      <span className="inline-flex rounded-md bg-canvas px-2 py-0.5 font-sans text-caption font-medium text-fg-secondary">
                        {overview.completedCount}/8
                      </span>
                    </>
                  ) : null}
                </div>
                <p className="mt-1 font-sans text-body-sm text-fg-muted">
                  Acompanhamento do briefing
                </p>
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            aria-label="Fechar"
            onClick={onClose}
            className="size-9 shrink-0 px-0"
          >
            <RiCloseLine size={18} aria-hidden />
          </Button>
        </div>
      }
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-5"
    >
      <LazyMotion features={domAnimation} strict>
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            {overviewState.status === "loading" ||
            overviewState.status === "idle" ? (
              <m.div
                key="overview-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="mb-4 h-6 w-48 animate-pulse rounded-md bg-hover" />
                <BriefingReviewOverview
                  steps={[]}
                  completedCount={0}
                  onSelectStep={() => {}}
                  loading
                />
              </m.div>
            ) : null}

            {overviewState.status === "error" ? (
              <m.div
                key="overview-error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                role="alert"
                className="flex flex-col items-start gap-3 rounded-xl border border-danger/25 bg-danger/10 px-4 py-5"
              >
                <div className="flex items-center gap-2 font-sans text-body-sm text-danger">
                  <RiErrorWarningLine size={18} aria-hidden />
                  {overviewState.message}
                </div>
                {clientId ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void loadOverview(clientId)}
                  >
                    Tentar novamente
                  </Button>
                ) : null}
              </m.div>
            ) : null}

            {overviewState.status === "ready" && !activeStep ? (
              <m.div
                key="overview"
                custom={direction}
                initial={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, x: direction > 0 ? -20 : 20 }
                }
                animate={{ opacity: 1, x: 0 }}
                exit={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, x: direction > 0 ? -20 : 20 }
                }
                transition={{ duration: reduced ? 0.12 : 0.28, ease: EASE }}
              >
                <BriefingReviewOverview
                  steps={overviewState.overview.steps}
                  completedCount={overviewState.overview.completedCount}
                  onSelectStep={openStep}
                />
              </m.div>
            ) : null}

            {activeStep ? (
              <m.div
                key={`step-${activeStep}`}
                custom={direction}
                initial={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, x: direction > 0 ? 24 : -24 }
                }
                animate={{ opacity: 1, x: 0 }}
                exit={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, x: direction > 0 ? -24 : 24 }
                }
                transition={{ duration: reduced ? 0.12 : 0.28, ease: EASE }}
                className="mx-auto w-full max-w-3xl"
              >
                {stepLoad.status === "loading" ? (
                  <div className="flex flex-col gap-3">
                    {Array.from({ length: 3 }, (_, index) => (
                      <div
                        key={index}
                        className="h-28 animate-pulse rounded-xl bg-hover"
                      />
                    ))}
                  </div>
                ) : null}
                {stepLoad.status === "error" ? (
                  <div
                    role="alert"
                    className="flex flex-col items-start gap-3 rounded-xl border border-danger/25 bg-danger/10 px-4 py-5"
                  >
                    <p className="font-sans text-body-sm text-danger">
                      {stepLoad.message}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void openStep(activeStep)}
                    >
                      Tentar novamente
                    </Button>
                  </div>
                ) : null}
                {stepLoad.status === "ready" ? (
                  stepLoad.data.meta.state === "empty" ? (
                    <p className="rounded-xl border border-border-subtle bg-surface/60 px-4 py-8 text-center font-sans text-body-sm text-fg-muted">
                      O cliente ainda não preencheu esta etapa.
                    </p>
                  ) : (
                    <StepBody clientId={clientId!} data={stepLoad.data} />
                  )
                ) : null}
                {stepLoad.status === "idle" ? (
                  <div className="flex items-center justify-center gap-2 py-16 font-sans text-body-sm text-fg-muted">
                    <RiLoader4Line
                      size={18}
                      aria-hidden
                      className="animate-spin"
                    />
                    Carregando…
                  </div>
                ) : null}
              </m.div>
            ) : null}
          </AnimatePresence>
        </div>
      </LazyMotion>
    </Dialog>
  )
}

function StepBody({
  clientId,
  data,
}: {
  clientId: string
  data: Extract<StaffBriefingStepResult, { status: "success" }>
}) {
  switch (data.step) {
    case "company":
      return <BriefingReviewCompany payload={data.payload} />
    case "brand":
      return <BriefingReviewBrand payload={data.payload} />
    case "audience":
      return <BriefingReviewAudience payload={data.payload} />
    case "history":
      return <BriefingReviewHistory payload={data.payload} />
    case "finance":
      return (
        <BriefingReviewFinance
          payload={data.payload}
          productName={data.productName}
          serviceName={data.serviceName}
        />
      )
    case "website":
      return (
        <BriefingReviewWebsite clientId={clientId} payload={data.payload} />
      )
    case "accesses":
      return (
        <BriefingReviewAccesses
          clientId={clientId}
          payload={data.payload}
          secretFlags={data.secretFlags}
        />
      )
    case "closing":
      return <BriefingReviewClosing payload={data.payload} />
  }
}
