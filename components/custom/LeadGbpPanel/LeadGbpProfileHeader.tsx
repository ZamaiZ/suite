"use client"

import { useState, type ReactNode } from "react"
import { useReducedMotion } from "motion/react"
import { RiArrowUpSLine } from "react-icons/ri"
import { LeadGbpIdentityCell } from "./LeadGbpIdentityCell"
import { LeadGbpMetricCells } from "./LeadGbpMetricCells"
import { LeadGbpStepHeader } from "./LeadGbpStepHeader"
import { LeadGbpStepTabs } from "./LeadGbpStepTabs"
import type { GbpProfileController } from "./use-gbp-profile-controller"
import { Button } from "@/components/ui/button"
import { cn } from "cn"
import type { GbpProfileTabId } from "@/lib/leads/gbp-profile-tabs"

const NUMBERS_KEY = "gbp:header-numbers"
const NUMBERS_ID = "gbp-header-numbers"

/**
 * Primeira linha do grid da coluna central, fora da área de scroll: identidade
 * e números ficam à vista enquanto o analista percorre as abas.
 */
export function LeadGbpProfileHeader({
  controller,
  readingMode,
  tab,
  counts,
  notices,
  onAddProfile,
}: {
  controller: GbpProfileController
  readingMode: boolean
  tab: GbpProfileTabId
  counts: Record<GbpProfileTabId, number>
  notices: ReactNode
  onAddProfile: () => void
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

  return (
    <div className="border-b border-border/70 bg-background px-5 pt-4">
      <LeadGbpStepHeader
        updatedAt={controller.updatedAt}
        mapsHref={controller.mapsUri}
        collecting={controller.collecting}
        canEdit={controller.canEdit}
        readingMode={readingMode}
        isPrimary={controller.profile.is_primary}
        onEnrich={controller.handleEnrich}
        onPrimary={controller.handlePrimary}
        onRefresh={controller.handleRefresh}
        onRemove={controller.handleRemove}
        onAddProfile={onAddProfile}
      />

      {/*
        Colapso por `grid-template-rows: 1fr → 0fr` com o filho em
        `overflow-hidden`: anima a altura real sem medir nada em JS e sem
        altura mágica no CSS. O padding de cima mora no filho, senão sobraria
        um respiro de 14px depois de fechado.
      */}
      <div
        id={NUMBERS_ID}
        className={cn(
          "grid",
          reduced
            ? "transition-none"
            : "transition-[grid-template-rows,opacity] duration-[280ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
          numbersOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="grid grid-cols-2 items-stretch gap-3 pt-3.5 md:grid-cols-[minmax(0,1.15fr)_repeat(2,minmax(0,1fr))] xl:grid-cols-[minmax(0,1.15fr)_repeat(4,minmax(0,1fr))]">
            <LeadGbpIdentityCell
              profile={controller.profile}
              profiles={controller.profiles}
              onSelectProfile={controller.onSelectProfile}
            />
            <LeadGbpMetricCells profile={controller.profile} />
          </div>
        </div>
      </div>

      {notices}

      {/*
        O botão mora na linha das abas: é a fronteira entre a faixa e o corpo,
        lê como "dobrar o que está acima" e não custa uma linha nova de altura.
      */}
      <div className="flex items-end justify-between gap-3">
        <LeadGbpStepTabs tab={tab} counts={counts} />
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
