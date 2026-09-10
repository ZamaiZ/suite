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
import { websiteOpportunitiesByTheme } from "@/lib/leads/website-opportunities"
import {
  WEBSITE_STEP_TABS,
  type WebsiteStepTabId,
} from "@/lib/leads/website-step-tabs"
import { LeadWebsiteAnalystBlock } from "./LeadWebsiteAnalystBlock"
import { LeadWebsiteHeader } from "./LeadWebsiteHeader"
import {
  LeadWebsiteTabAudit,
  LeadWebsiteTabAuthority,
  LeadWebsiteTabPagespeed,
  LeadWebsiteTabReview,
} from "./LeadWebsiteTabPanels"
import type { WebsiteController } from "./use-website-controller"

const ANALYST_KEY = "website:analyst-block"
const RAIL_KEY = "website:opportunities-rail"
const RAIL_W = "21.25rem"
const RAIL_W_CLOSED = "3rem"

export function LeadWebsiteView({
  controller,
  readingMode,
}: {
  controller: WebsiteController
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
      .getElementById("website-analyst-block")
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

  const [tab, setTab] = useState<WebsiteStepTabId>("auditoria")
  // Reset ligado à troca de canal: no render, não em efeito.
  const channelId = controller.selected?.id ?? null
  const [syncedChannelId, setSyncedChannelId] = useState(channelId)
  if (syncedChannelId !== channelId) {
    setSyncedChannelId(channelId)
    setTab("auditoria")
  }

  const grouped = websiteOpportunitiesByTheme(controller.opportunities)
  const counts: Record<WebsiteStepTabId, number> = {
    auditoria: grouped.auditoria.length,
    pagespeed: grouped.pagespeed.length,
    validacao: grouped.validacao.length,
    autoridade: grouped.autoridade.length,
  }

  const panels: Record<WebsiteStepTabId, ReactNode> = {
    auditoria: (
      <LeadWebsiteTabAudit controller={controller} readingMode={readingMode} />
    ),
    pagespeed: (
      <LeadWebsiteTabPagespeed
        controller={controller}
        readingMode={readingMode}
      />
    ),
    validacao: (
      <LeadWebsiteTabReview controller={controller} readingMode={readingMode} />
    ),
    autoridade: (
      <LeadWebsiteTabAuthority
        controller={controller}
        readingMode={readingMode}
      />
    ),
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => setTab(next as WebsiteStepTabId)}
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
        <LeadWebsiteHeader
          controller={controller}
          readingMode={readingMode}
          tab={tab}
          counts={counts}
          onSelectTab={setTab}
        />
        <div
          ref={panelsRef}
          tabIndex={-1}
          className="min-h-0 overflow-y-auto bg-accent/45 px-5 pt-4 pb-5 outline-none"
        >
          {(Object.keys(panels) as WebsiteStepTabId[]).map((id) => (
            <TabsContent
              key={id}
              value={id}
              // `keepMounted` preserva o dispositivo escolhido nas capturas, os
              // disclosures de aprovados e o rascunho dentro do debounce ao
              // trocar de aba.
              keepMounted
              className="duration-150 data-active:animate-in data-active:fade-in-0"
            >
              {panels[id]}
            </TabsContent>
          ))}
        </div>
      </div>

      <StepOpportunitiesRail
        id="website-opportunities-rail"
        tabs={WEBSITE_STEP_TABS}
        groups={grouped}
        total={controller.opportunities.length}
        activeTab={tab}
        railOpen={!collapsed}
        onToggleRail={toggle}
        onRequestAnalyst={requestAnalyst}
        analyst={
          <LeadWebsiteAnalystBlock
            controller={controller}
            open={analystOpen}
            onOpenChange={setAnalyst}
            focusSignal={analystFocusSignal}
          />
        }
      />
    </Tabs>
  )
}
