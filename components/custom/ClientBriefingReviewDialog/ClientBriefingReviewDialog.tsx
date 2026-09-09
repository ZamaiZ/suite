"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  useReducedMotion,
} from "motion/react"
import * as m from "motion/react-m"
import { RiErrorWarningLine } from "react-icons/ri"
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
import { ClientBriefingExport } from "@/components/custom/ClientBriefingExport"
import {
  BriefingWriterProvider,
  type BriefingWriterFlush,
} from "@/components/custom/BriefingWriter"
import { ClientBriefingAccessesForm } from "@/components/custom/ClientBriefingAccessesForm"
import { ClientBriefingAudienceForm } from "@/components/custom/ClientBriefingAudienceForm"
import { ClientBriefingBrandForm } from "@/components/custom/ClientBriefingBrandForm"
import { ClientBriefingClosingForm } from "@/components/custom/ClientBriefingClosingForm"
import { ClientBriefingCompanyForm } from "@/components/custom/ClientBriefingCompanyForm"
import { ClientBriefingFinanceForm } from "@/components/custom/ClientBriefingFinanceForm"
import { ClientBriefingHistoryForm } from "@/components/custom/ClientBriefingHistoryForm"
import { ClientBriefingWebsiteForm } from "@/components/custom/ClientBriefingWebsiteForm"
import { ClientKickoffPanel } from "@/components/custom/ClientKickoffPanel"
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  companyAddressFingerprint,
  companyFormattedAddress,
} from "@/lib/briefing/geocode-address"
import { emptyCompanyPayload } from "@/lib/briefing/company"
import { briefingStepsToInvalidateAfterStaffEdit } from "@/lib/briefing/staff-step-cache"
import type { BriefingStepId } from "@/lib/briefing/steps"
import { ClientBriefingContentHeader } from "./ClientBriefingContentHeader"
import { ClientBriefingDialogHeader } from "./ClientBriefingDialogHeader"
import {
  ClientBriefingNavigationRail,
  type ClientBriefingArea,
} from "./ClientBriefingNavigationRail"
import type { ClientBriefingReviewDialogProps } from "./ClientBriefingReviewDialog.types"

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1]

type OverviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; overview: StaffBriefingOverview }

type StepCache = Partial<
  Record<
    BriefingStepId,
    Extract<StaffBriefingStepResult, { status: "success" }>
  >
>

type StepLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready"
      data: Extract<StaffBriefingStepResult, { status: "success" }>
    }

