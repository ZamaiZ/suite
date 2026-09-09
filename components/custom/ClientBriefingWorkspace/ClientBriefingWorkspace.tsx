"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  useReducedMotion,
} from "motion/react"
import * as m from "motion/react-m"
import { RiErrorWarningLine } from "react-icons/ri"
import {
  loadBriefingAccesses,
  loadBriefingAudience,
  loadBriefingBrand,
  loadBriefingClosing,
  loadBriefingCompany,
  loadBriefingFinance,
  loadBriefingHistory,
  loadBriefingMeta,
  loadBriefingWebsite,
} from "@/app/actions/briefing"
import { ClientBriefingAccessesForm } from "@/components/custom/ClientBriefingAccessesForm"
import { ClientBriefingAudienceForm } from "@/components/custom/ClientBriefingAudienceForm"
import { ClientBriefingBrandForm } from "@/components/custom/ClientBriefingBrandForm"
import { ClientBriefingClosingForm } from "@/components/custom/ClientBriefingClosingForm"
import { ClientBriefingCompleteScreen } from "@/components/custom/ClientBriefingCompleteScreen"
import { ClientBriefingCompanyForm } from "@/components/custom/ClientBriefingCompanyForm"
import { ClientBriefingFinanceForm } from "@/components/custom/ClientBriefingFinanceForm"
import { ClientBriefingHistoryForm } from "@/components/custom/ClientBriefingHistoryForm"
import { ClientBriefingWebsiteForm } from "@/components/custom/ClientBriefingWebsiteForm"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { Stepper } from "@/components/custom/Stepper"
import {
  companyAddressFingerprint,
  companyFormattedAddress,
} from "@/lib/briefing/geocode-address"
import { deriveBriefingListStatus } from "@/lib/briefing/status"
import { BRIEFING_STEPS } from "@/lib/briefing/steps"
import type {
  BriefingWorkspacePhase,
  ClientBriefingWorkspaceProps,
} from "./ClientBriefingWorkspace.types"

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1]

type CompanyReady = {
  payload: import("@/lib/briefing/company").BriefingCompanyPayload
  sourceSnapshot: import("@/lib/briefing/company").BriefingCompanyPayload
  updatedAt: string | null
  completedAt: string | null
}

type BrandReady = {
  payload: import("@/lib/briefing/brand").BriefingBrandPayload
  updatedAt: string | null
  completedAt: string | null
}

type AudienceReady = {
  payload: import("@/lib/briefing/audience").BriefingAudiencePayload
  updatedAt: string | null
  completedAt: string | null
}

type HistoryReady = {
  payload: import("@/lib/briefing/history").BriefingHistoryPayload
  updatedAt: string | null
  completedAt: string | null
}

type FinanceReady = {
  payload: import("@/lib/briefing/finance").BriefingFinancePayload
  updatedAt: string | null
  completedAt: string | null
}

type WebsiteReady = {
  payload: import("@/lib/briefing/website").BriefingWebsitePayload
  updatedAt: string | null
  completedAt: string | null
}

type AccessesReady = {
  payload: import("@/lib/briefing/accesses").BriefingAccessesPayload
  secretFlags: import("@/lib/briefing/accesses").BriefingSecretFlags
  updatedAt: string | null
  completedAt: string | null
}

type ClosingReady = {
  payload: import("@/lib/briefing/closing").BriefingClosingPayload
  updatedAt: string | null
  completedAt: string | null
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready"
      company: CompanyReady
      brand: BrandReady
      audience: AudienceReady
      history: HistoryReady
      finance: FinanceReady
      website: WebsiteReady
      accesses: AccessesReady
      closing: ClosingReady
      finalizedAt: string | null
      contentUpdatedAt: string | null
    }

