"use client"

import { useState } from "react"
import { useReducedMotion } from "motion/react"
import { RiArrowUpSLine } from "react-icons/ri"
import { StepTabs } from "@/components/custom/LeadStepShell"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "cn"
import { GEO_STEP_TABS, type GeoStepTabId } from "@/lib/leads/geo-step-tabs"
import { LeadGeoIdentityCell } from "./LeadGeoIdentityCell"
import { LeadGeoMetricCells } from "./LeadGeoMetricCells"
import { LeadGeoStepHeader } from "./LeadGeoStepHeader"
import type { GeoController } from "./use-geo-controller"

const NUMBERS_KEY = "geo:header-numbers"
const NUMBERS_ID = "geo-header-numbers"

/**
 * Primeira linha do grid da coluna central, fora da área de scroll: identidade
 * e números ficam à vista enquanto o analista percorre as abas.
 */
export function LeadGeoHeader({
  controller,
  readingMode,
  tab,
  counts,
  onSelectTab,
}: {
  controller: GeoController
  readingMode: boolean
  tab: GeoStepTabId
  counts: Record<GeoStepTabId, number>
  onSelectTab: (tab: GeoStepTabId) => void
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

  const {
    error,
    busy,
    snapshot,
    domain,
    saveError,
    hasWebsiteAudit,
    mentionsBusy,
    mentionsError,
    probeBusy,
    probeError,
  } = controller

  const staleCrawl =
    snapshot !== null && !snapshot.sources.websiteCrawlExtended

  const hasNotices =
    Boolean(error) ||
    Boolean(mentionsError) ||
    Boolean(probeError) ||
    Boolean(saveError) ||
    busy ||
    mentionsBusy ||
    probeBusy ||
    !domain ||
    !hasWebsiteAudit ||
    staleCrawl

  return (
    <div className="border-b border-border/70 bg-background px-5 pt-4">
      <LeadGeoStepHeader
        updatedAt={controller.audit?.fetched_at ?? null}
        websiteAuditAt={snapshot?.sources.websiteAuditAt ?? null}
        siteHref={controller.siteHref}
        collecting={busy}
        canEdit={controller.canEdit}
        readingMode={readingMode}
        hasDomain={Boolean(domain)}
        hasWebsiteAudit={hasWebsiteAudit}
        onAnalyze={controller.handleAnalyze}
        hasMentions={Boolean(snapshot?.aiMentions)}
        mentionsBusy={controller.mentionsBusy}
        hasBacklinkAudit={controller.hasBacklinkAudit}
        onCollectMentions={controller.handleCollectMentions}
        hasProbe={Boolean(snapshot?.promptVisibility)}
        probeBusy={controller.probeBusy}
        probeRuns={controller.probeRuns}
        onProbe={controller.handleProbe}
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
            <LeadGeoIdentityCell controller={controller} />
            <LeadGeoMetricCells
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
          {mentionsError ? (
            <p role="alert" className="text-xs/relaxed text-destructive">
              {mentionsError}
            </p>
          ) : null}
          {probeError ? (
            <p role="alert" className="text-xs/relaxed text-destructive">
              {probeError}
            </p>
          ) : null}
          {saveError ? (
            <p role="alert" className="text-xs/relaxed text-destructive">
              {saveError}
            </p>
          ) : null}
          {busy ? (
            <p className="inline-flex items-center gap-1.5 text-xs/relaxed text-muted-foreground">
              <Spinner aria-hidden className="size-3.5" />
              Analisando presença em IA…
            </p>
          ) : null}
          {mentionsBusy ? (
            <p className="inline-flex items-center gap-1.5 text-xs/relaxed text-muted-foreground">
              <Spinner aria-hidden className="size-3.5" />
              Coletando menções em IA…
            </p>
          ) : null}
          {probeBusy ? (
            <p className="inline-flex items-center gap-1.5 text-xs/relaxed text-muted-foreground">
              <Spinner aria-hidden className="size-3.5" />
              Sondando as IAs — pode levar alguns minutos.
            </p>
          ) : null}

          {!domain ? (
            <p className="text-xs/relaxed text-muted-foreground">
              Este lead não possui site para esta análise.
            </p>
          ) : null}
          {domain && !hasWebsiteAudit ? (
            <p className="text-xs/relaxed text-muted-foreground">
              Rode a análise de Website antes: esta etapa lê aquela coleta.
            </p>
          ) : null}
          {staleCrawl ? (
            <p className="text-xs/relaxed text-muted-foreground">
              O crawl lido é anterior à coleta ampliada: llms.txt, robôs de IA e
              headings não foram medidos nele. Recolete o Website e analise de
              novo.
            </p>
          ) : null}
        </div>
      ) : null}

      {/*
        O botão mora na linha das abas: é a fronteira entre a faixa e o corpo,
        lê como "dobrar o que está acima" e não custa uma linha nova de altura.
      */}
      <div className="flex items-end justify-between gap-3">
        <StepTabs
          tabs={GEO_STEP_TABS}
          counts={counts}
          value={tab}
          layoutId="geo-step-tab-underline"
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