export function ClientBriefingReviewDialog({
  open,
  onClose,
  clientId,
  companyName,
  readOnly = false,
}: ClientBriefingReviewDialogProps) {
  const reduced = !!useReducedMotion()
  const requestIdRef = useRef(0)
  const stepRequestIdRef = useRef(0)
  const editorFlushRef = useRef<BriefingWriterFlush | null>(null)
  const [overviewState, setOverviewState] = useState<OverviewState>({
    status: "idle",
  })
  const [activeStep, setActiveStep] = useState<BriefingStepId | null>(null)
  const [stepCache, setStepCache] = useState<StepCache>({})
  const [stepLoad, setStepLoad] = useState<StepLoadState>({ status: "idle" })
  const [direction, setDirection] = useState(1)
  const [editing, setEditing] = useState(false)
  const [isFinishingEdit, setIsFinishingEdit] = useState(false)
  const [area, setArea] = useState<ClientBriefingArea>("briefing")

  const reset = useCallback(() => {
    setOverviewState({ status: "idle" })
    setActiveStep(null)
    setStepCache({})
    setStepLoad({ status: "idle" })
    setDirection(1)
    setEditing(false)
    setIsFinishingEdit(false)
    setArea("briefing")
    editorFlushRef.current = null
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
    setEditing(false)
    setIsFinishingEdit(false)
    setArea("briefing")
    editorFlushRef.current = null
    void loadOverview(clientId)
  }, [open, clientId, loadOverview, reset])

  async function openStep(stepId: BriefingStepId) {
    if (!clientId) return
    setDirection(1)
    setActiveStep(stepId)
    setEditing(false)
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

  async function backToOverview() {
    if (editing && !(await stopEdit())) return
    setDirection(-1)
    setActiveStep(null)
    setStepLoad({ status: "idle" })
    setEditing(false)
  }

  async function startEdit() {
    if (readOnly) return
    if (!clientId || !activeStep) return
    if (activeStep === "audience" && !stepCache.company) {
      const result = await loadStaffBriefingStep(clientId, "company")
      if (result.status === "success") {
        setStepCache((current) => ({ ...current, company: result }))
      }
    }
    editorFlushRef.current = null
    setEditing(true)
  }

  async function stopEdit(): Promise<boolean> {
    if (!clientId || !activeStep) {
      setEditing(false)
      return true
    }
    setIsFinishingEdit(true)
    const saved = await (editorFlushRef.current?.() ?? Promise.resolve(true))
    setIsFinishingEdit(false)
    if (!saved) {
      return false
    }
    setEditing(false)
    const invalidatedSteps = briefingStepsToInvalidateAfterStaffEdit(activeStep)
    setStepCache((current) => {
      const next = { ...current }
      for (const step of invalidatedSteps) delete next[step]
      return next
    })
    const requestId = ++stepRequestIdRef.current
    setStepLoad({ status: "loading" })
    const result = await loadStaffBriefingStep(clientId, activeStep)
    if (requestId !== stepRequestIdRef.current) return false
    if (result.status === "error") {
      setStepLoad({ status: "error", message: result.message })
      return false
    }
    setStepCache((current) => ({ ...current, [activeStep]: result }))
    setStepLoad({ status: "ready", data: result })
    void loadOverview(clientId)
    return true
  }

  async function closeDialog() {
    if (isFinishingEdit) return
    if (editing && !(await stopEdit())) return
    onClose()
  }

  function selectArea(next: ClientBriefingArea) {
    if (editing || isFinishingEdit || (next === "contact" && !canUseContact)) {
      return
    }
    setArea(next)
    if (next === "contact") {
      setActiveStep(null)
      setStepLoad({ status: "idle" })
    }
  }

  const overview =
    overviewState.status === "ready" ? overviewState.overview : null
  const title = overview?.companyName ?? companyName ?? "Briefing"
  const stepMeta = overview?.steps.find((step) => step.id === activeStep)

  const canEditBriefing =
    !readOnly &&
    (overview?.status === "finalized" ||
      overview?.status === "edited_after_submit")
  const canUseContact = true
  const statusTone =
    overview?.status === "finalized"
      ? "success"
      : overview?.status === "edited_after_submit"
        ? "warning"
        : "muted"

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) void closeDialog()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-3xl p-0"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Acompanhamento do briefing do cliente
          </DialogDescription>
        </DialogHeader>
        <ClientBriefingDialogHeader
          companyName={title}
          statusLabel={overview?.statusLabel}
          statusTone={statusTone}
          completedCount={overview?.completedCount}
          closeDisabled={isFinishingEdit}
          onClose={() => void closeDialog()}
        />
        <BriefingWriterProvider clientId={clientId} flushRef={editorFlushRef}>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
            <ClientBriefingNavigationRail
              companyName={title}
              completedCount={overview?.completedCount ?? 0}
              area={area}
              activeStep={activeStep}
              steps={overview?.steps ?? []}
              contactEnabled={canUseContact}
              disabled={editing || isFinishingEdit}
              onAreaChange={selectArea}
              onStepSelect={openStep}
            />
            <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <ClientBriefingContentHeader
                area={area}
                step={stepMeta}
                editing={editing}
                editAvailable={Boolean(
                  activeStep && canEditBriefing && stepLoad.status === "ready",
                )}
                busy={isFinishingEdit}
                onBackToOverview={() => void backToOverview()}
                onEditToggle={() => {
                  if (editing) void stopEdit()
                  else void startEdit()
                }}
              />
              <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                {area === "contact" ? (
                  <div className="mx-auto w-full max-w-3xl">
                    <ClientKickoffPanel clientId={clientId!} />
                  </div>
                ) : (
                  <AnimatePresence
                    mode="wait"
                    custom={direction}
                    initial={false}
                  >
                    {overviewState.status === "loading" ||
                    overviewState.status === "idle" ? (
                      <m.div
                        key="overview-loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <Skeleton className="mb-4 h-6 w-48 rounded-md" />
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
                        className="flex flex-col items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-5"
                      >
                        <div className="flex items-center gap-2 text-xs/relaxed text-destructive">
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
                        transition={{
                          duration: reduced ? 0.12 : 0.28,
                          ease: EASE,
                        }}
                      >
                        {!readOnly ? (
                          <ClientBriefingExport
                            clientId={overviewState.overview.clientId}
                            finalizedAt={overviewState.overview.finalizedAt}
                            contentUpdatedAt={
                              overviewState.overview.contentUpdatedAt
                            }
                          />
                        ) : null}
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
                        transition={{
                          duration: reduced ? 0.12 : 0.28,
                          ease: EASE,
                        }}
                        className="mx-auto w-full max-w-3xl"
                      >
                        {stepLoad.status === "loading" ? (
                          <div className="flex flex-col gap-3">
                            {Array.from({ length: 3 }, (_, index) => (
                              <Skeleton
                                key={index}
                                className="h-28 rounded-xl"
                              />
                            ))}
                          </div>
                        ) : null}
                        {stepLoad.status === "error" ? (
                          <div
                            role="alert"
                            className="flex flex-col items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-5"
                          >
                            <p className="text-xs/relaxed text-destructive">
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
                          stepLoad.data.meta.state === "empty" && !editing ? (
                            <Empty className="rounded-xl border border-border/70 bg-card/60 px-4 py-8">
                              <EmptyHeader>
                                <EmptyDescription>
                                  O cliente ainda não preencheu esta etapa.
                                </EmptyDescription>
                              </EmptyHeader>
                            </Empty>
                          ) : (
                            <StepBody
                              clientId={clientId!}
                              data={stepLoad.data}
                              editing={editing}
                              readOnly={readOnly}
                              companyPayload={
                                stepCache.company &&
                                stepCache.company.step === "company"
                                  ? stepCache.company.payload
                                  : emptyCompanyPayload()
                              }
                            />
                          )
                        ) : null}
                        {stepLoad.status === "idle" ? (
                          <div className="flex items-center justify-center gap-2 py-16 text-xs/relaxed text-muted-foreground">
                            <Spinner aria-hidden className="size-4.5" />
                            Carregando…
                          </div>
                        ) : null}
                      </m.div>
                    ) : null}
                  </AnimatePresence>
                )}
              </div>
            </section>
          </div>
        </BriefingWriterProvider>
      </DialogContent>
    </Dialog>
  )
}

