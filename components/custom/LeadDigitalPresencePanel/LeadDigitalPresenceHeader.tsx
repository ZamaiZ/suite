"use client"

import { useState } from "react"
import { useReducedMotion } from "motion/react"
import { RiArrowUpSLine } from "react-icons/ri"
import { StepTabs } from "@/components/custom/LeadStepShell"
import { Button } from "@/components/ui/button"
import { cn } from "cn"
import {
  DIGITAL_PRESENCE_STEP_TABS,
  type DigitalPresenceStepTabId,
} from "@/lib/leads/digital-presence-step-tabs"
import { LeadDigitalPresenceIdentityCell } from "./LeadDigitalPresenceIdentityCell"
import { LeadDigitalPresenceMetricCells } from "./LeadDigitalPresenceMetricCells"
import { LeadDigitalPresenceStepHeader } from "./LeadDigitalPresenceStepHeader"
import type { DigitalPresenceController } from "./use-digital-presence-controller"

const NUMBERS_KEY = "presence:header-numbers"
const NUMBERS_ID = "presence-header-numbers"

/**
 * Primeira linha do grid da coluna central, fora da área de scroll: identidade
 * e números ficam à vista enquanto o analista percorre as abas.
 */
export function LeadDigitalPresenceHeader({
  controller,
  tab,
  counts,
  onSelectTab,
}: {
  controller: DigitalPresenceController
  tab: DigitalPresenceStepTabId
  counts: Record<DigitalPresenceStepTabId, number>
  onSelectTab: (tab: DigitalPresenceStepTabId) => void
}) {
  const reduced = !!useReducedMotion()
  // Inicializador preguiçoso: `localStorage` nunca é lido no corpo do render.
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

  const { saveStatus, saveError, hasCollect } = controller
  const hasNotices = saveStatus === "error" || !hasCollect

  return (
    <div className="border-b border-border/70 bg-background px-5 pt-4">
      <LeadDigitalPresenceStepHeader
        saveStatus={saveStatus}
        updatedAt={controller.updatedAt}
      />

      {/*
        Colapso por `grid-template-rows: 1fr → 0fr` com o filho em
        `overflow-hidden`: anima a altura real sem medir nada em JS e sem altura
        mágica no CSS. O padding de cima mora no filho.
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
            <LeadDigitalPresenceIdentityCell controller={controller} />
            <LeadDigitalPresenceMetricCells
              controller={controller}
              onSelectTab={onSelectTab}
            />
          </div>
        </div>
      </div>

      {/*
        Faixa de avisos: a ressalva da coleta morava na última linha da página,
        onde rolava para fora da tela junto com o conteúdo.
      */}
      {hasNotices ? (
        <div className="mt-3 flex flex-col gap-1.5">
          {saveStatus === "error" ? (
            <p role="alert" className="text-xs/relaxed text-destructive">
              {saveError ?? "Não foi possível salvar. Tente novamente."}
            </p>
          ) : null}
          {!hasCollect ? (
            <p className="text-xs/relaxed text-muted-foreground">
              Rastreamento e alinhamento vêm da coleta do Website. Sem ela, esta
              etapa mostra só o que o analista registrar.
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
          tabs={DIGITAL_PRESENCE_STEP_TABS}
          counts={counts}
          value={tab}
          layoutId="presence-step-tab-underline"
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
