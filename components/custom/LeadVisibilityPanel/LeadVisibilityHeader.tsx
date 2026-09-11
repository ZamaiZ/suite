"use client"

import { useState } from "react"
import { useReducedMotion } from "motion/react"
import { RiArrowUpSLine } from "react-icons/ri"
import { StepTabs } from "@/components/custom/LeadStepShell"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "cn"
import {
  VISIBILITY_STEP_TABS,
  type VisibilityStepTabId,
} from "@/lib/leads/visibility-step-tabs"
import { LeadVisibilityIdentityCell } from "./LeadVisibilityIdentityCell"
import { LeadVisibilityMetricCells } from "./LeadVisibilityMetricCells"
import { LeadVisibilityStepHeader } from "./LeadVisibilityStepHeader"
import type { VisibilityController } from "./use-visibility-controller"

const NUMBERS_KEY = "visibility:header-numbers"
const NUMBERS_ID = "visibility-header-numbers"

/**
 * Primeira linha do grid da coluna central, fora da área de scroll: identidade
 * e números ficam à vista enquanto o analista percorre as abas.
 */
export function LeadVisibilityHeader({
  controller,
  readingMode,
  tab,
  counts,
  onSelectTab,
}: {
  controller: VisibilityController
  readingMode: boolean
  tab: VisibilityStepTabId
  counts: Record<VisibilityStepTabId, number>
  onSelectTab: (tab: VisibilityStepTabId) => void
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

  const { error, busy, snapshot, domain, saveError } = controller

  /**
   * A segunda chamada da coleta pode falhar sozinha sem derrubar a primeira.
   * Quando falha, a coluna de intenção inteira mostra `—`, e o motivo precisa
   * estar escrito — senão parece defeito da tela.
   */
  const intentMissing =
    snapshot !== null &&
    snapshot.keywords.length > 0 &&
    snapshot.keywords.every((row) => row.intent === null)

  const droppedRows = snapshot?.droppedRows ?? 0
  const hasNotices =
    Boolean(error) ||
    Boolean(saveError) ||
    busy ||
    !domain ||
    intentMissing ||
    droppedRows > 0

  return (
    <div className="border-b border-border/70 bg-background px-5 pt-4">
      <LeadVisibilityStepHeader
        updatedAt={controller.audit?.fetched_at ?? null}
        costUsd={snapshot?.costUsd ?? null}
        siteHref={controller.siteHref}
        collecting={busy}
        canEdit={controller.canEdit}
        readingMode={readingMode}
        hasDomain={Boolean(domain)}
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
            <LeadVisibilityIdentityCell controller={controller} />
            <LeadVisibilityMetricCells
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
          {saveError ? (
            <p role="alert" className="text-xs/relaxed text-destructive">
              {saveError}
            </p>
          ) : null}
          {busy ? (
            <p className="inline-flex items-center gap-1.5 text-xs/relaxed text-muted-foreground">
              <Spinner aria-hidden className="size-3.5" />
              Analisando visibilidade…
            </p>
          ) : null}
          {!domain ? (
            <p className="text-xs/relaxed text-muted-foreground">
              Cadastre um site no lead para analisar a visibilidade.
            </p>
          ) : null}
          {intentMissing ? (
            <p className="text-xs/relaxed text-muted-foreground">
              Intenção não coletada nesta análise.
            </p>
          ) : null}
          {droppedRows > 0 ? (
            <p className="text-xs/relaxed text-muted-foreground">
              {droppedRows} linha(s) ilegível(is) descartada(s) na coleta.
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
          tabs={VISIBILITY_STEP_TABS}
          counts={counts}
          value={tab}
          layoutId="visibility-step-tab-underline"
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