const STEP_COPY = [
  {
    title: "Sobre a empresa",
    description:
      "Confirme e complete os dados. O rascunho salva sozinho; preencha tudo para avançar.",
  },
  {
    title: "Sobre a marca e serviços",
    description:
      "Conte como vendem, o que oferecem e como o time funciona. Quanto mais detalhe, melhor.",
  },
  {
    title: "Sobre a persona e atuação",
    description:
      "Descreva o cliente ideal e onde querem aparecer. O rascunho salva sozinho; preencha tudo para avançar.",
  },
  {
    title: "Histórico e metas",
    description:
      "Experiências anteriores e o que esperam do projeto. O rascunho salva sozinho; preencha tudo para avançar.",
  },
  {
    title: "Sobre o financeiro",
    description:
      "Faturamento, sazonalidade e o que mais lucra. O rascunho salva sozinho; preencha tudo para avançar.",
  },
  {
    title: "Criação do website",
    description:
      "Identidade visual, cores e referências de sites. O rascunho salva sozinho; preencha tudo para avançar.",
  },
  {
    title: "Acessos",
    description:
      "Painéis, convites e credenciais necessários para o projeto. O rascunho salva sozinho; preencha tudo para avançar.",
  },
  {
    title: "Considerações finais",
    description:
      "Última etapa. Se houver algo que não perguntamos, conte aqui e finalize o briefing.",
  },
] as const