function StepBody({
  clientId,
  data,
  editing,
  readOnly,
  companyPayload,
}: {
  clientId: string
  data: Extract<StaffBriefingStepResult, { status: "success" }>
  editing: boolean
  readOnly: boolean
  companyPayload: ReturnType<typeof emptyCompanyPayload>
}) {
  if (editing) {
    switch (data.step) {
      case "company":
        return (
          <ClientBriefingCompanyForm
            initialPayload={data.payload}
            sourceSnapshot={data.sourceSnapshot}
            initialUpdatedAt={data.meta.updatedAt}
            initialCompletedAt={data.meta.completedAt}
            variant="staff"
          />
        )
      case "brand":
        return (
          <ClientBriefingBrandForm
            initialPayload={data.payload}
            initialUpdatedAt={data.meta.updatedAt}
            initialCompletedAt={data.meta.completedAt}
            variant="staff"
          />
        )
      case "audience":
        return (
          <ClientBriefingAudienceForm
            initialPayload={data.payload}
            initialUpdatedAt={data.meta.updatedAt}
            initialCompletedAt={data.meta.completedAt}
            companyCity={companyPayload.city}
            companyFormattedAddress={companyFormattedAddress(companyPayload)}
            companyAddressKey={companyAddressFingerprint(companyPayload)}
            variant="staff"
          />
        )
      case "history":
        return (
          <ClientBriefingHistoryForm
            initialPayload={data.payload}
            initialUpdatedAt={data.meta.updatedAt}
            initialCompletedAt={data.meta.completedAt}
            variant="staff"
          />
        )
      case "finance":
        return (
          <ClientBriefingFinanceForm
            initialPayload={data.payload}
            initialUpdatedAt={data.meta.updatedAt}
            initialCompletedAt={data.meta.completedAt}
            productsAndServices={data.productsAndServices}
            variant="staff"
          />
        )
      case "website":
        return (
          <ClientBriefingWebsiteForm
            initialPayload={data.payload}
            initialUpdatedAt={data.meta.updatedAt}
            initialCompletedAt={data.meta.completedAt}
            variant="staff"
          />
        )
      case "accesses":
        return (
          <ClientBriefingAccessesForm
            initialPayload={data.payload}
            initialSecretFlags={data.secretFlags}
            initialUpdatedAt={data.meta.updatedAt}
            initialCompletedAt={data.meta.completedAt}
            variant="staff"
          />
        )
      case "closing":
        return (
          <ClientBriefingClosingForm
            initialPayload={data.payload}
            initialUpdatedAt={data.meta.updatedAt}
            initialCompletedAt={data.meta.completedAt}
            variant="staff"
          />
        )
    }
  }

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
        <BriefingReviewWebsite
          clientId={clientId}
          payload={data.payload}
          canOpenAssets={!readOnly}
        />
      )
    case "accesses":
      return (
        <BriefingReviewAccesses
          clientId={clientId}
          payload={data.payload}
          secretFlags={data.secretFlags}
          canRevealSecrets={!readOnly}
        />
      )
    case "closing":
      return <BriefingReviewClosing payload={data.payload} />
  }
}
