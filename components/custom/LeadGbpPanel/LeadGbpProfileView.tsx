"use client"

import { useState, type ReactNode } from "react"
import { useReducedMotion } from "motion/react"
import { LeadGbpOpportunitiesRail } from "./LeadGbpOpportunitiesRail"
import { LeadGbpProfileHeader } from "./LeadGbpProfileHeader"
import {
  LeadGbpTabDirectories,
  LeadGbpTabProfile,
  LeadGbpTabRanking,
  LeadGbpTabReputation,
} from "./LeadGbpTabPanels"
import {
  useCollapsibleRail,
  useWideViewport,
} from "./use-collapsible-rail"
import { useGbpProfileController } from "./use-gbp-profile-controller"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { gbpOpportunitiesByTheme } from "@/lib/leads/gbp-opportunities"
import { type GbpProfileTabId } from "@/lib/leads/gbp-profile-tabs"
import type { LeadGbpProfile } from "@/lib/leads/gbp"
import type { LeadLocation } from "@/lib/leads/resolve-location"

const RAIL_W = "21.25rem"
const RAIL_W_CLOSED = "3rem"

export function LeadGbpProfileView({
  readingMode,
  notices,
  onAddProfile,
  ...controllerInput
}: {
  profile: LeadGbpProfile
  profiles: LeadGbpProfile[]
  companyName: string
  location: LeadLocation
  canEdit: boolean
  actionPending: boolean
  readingMode: boolean
  notices: ReactNode
  onAddProfile: () => void
  onSelectProfile: (profileId: string) => void
  onUpdated: (profile: LeadGbpProfile) => void
  onRemoved: (profileId: string) => void
  onPendingChange: (pending: boolean) => void
}) {
  const controller = useGbpProfileController(controllerInput)
  const reduced = !!useReducedMotion()
  const wide = useWideViewport()
  const { railOpen, toggle } = useCollapsibleRail({ enabled: wide })
  // Abaixo de `xl` a coluna não é coluna: vira a última seção do scroll. O rail
  // de 48px é posicionado em absoluto e só faz sentido no layout de duas
  // colunas — recolher fora dele deixaria a faixa flutuando sobre o conteúdo.
  const collapsed = wide && !railOpen

  const [tab, setTab] = useState<GbpProfileTabId>("perfil")
  // Reset ligado à troca de perfil: no render, não em efeito.
  const [syncedProfileId, setSyncedProfileId] = useState(controller.profile.id)
  if (syncedProfileId !== controller.profile.id) {
    setSyncedProfileId(controller.profile.id)
    setTab("perfil")
  }

  const grouped = gbpOpportunitiesByTheme(controller.opportunities)
  const counts: Record<GbpProfileTabId, number> = {
    perfil: grouped.perfil.length,
    reputacao: grouped.reputacao.length,
    ranking: grouped.ranking.length,
    diretorios: grouped.diretorios.length,
  }

  const panels: Record<GbpProfileTabId, ReactNode> = {
    perfil: (
      <LeadGbpTabProfile controller={controller} readingMode={readingMode} />
    ),
    reputacao: (
      <LeadGbpTabReputation controller={controller} readingMode={readingMode} />
    ),
    ranking: (
      <LeadGbpTabRanking
        controller={controller}
        readingMode={readingMode}
        active={tab === "ranking"}
      />
    ),
    diretorios: (
      <LeadGbpTabDirectories
        controller={controller}
        readingMode={readingMode}
      />
    ),
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => setTab(next as GbpProfileTabId)}
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
        <LeadGbpProfileHeader
          controller={controller}
          readingMode={readingMode}
          tab={tab}
          counts={counts}
          notices={notices}
          onAddProfile={onAddProfile}
        />
        <div className="min-h-0 overflow-y-auto bg-accent/45 px-5 pt-4 pb-5">
          {(Object.keys(panels) as GbpProfileTabId[]).map((id) => (
            <TabsContent
              key={id}
              value={id}
              // `keepMounted` preserva o scan em andamento da malha, o rascunho
              // de termos do ranking e o "Ver mais" da descrição ao trocar de
              // aba. É o mesmo recurso que o dialog usa na aba Cadastro.
              keepMounted
              className="duration-150 data-active:animate-in data-active:fade-in-0"
            >
              {panels[id]}
            </TabsContent>
          ))}
        </div>
      </div>

      <LeadGbpOpportunitiesRail
        controller={controller}
        activeTab={tab}
        railOpen={!collapsed}
        onToggleRail={toggle}
      />
    </Tabs>
  )
}