export function ClientBriefingWorkspace({
  companyName,
  onPhaseChange,
}: ClientBriefingWorkspaceProps) {
  const reduced = !!useReducedMotion()
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" })
  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [phase, setPhaseState] = useState<BriefingWorkspacePhase | null>(null)

  function updatePhase(next: BriefingWorkspacePhase) {
    setPhaseState(next)
    onPhaseChange?.(next)
  }

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      loadBriefingCompany(),
      loadBriefingBrand(),
      loadBriefingAudience(),
      loadBriefingHistory(),
      loadBriefingFinance(),
      loadBriefingWebsite(),
      loadBriefingAccesses(),
      loadBriefingClosing(),
      loadBriefingMeta(),
    ]).then(
      ([
        companyResult,
        brandResult,
        audienceResult,
        historyResult,
        financeResult,
        websiteResult,
        accessesResult,
        closingResult,
        metaResult,
      ]) => {
        if (cancelled) return
        if (
          companyResult.status === "unauthenticated" ||
          brandResult.status === "unauthenticated" ||
          audienceResult.status === "unauthenticated" ||
          historyResult.status === "unauthenticated" ||
          financeResult.status === "unauthenticated" ||
          websiteResult.status === "unauthenticated" ||
          accessesResult.status === "unauthenticated" ||
          closingResult.status === "unauthenticated" ||
          metaResult.status === "unauthenticated"
        ) {
          setLoadState({
            status: "error",
            message: "Sessão expirada. Atualize a página e entre novamente.",
          })
          return
        }
        if (companyResult.status === "error") {
          setLoadState({ status: "error", message: companyResult.message })
          return
        }
        if (brandResult.status === "error") {
          setLoadState({ status: "error", message: brandResult.message })
          return
        }
        if (audienceResult.status === "error") {
          setLoadState({ status: "error", message: audienceResult.message })
          return
        }
        if (historyResult.status === "error") {
          setLoadState({ status: "error", message: historyResult.message })
          return
        }
        if (financeResult.status === "error") {
          setLoadState({ status: "error", message: financeResult.message })
          return
        }
        if (websiteResult.status === "error") {
          setLoadState({ status: "error", message: websiteResult.message })
          return
        }
        if (accessesResult.status === "error") {
          setLoadState({ status: "error", message: accessesResult.message })
          return
        }
        if (closingResult.status === "error") {
          setLoadState({ status: "error", message: closingResult.message })
          return
        }
        if (metaResult.status === "error") {
          setLoadState({ status: "error", message: metaResult.message })
          return
        }

        const companyCompleted = Boolean(companyResult.completedAt)
        const brandCompleted = Boolean(brandResult.completedAt)
        const audienceCompleted = Boolean(audienceResult.completedAt)
        const historyCompleted = Boolean(historyResult.completedAt)
        const financeCompleted = Boolean(financeResult.completedAt)
        const websiteCompleted = Boolean(websiteResult.completedAt)
        const accessesCompleted = Boolean(accessesResult.completedAt)
        const closingCompleted = Boolean(closingResult.completedAt)

        setLoadState({
          status: "ready",
          company: {
            payload: companyResult.payload,
            sourceSnapshot: companyResult.sourceSnapshot,
            updatedAt: companyResult.updatedAt,
            completedAt: companyResult.completedAt,
          },
          brand: {
            payload: brandResult.payload,
            updatedAt: brandResult.updatedAt,
            completedAt: brandResult.completedAt,
          },
          audience: {
            payload: audienceResult.payload,
            updatedAt: audienceResult.updatedAt,
            completedAt: audienceResult.completedAt,
          },
          history: {
            payload: historyResult.payload,
            updatedAt: historyResult.updatedAt,
            completedAt: historyResult.completedAt,
          },
          finance: {
            payload: financeResult.payload,
            updatedAt: financeResult.updatedAt,
            completedAt: financeResult.completedAt,
          },
          website: {
            payload: websiteResult.payload,
            updatedAt: websiteResult.updatedAt,
            completedAt: websiteResult.completedAt,
          },
          accesses: {
            payload: accessesResult.payload,
            secretFlags: accessesResult.secretFlags,
            updatedAt: accessesResult.updatedAt,
            completedAt: accessesResult.completedAt,
          },
          closing: {
            payload: closingResult.payload,
            updatedAt: closingResult.updatedAt,
            completedAt: closingResult.completedAt,
          },
          finalizedAt: metaResult.finalizedAt,
          contentUpdatedAt: metaResult.contentUpdatedAt,
        })

        if (metaResult.finalizedAt) {
          setPhaseState("complete")
          onPhaseChange?.("complete")
          setStepIndex(7)
          return
        }

        setPhaseState("wizard")
        onPhaseChange?.("wizard")

        if (!companyCompleted) setStepIndex(0)
        else if (!brandCompleted) setStepIndex(1)
        else if (!audienceCompleted) setStepIndex(2)
        else if (!historyCompleted) setStepIndex(3)
        else if (!financeCompleted) setStepIndex(4)
        else if (!websiteCompleted) setStepIndex(5)
        else if (!accessesCompleted) setStepIndex(6)
        else if (!closingCompleted) setStepIndex(7)
        else setStepIndex(7)
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (loadState.status === "error") {
      setPhaseState("wizard")
      onPhaseChange?.("wizard")
    }
  }, [loadState.status, onPhaseChange])

  const highestReachedIndex = useMemo(() => {
    if (loadState.status !== "ready") return 0
    if (!loadState.company.completedAt) return 0
    if (!loadState.brand.completedAt) return 1
    if (!loadState.audience.completedAt) return 2
    if (!loadState.history.completedAt) return 3
    if (!loadState.finance.completedAt) return 4
    if (!loadState.website.completedAt) return 5
    if (!loadState.accesses.completedAt) return 6
    if (!loadState.closing.completedAt) return 7
    return 7
  }, [loadState])

  const editedAfterSubmit = useMemo(() => {
    if (loadState.status !== "ready") return false
    return (
      deriveBriefingListStatus(
        loadState.finalizedAt,
        loadState.contentUpdatedAt,
      ) === "edited_after_submit"
    )
  }, [loadState])

  function goToStep(nextIndex: number) {
    if (nextIndex === stepIndex) return
    if (nextIndex > highestReachedIndex) return
    setDirection(nextIndex > stepIndex ? 1 : -1)
    setStepIndex(nextIndex)
  }

  function markCompanyCompleted(completedAt: string) {
    setLoadState((current) => {
      if (current.status !== "ready") return current
      return {
        ...current,
        company: { ...current.company, completedAt },
      }
    })
  }

  function markBrandCompleted(completedAt: string) {
    setLoadState((current) => {
      if (current.status !== "ready") return current
      return {
        ...current,
        brand: { ...current.brand, completedAt },
      }
    })
  }

  function markAudienceCompleted(completedAt: string) {
    setLoadState((current) => {
      if (current.status !== "ready") return current
      return {
        ...current,
        audience: { ...current.audience, completedAt },
      }
    })
  }

  function markHistoryCompleted(completedAt: string) {
    setLoadState((current) => {
      if (current.status !== "ready") return current
      return {
        ...current,
        history: { ...current.history, completedAt },
      }
    })
  }

  function markFinanceCompleted(completedAt: string) {
    setLoadState((current) => {
      if (current.status !== "ready") return current
      return {
        ...current,
        finance: { ...current.finance, completedAt },
      }
    })
  }

  function markWebsiteCompleted(completedAt: string) {
    setLoadState((current) => {
      if (current.status !== "ready") return current
      return {
        ...current,
        website: { ...current.website, completedAt },
      }
    })
  }

  function markAccessesCompleted(completedAt: string) {
    setLoadState((current) => {
      if (current.status !== "ready") return current
      return {
        ...current,
        accesses: { ...current.accesses, completedAt },
      }
    })
  }

  function markClosingFinalized(finalizedAt: string, completedAt: string) {
    setLoadState((current) => {
      if (current.status !== "ready") return current
      return {
        ...current,
        closing: { ...current.closing, completedAt },
        finalizedAt: current.finalizedAt ?? finalizedAt,
      }
    })
    updatePhase("complete")
  }

  const sectionEnter = reduced ? { opacity: 0 } : { opacity: 0, y: 8 }
  const sectionVisible = reduced ? { opacity: 1 } : { opacity: 1, y: 0 }
  const stepCopy = STEP_COPY[stepIndex] ?? STEP_COPY[0]
  const showWizard = phase === "wizard" || phase === "editing"
  const isEditing = phase === "editing"
  const isBooting = phase === null && loadState.status === "loading"

  const slideVariants = {
    enter: (dir: number) =>
      reduced ? { opacity: 0 } : { opacity: 0, x: dir > 0 ? 28 : -28 },
    center: { opacity: 1, x: 0 },
    exit: (dir: number) =>
      reduced ? { opacity: 0 } : { opacity: 0, x: dir > 0 ? -28 : 28 },
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="flex flex-col gap-5">
        <AnimatePresence mode="wait" initial={false}>
          {isBooting || (loadState.status === "loading" && phase === null) ? (
            <m.div
              key="booting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mx-auto flex w-full max-w-3xl items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-16 text-xs/relaxed text-muted-foreground shadow-xs"
            >
              <Spinner aria-hidden className="size-4.5" />
              Carregando seus dados…
            </m.div>
          ) : null}

          {loadState.status === "error" ? (
            <m.div
              key="error-root"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="mx-auto w-full max-w-3xl rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-5 text-xs/relaxed text-destructive"
            >
              {loadState.message}
            </m.div>
          ) : null}

          {phase === "complete" && loadState.status === "ready" ? (
            <m.div
              key="complete-phase"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: reduced ? 0.12 : 0.35, ease: EASE }}
            >
              <ClientBriefingCompleteScreen
                companyName={companyName}
                editedAfterSubmit={editedAfterSubmit}
                onEdit={() => updatePhase("editing")}
              />
            </m.div>
          ) : null}

          {showWizard ? (
            <m.div
              key="wizard-phase"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: reduced ? 0.12 : 0.32, ease: EASE }}
              className="flex flex-col gap-5"
            >
              <m.div
                initial={sectionEnter}
                animate={sectionVisible}
                transition={{ duration: reduced ? 0.12 : 0.28, ease: EASE }}
                className="mx-auto flex w-full max-w-3xl flex-col gap-3"
              >
                <div>
                  <p className="text-xs/relaxed font-medium tracking-wide text-muted-foreground uppercase">
                    {companyName}
                  </p>
                  <AnimatePresence mode="wait" initial={false}>
                    <m.div
                      key={stepIndex}
                      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
                      transition={{
                        duration: reduced ? 0.1 : 0.22,
                        ease: EASE,
                      }}
                    >
                      <p className="mt-1 text-xs/relaxed font-semibold text-foreground">
                        {stepCopy.title}
                      </p>
                      <p className="mt-1 text-xs/relaxed text-muted-foreground">
                        {stepCopy.description}
                      </p>
                    </m.div>
                  </AnimatePresence>
                </div>
                <Stepper
                  steps={[...BRIEFING_STEPS]}
                  currentIndex={stepIndex}
                  highestReachedIndex={highestReachedIndex}
                  onStepSelect={goToStep}
                />
              </m.div>

              {isEditing ? (
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs/relaxed font-semibold text-foreground">
                      Briefing já enviado
                    </p>
                    <p className="mt-1 text-xs/relaxed leading-relaxed text-muted-foreground">
                      Alterações ficam registradas para a equipe.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => {
                      void loadBriefingMeta().then((meta) => {
                        if (meta.status === "success") {
                          setLoadState((current) => {
                            if (current.status !== "ready") return current
                            return {
                              ...current,
                              finalizedAt: meta.finalizedAt,
                              contentUpdatedAt: meta.contentUpdatedAt,
                            }
                          })
                        }
                        updatePhase("complete")
                      })
                    }}
                  >
                    Voltar ao resumo
                  </Button>
                </div>
              ) : (
                <m.div
                  initial={sectionEnter}
                  animate={sectionVisible}
                  transition={{
                    duration: reduced ? 0.12 : 0.3,
                    ease: EASE,
                    delay: reduced ? 0 : 0.06,
                  }}
                  className="mx-auto flex w-full max-w-3xl gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-xs"
                >
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <RiErrorWarningLine size={16} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs/relaxed font-semibold text-foreground">
                      Complete para avançar
                    </p>
                    <p className="mt-1 text-xs/relaxed leading-relaxed text-muted-foreground">
                      O rascunho é salvo automaticamente. O botão Continuar
                      libera quando todos os campos obrigatórios estiverem
                      preenchidos.
                    </p>
                  </div>
                </m.div>
              )}

              <AnimatePresence mode="wait" initial={false} custom={direction}>
                {loadState.status === "loading" ? (
                  <m.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mx-auto flex w-full max-w-3xl items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-16 text-xs/relaxed text-muted-foreground shadow-xs"
                  >
                    <Spinner aria-hidden className="size-4.5" />
                    Carregando seus dados…
                  </m.div>
                ) : null}

                {loadState.status === "error" ? (
                  <m.div
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    role="alert"
                    className="mx-auto w-full max-w-3xl rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-5 text-xs/relaxed text-destructive"
                  >
                    {loadState.message}
                  </m.div>
                ) : null}

                {loadState.status === "ready" && stepIndex === 0 ? (
                  <m.div
                    key="company"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      duration: reduced ? 0.12 : 0.32,
                      ease: EASE,
                    }}
                  >
                    <ClientBriefingCompanyForm
                      initialPayload={loadState.company.payload}
                      sourceSnapshot={loadState.company.sourceSnapshot}
                      initialUpdatedAt={loadState.company.updatedAt}
                      initialCompletedAt={loadState.company.completedAt}
                      onContinue={(completedAt) => {
                        markCompanyCompleted(completedAt)
                        setDirection(1)
                        setStepIndex(1)
                      }}
                    />
                  </m.div>
                ) : null}

                {loadState.status === "ready" && stepIndex === 1 ? (
                  <m.div
                    key="brand"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      duration: reduced ? 0.12 : 0.32,
                      ease: EASE,
                    }}
                  >
                    <ClientBriefingBrandForm
                      initialPayload={loadState.brand.payload}
                      initialUpdatedAt={loadState.brand.updatedAt}
                      initialCompletedAt={loadState.brand.completedAt}
                      onBack={() => goToStep(0)}
                      onContinue={(completedAt) => {
                        markBrandCompleted(completedAt)
                        setDirection(1)
                        setStepIndex(2)
                      }}
                    />
                  </m.div>
                ) : null}

                {loadState.status === "ready" && stepIndex === 2 ? (
                  <m.div
                    key="audience"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      duration: reduced ? 0.12 : 0.32,
                      ease: EASE,
                    }}
                  >
                    <ClientBriefingAudienceForm
                      initialPayload={loadState.audience.payload}
                      initialUpdatedAt={loadState.audience.updatedAt}
                      initialCompletedAt={loadState.audience.completedAt}
                      companyCity={loadState.company.payload.city}
                      companyFormattedAddress={companyFormattedAddress(
                        loadState.company.payload,
                      )}
                      companyAddressKey={companyAddressFingerprint(
                        loadState.company.payload,
                      )}
                      onBack={() => goToStep(1)}
                      onContinue={(completedAt) => {
                        markAudienceCompleted(completedAt)
                        setDirection(1)
                        setStepIndex(3)
                      }}
                    />
                  </m.div>
                ) : null}

                {loadState.status === "ready" && stepIndex === 3 ? (
                  <m.div
                    key="history"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      duration: reduced ? 0.12 : 0.32,
                      ease: EASE,
                    }}
                  >
                    <ClientBriefingHistoryForm
                      initialPayload={loadState.history.payload}
                      initialUpdatedAt={loadState.history.updatedAt}
                      initialCompletedAt={loadState.history.completedAt}
                      onBack={() => goToStep(2)}
                      onContinue={(completedAt) => {
                        markHistoryCompleted(completedAt)
                        setDirection(1)
                        setStepIndex(4)
                      }}
                    />
                  </m.div>
                ) : null}

                {loadState.status === "ready" && stepIndex === 4 ? (
                  <m.div
                    key="finance"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      duration: reduced ? 0.12 : 0.32,
                      ease: EASE,
                    }}
                  >
                    <ClientBriefingFinanceForm
                      initialPayload={loadState.finance.payload}
                      initialUpdatedAt={loadState.finance.updatedAt}
                      initialCompletedAt={loadState.finance.completedAt}
                      productsAndServices={
                        loadState.brand.payload.productsAndServices
                      }
                      onBack={() => goToStep(3)}
                      onContinue={(completedAt) => {
                        markFinanceCompleted(completedAt)
                        setDirection(1)
                        setStepIndex(5)
                      }}
                    />
                  </m.div>
                ) : null}

                {loadState.status === "ready" && stepIndex === 5 ? (
                  <m.div
                    key="website"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      duration: reduced ? 0.12 : 0.32,
                      ease: EASE,
                    }}
                  >
                    <ClientBriefingWebsiteForm
                      initialPayload={loadState.website.payload}
                      initialUpdatedAt={loadState.website.updatedAt}
                      initialCompletedAt={loadState.website.completedAt}
                      onBack={() => goToStep(4)}
                      onContinue={(completedAt) => {
                        markWebsiteCompleted(completedAt)
                        setDirection(1)
                        setStepIndex(6)
                      }}
                    />
                  </m.div>
                ) : null}

                {loadState.status === "ready" && stepIndex === 6 ? (
                  <m.div
                    key="accesses"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      duration: reduced ? 0.12 : 0.32,
                      ease: EASE,
                    }}
                  >
                    <ClientBriefingAccessesForm
                      initialPayload={loadState.accesses.payload}
                      initialSecretFlags={loadState.accesses.secretFlags}
                      initialUpdatedAt={loadState.accesses.updatedAt}
                      initialCompletedAt={loadState.accesses.completedAt}
                      onBack={() => goToStep(5)}
                      onContinue={(completedAt) => {
                        markAccessesCompleted(completedAt)
                        setDirection(1)
                        setStepIndex(7)
                      }}
                    />
                  </m.div>
                ) : null}

                {loadState.status === "ready" && stepIndex === 7 ? (
                  <m.div
                    key="closing"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      duration: reduced ? 0.12 : 0.32,
                      ease: EASE,
                    }}
                  >
                    <ClientBriefingClosingForm
                      initialPayload={loadState.closing.payload}
                      initialUpdatedAt={loadState.closing.updatedAt}
                      initialCompletedAt={loadState.closing.completedAt}
                      onBack={() => goToStep(6)}
                      onFinalize={(finalizedAt, completedAt) => {
                        markClosingFinalized(finalizedAt, completedAt)
                      }}
                    />
                  </m.div>
                ) : null}
              </AnimatePresence>
            </m.div>
          ) : null}
        </AnimatePresence>
      </div>
    </LazyMotion>
  )
}
