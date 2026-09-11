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
import { GEO_STEP_TABS, type GeoStepTabId } from "@/lib/leads/geo-step-tabs"
import { LeadGeoAnalystBlock } from "./LeadGeoAnalystBlock"
import { LeadGeoHeader } from "./LeadGeoHeader"
import {
  LeadGeoTabAccess,
  LeadGeoTabCitations,
  LeadGeoTabContent,
  LeadGeoTabProbe,
} from "./LeadGeoTabPanels"
import type { GeoController } from "./use-geo-controller"

const ANALYST_KEY = "geo:analyst-block"
const RAIL_KEY = "geo:opportunities-rail"
const RAIL_W = "21.25rem"
const RAIL_W_CLOSED = "3rem"

export function LeadGeoView({
  controller,
  readingMode,
}: {
  controller: GeoController
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
      .getElementById("geo-analyst-block")
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

  const [tab, setTab] = useState<GeoStepTabId>("acesso")
  // Reset ligado à troca de lead: no render, não em efeito.
  const leadId = controller.leadId
  const [syncedLeadId, setSyncedLeadId] = useState(leadId)
  if (syncedLeadId !== leadId) {
    setSyncedLeadId(leadId)
    setTab("acesso")
  }

  const panels: Record<GeoStepTabId, ReactNode> = {
    acesso: <LeadGeoTabAccess controller={controller} />,
    conteudo: (
      <LeadGeoTabContent controller={controller} readingMode={readingMode} />
    ),
    citacoes: <LeadGeoTabCitations controller={controller} />,
    sondagem: <LeadGeoTabProbe controller={controller} />,
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => setTab(next as GeoStepTabId)}
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
        <LeadGeoHeader
          controller={controller}
          readingMode={readingMode}
          tab={tab}
          counts={controller.counts}
          onSelectTab={setTab}
        />
        <div
          ref={panelsRef}
          tabIndex={-1}
          className="min-h-0 overflow-y-auto bg-accent/45 px-5 pt-4 pb-5 outline-none"
        >
          {(Object.keys(panels) as GeoStepTabId[]).map((id) => (
            <TabsContent
              key={id}
              value={id}
              // `keepMounted` preserva o rascunho do analista dentro do debounce
              // ao trocar de aba.
              keepMounted
              className="duration-150 data-active:animate-in data-active:fade-in-0"
            >
              {panels[id]}
            </TabsContent>
          ))}
        </div>
      </div>

      <StepOpportunitiesRail
        id="geo-opportunities-rail"
        tabs={GEO_STEP_TABS}
        groups={controller.grouped}
        total={controller.opportunities.length}
        activeTab={tab}
        railOpen={!collapsed}
        onToggleRail={toggle}
        onRequestAnalyst={requestAnalyst}
        analyst={
          <LeadGeoAnalystBlock
            controller={controller}
            readingMode={readingMode}
            open={analystOpen}
            onOpenChange={setAnalyst}
            focusSignal={analystFocusSignal}
          />
        }
      />
    </Tabs>
  )
}
