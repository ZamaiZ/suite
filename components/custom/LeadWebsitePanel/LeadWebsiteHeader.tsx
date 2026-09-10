"use client"

import { useState } from "react"
import { useReducedMotion } from "motion/react"
import { RiArrowUpSLine } from "react-icons/ri"
import { StepTabs } from "@/components/custom/LeadStepShell"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "cn"
import {
  WEBSITE_STEP_TABS,
  type WebsiteStepTabId,
} from "@/lib/leads/website-step-tabs"
import { LeadWebsiteIdentityCell } from "./LeadWebsiteIdentityCell"
import { LeadWebsiteMetricCells } from "./LeadWebsiteMetricCells"
import { LeadWebsiteStepHeader } from "./LeadWebsiteStepHeader"
import type { WebsiteController } from "./use-website-controller"

const NUMBERS_KEY = "website:header-numbers"
const NUMBERS_ID = "website-header-numbers"

/**
 * Primeira linha do grid da coluna central, fora da área de scroll: identidade
 * e números ficam à vista enquanto o analista percorre as abas.
 */
export function LeadWebsiteHeader({
  controller,
  readingMode,
  tab,
  counts,
  onSelectTab,
}: {
  controller: WebsiteController
  readingMode: boolean
  tab: WebsiteStepTabId
  counts: Record<WebsiteStepTabId, number>
  onSelectTab: (tab: WebsiteStepTabId) => void
}) {
  const reduced = !!useReducedMotion()
  const [numbersOpen, setNumbersOpen] = useState(() => {
    if (typeof window === "undefined") return true
    return window.localStorage.getItem(NUMBERS_KEY) !== "closed"
  })

  function toggleNumbers() {
    setNumbersOpen((current) => {
      const next = !current
      window.localStorage.setItem(NUMBERS_KEY, next ? "open" : "closed")
      return next
    })
  }

  const { error, jobsActive, pollTimedOut, jobsKey, failedJobs } = controller
  const showFailed = controller.psiFailedWithoutReady
  const hasNotices =
    Boolean(error) ||
    jobsActive ||
    (pollTimedOut && Boolean(jobsKey)) ||
    showFailed

  return (
    <div className="border-b border-border/70 bg-background px-5 pt-4">
      <LeadWebsiteStepHeader
        updatedAt={controller.audit?.fetched_at ?? null}
        siteHref={controller.siteHref}
        collecting={controller.busy || jobsActive}
        canEdit={controller.canEdit}
        readingMode={readingMode}
        onAnalyze={controller.handleAnalyze}
      />

      {/*
        Colapso por `grid-template-rows: 1fr → 0fr` com o filho em
        `overflow-hidden`: anima a altura real sem medir nada em JS e sem
        altura mágica no CSS. O padding de cima mora no filho.
      */}
      <div
        id={NUMBERS_ID}
        className={cn(
          "grid",
          reduced
            ? "transition-none"
            : "transition-[grid-template-rows,opacity] duration-[280ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
          numbersOpen
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="grid grid-cols-2 items-stretch gap-3 pt-3.5 md:grid-cols-[minmax(0,1.15fr)_repeat(2,minmax(0,1fr))] xl:grid-cols-[minmax(0,1.15fr)_repeat(4,minmax(0,1fr))]">
            <LeadWebsiteIdentityCell controller={controller} />
            <LeadWebsiteMetricCells
              controller={controller}
              onSelectTab={onSelectTab}
            />
          </div>
        </div>
      </div>

      {/*
        Faixa de avisos: só ocupa altura quando há o que dizer. Solta no meio do
        scroll, ela saía de vista junto com o conteúdo.
      */}
      {hasNotices ? (
        <div className="mt-3 flex flex-col gap-1.5">
          {error ? (
            <p role="alert" className="text-xs/relaxed text-destructive">
              {error}
            </p>
          ) : null}
          {jobsActive ? (
            <p className="inline-flex items-center gap-1.5 text-xs/relaxed text-muted-foreground">
              <Spinner aria-hidden className="size-3.5" />
              Coletando PageSpeed…
            </p>
          ) : null}
          {pollTimedOut && jobsKey ? (
            <p className="text-xs/relaxed text-muted-foreground">
              Ainda coletando o PageSpeed — abra de novo.
            </p>
          ) : null}
          {showFailed
            ? failedJobs.map((job) => (
                <p
                  key={job.kind}
                  role="alert"
                  className="text-xs/relaxed text-destructive"
                >
                  {job.error_message ??
                    "Não foi possível obter o PageSpeed. Tente novamente."}
                </p>
              ))
            : null}
        </div>
      ) : null}

      {/*
        O botão mora na linha das abas: é a fronteira entre a faixa e o corpo,
        lê como "dobrar o que está acima" e não custa uma linha nova de altura.
      */}
      <div className="flex items-end justify-between gap-3">
        <StepTabs
          tabs={WEBSITE_STEP_TABS}
          counts={counts}
          value={tab}
          layoutId="website-step-tab-underline"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="mb-1.5 shrink-0 text-muted-foreground"
          aria-expanded={numbersOpen}
          aria-controls={NUMBERS_ID}
          aria-label={
            numbersOpen
              ? "Recolher identidade e números"
              : "Mostrar identidade e números"
          }
          onClick={toggleNumbers}
        >
          <RiArrowUpSLine
            size={14}
            aria-hidden
            className={cn(
              "transition-transform duration-[280ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
              numbersOpen ? "rotate-0" : "rotate-180",
            )}
          />
        </Button>
      </div>
    </div>
  )
}
