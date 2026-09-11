"use client"

import { useCallback, useRef, useState, type ReactNode } from "react"
import { useReducedMotion } from "motion/react"
import {
  StepOpportunitiesRail,
  useCaptureShortcut,
  useCollapsibleRail,
  useWideViewport,
} from "@/components/custom/LeadStepShell"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import {
  DIGITAL_PRESENCE_STEP_TABS,
  type DigitalPresenceStepTabId,
} from "@/lib/leads/digital-presence-step-tabs"
import { LeadDigitalPresenceAnalystBlock } from "./LeadDigitalPresenceAnalystBlock"
import { LeadDigitalPresenceHeader } from "./LeadDigitalPresenceHeader"
import {
  LeadDigitalPresenceTabRedes,
  LeadDigitalPresenceTabSite,
} from "./LeadDigitalPresenceTabPanels"
import type { DigitalPresenceController } from "./use-digital-presence-controller"

const ANALYST_KEY = "presence:analyst-block"
const RAIL_KEY = "presence:opportunities-rail"
const RAIL_W = "21.25rem"
const RAIL_W_CLOSED = "3rem"
const ANALYST_ID = "presence-analyst-block"

export function LeadDigitalPresenceView({
  controller,
  readingMode,
}: {
  controller: DigitalPresenceController
  readingMode: boolean
}) {
  const reduced = !!useReducedMotion()
  const wide = useWideViewport()
  const { railOpen, toggle } = useCollapsibleRail({
    enabled: wide,
    storageKey: RAIL_KEY,
  })
  // Abaixo de `xl` a coluna não é coluna: vira a última seção do scroll. O rail
  // de 48px é posicionado em absoluto e só faz sentido no layout de duas
  // colunas — recolher fora dele deixaria a faixa flutuando sobre o conteúdo.
  const collapsed = wide && !railOpen

  const [analystOpen, setAnalystOpen] = useState(() => {
    if (typeof window === "undefined") return true
    return window.localStorage.getItem(ANALYST_KEY) !== "closed"
  })
  const [analystFocusSignal, setAnalystFocusSignal] = useState(0)
  const panelsRef = useRef<HTMLDivElement>(null)

  const setAnalyst = useCallback((next: boolean) => {
    setAnalystOpen(next)
    window.localStorage.setItem(ANALYST_KEY, next ? "open" : "closed")
  }, [])

  /** Abre a coluna, abre o bloco e leva o cursor para o campo. */
  const requestAnalyst = useCallback(() => {
    if (collapsed) toggle()
    setAnalyst(true)
    setAnalystFocusSignal((current) => current + 1)
  }, [collapsed, toggle, setAnalyst])

  /**
   * Ida e volta: de fora, entra no campo; de dentro, recolhe o bloco e devolve
   * o foco ao painel. Sem a volta, o atalho seria uma armadilha de foco — daí
   * `allowInFields`, que é o que permite disparar com o cursor no textarea.
   */
  const toggleAnalyst = useCallback(() => {
    const inside = document
      .getElementById(ANALYST_ID)
      ?.contains(document.activeElement)
    if (inside) {
      setAnalyst(false)
      panelsRef.current?.focus()
      return
    }
    requestAnalyst()
  }, [requestAnalyst, setAnalyst])

  useCaptureShortcut({
    enabled: true,
    code: "KeyE",
    onMatch: toggleAnalyst,
    allowInFields: true,
  })

  const [tab, setTab] = useState<DigitalPresenceStepTabId>("redes")

  const panels: Record<DigitalPresenceStepTabId, ReactNode> = {
    redes: (
      <LeadDigitalPresenceTabRedes
        controller={controller}
        readingMode={readingMode}
      />
    ),
    site: (
      <LeadDigitalPresenceTabSite
        controller={controller}
        readingMode={readingMode}
      />
    ),
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => setTab(next as DigitalPresenceStepTabId)}
      className="relative grid h-full min-h-0 grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1fr)_var(--rail-w)]"
      style={
        {
          "--rail-w": collapsed ? RAIL_W_CLOSED : RAIL_W,
          transitionProperty: "grid-template-columns",
          transitionDuration: reduced ? "120ms" : "320ms",
          transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)",
        } as React.CSSProperties
      }
    >
      <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]">
        <LeadDigitalPresenceHeader
          controller={controller}
          tab={tab}
          counts={controller.counts}
          onSelectTab={setTab}
        />
        <div
          ref={panelsRef}
          tabIndex={-1}
          className="min-h-0 overflow-y-auto bg-accent/45 px-5 pt-4 pb-5 outline-none"
        >
          {(Object.keys(panels) as DigitalPresenceStepTabId[]).map((id) => (
            <TabsContent
              key={id}
              value={id}
              // `keepMounted` preserva o rascunho dentro do debounce ao trocar
              // de aba.
              keepMounted
              className="duration-150 data-active:animate-in data-active:fade-in-0"
            >
              {panels[id]}
            </TabsContent>
          ))}
        </div>
      </div>

      <StepOpportunitiesRail
        id="presence-opportunities-rail"
        tabs={DIGITAL_PRESENCE_STEP_TABS}
        groups={controller.grouped}
        total={controller.opportunities.length}
        activeTab={tab}
        railOpen={!collapsed}
        onToggleRail={toggle}
        onRequestAnalyst={requestAnalyst}
        emptyLabel="Nenhum problema identificado nesta etapa."
        analyst={
          // O bloco continua montado no modo reunião, em leitura: `readingMode`
          // esconde **edição**, não dado. É o que o Website já faz, e a nota da
          // etapa é justamente o que se narra numa reunião.
          <LeadDigitalPresenceAnalystBlock
            controller={controller}
            canEdit={controller.canEdit && !readingMode}
            open={analystOpen}
            onOpenChange={setAnalyst}
            focusSignal={analystFocusSignal}
          />
        }
      />
    </Tabs>
  )
}
