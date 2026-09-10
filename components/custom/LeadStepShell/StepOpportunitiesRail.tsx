"use client"

import { useState, type ReactNode } from "react"
import { RiArrowLeftSLine, RiArrowRightSLine, RiEditLine } from "react-icons/ri"
import { StepOpportunityItem, type StepOpportunity } from "./StepOpportunityItem"
import type { StepTabDef } from "./StepTabs"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { cn } from "cn"

export function StepOpportunitiesRail<Id extends string>({
  id,
  title = "Oportunidades",
  tabs,
  groups,
  total,
  activeTab,
  railOpen,
  onToggleRail,
  onRequestAnalyst,
  analyst,
  emptyLabel = "Nenhum problema identificado nesta coleta.",
}: {
  /** Único por etapa: é o alvo de `aria-controls`. */
  id: string
  title?: string
  tabs: ReadonlyArray<StepTabDef<Id>>
  groups: Record<Id, StepOpportunity[]>
  total: number
  activeTab: Id
  railOpen: boolean
  onToggleRail: () => void
  onRequestAnalyst: () => void
  analyst: ReactNode
  emptyLabel?: string
}) {
  const [filter, setFilter] = useState<"todas" | Id>("todas")
  const shown = filter === "todas" ? total : groups[filter].length

  return (
    <>
      {/* Rail de 48px: só aparece quando a coluna está recolhida. */}
      {!railOpen ? (
        <div className="absolute inset-y-0 right-0 z-10 flex w-12 flex-col items-center gap-3.5 border-l border-border/70 bg-popover py-3.5">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Abrir ${title.toLowerCase()}`}
            aria-expanded={false}
            aria-controls={id}
            className="size-7 rounded-lg"
            onClick={onToggleRail}
          >
            <RiArrowLeftSLine size={14} aria-hidden />
          </Button>
          {total > 0 ? (
            <span className="inline-flex h-[18px] min-w-[22px] items-center justify-center rounded-full bg-warning/[0.12] text-[10px] font-semibold tabular-nums text-warning">
              {total}
            </span>
          ) : null}
          <span className="flex-1 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase [writing-mode:vertical-rl]">
            {title}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Abrir o bloco do analista (Ctrl E)"
            onClick={onRequestAnalyst}
          >
            <RiEditLine size={14} aria-hidden />
          </Button>
        </div>
      ) : null}

      <aside
        id={id}
        // Continua montada quando recolhida: é o que preserva o filtro, o campo
        // do analista e o rascunho não salvo. `inert` resolve foco, ponteiro e
        // árvore de acessibilidade de uma vez.
        inert={!railOpen}
        className={cn(
          "grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-l border-border/70 bg-popover/70 transition-opacity duration-200",
          railOpen ? "opacity-100 delay-75" : "opacity-0",
        )}
      >
        <div className="border-b border-border/70 px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-heading flex-1 text-sm font-semibold text-foreground">
              {title}
            </h3>
            <Kbd className="text-[10px]">Ctrl B</Kbd>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={`Recolher ${title.toLowerCase()}`}
              aria-expanded={railOpen}
              aria-controls={id}
              onClick={onToggleRail}
            >
              <RiArrowRightSLine size={14} aria-hidden />
            </Button>
          </div>
          <p className="mt-0.5 text-xs/relaxed tabular-nums text-muted-foreground">
            {shown} de {total}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {(
              [
                ["todas", "Todas"],
                ...tabs.map((item) => [item.id, item.label] as const),
              ] as ReadonlyArray<readonly ["todas" | Id, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                className={cn(
                  "inline-flex h-6 cursor-pointer items-center rounded-full border px-2.5 text-[11px] font-medium transition-colors",
                  filter === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto px-4 pt-3 pb-4">
          {total === 0 ? (
            <p className="text-xs/relaxed text-muted-foreground">{emptyLabel}</p>
          ) : (
            <div className="flex flex-col gap-4">
              {tabs
                .filter((item) => filter === "todas" || filter === item.id)
                .map((item) => {
                  const items = groups[item.id]
                  if (items.length === 0) return null
                  return (
                    <section key={item.id} className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-[11px] font-semibold tracking-[0.08em] uppercase",
                            activeTab === item.id
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                        >
                          {item.label}
                        </span>
                        <span className="h-px flex-1 bg-border/70" />
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {items.length}
                        </span>
                      </div>
                      <ul className="flex flex-col gap-1.5">
                        {items.map((opportunity) => (
                          <StepOpportunityItem
                            key={opportunity.id}
                            item={opportunity}
                          />
                        ))}
                      </ul>
                    </section>
                  )
                })}
            </div>
          )}
        </div>

        {analyst}
      </aside>
    </>
  )
}
