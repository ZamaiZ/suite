"use client"

import type { ComponentType } from "react"
import {
  RiBuilding2Line,
  RiCalendarEventLine,
  RiCheckLine,
  RiGlobalLine,
  RiHistoryLine,
  RiKey2Line,
  RiMapPinUserLine,
  RiMoneyDollarCircleLine,
  RiPaletteLine,
  RiQuillPenLine,
  RiSearchEyeLine,
} from "react-icons/ri"
import type { StaffBriefingOverview } from "@/app/actions/briefing"
import { getLeadInitials } from "@/components/custom/LeadBoard/LeadBoardCardFace"
import { cn } from "cn"
import type { BriefingStepId } from "@/lib/briefing/steps"

/**
 * As áreas do cliente. `research` entrou com a Fase 3.
 *
 * É área e não etapa do briefing de propósito: as etapas são as oito respostas
 * que o cliente preencheu, e a pesquisa não é resposta dele — é trabalho feito
 * sobre elas.
 */
export type ClientBriefingArea = "briefing" | "contact" | "research"

const STEP_ICONS: Record<
  BriefingStepId,
  ComponentType<{ size?: number; className?: string }>
> = {
  company: RiBuilding2Line,
  brand: RiPaletteLine,
  audience: RiMapPinUserLine,
  history: RiHistoryLine,
  finance: RiMoneyDollarCircleLine,
  website: RiGlobalLine,
  accesses: RiKey2Line,
  closing: RiQuillPenLine,
}

const STATE_LABEL: Record<string, string> = {
  empty: "Não iniciado",
  in_progress: "Em andamento",
  completed: "Concluído",
}

export function ClientBriefingNavigationRail({
  companyName,
  completedCount,
  area,
  activeStep,
  steps,
  contactEnabled,
  researchEnabled,
  researchDetail,
  disabled,
  onAreaChange,
  onStepSelect,
}: {
  companyName: string
  completedCount: number
  area: ClientBriefingArea
  activeStep: BriefingStepId | null
  steps: StaffBriefingOverview["steps"]
  contactEnabled: boolean
  researchEnabled: boolean
  /** O que já existe de pesquisa, ou o convite para fazer a primeira. */
  researchDetail: string
  disabled: boolean
  onAreaChange: (area: ClientBriefingArea) => void
  onStepSelect: (stepId: BriefingStepId) => void
}) {
  return (
    <aside className="shrink-0 border-b border-border/70 bg-popover lg:w-56 lg:border-r lg:border-b-0">
      <nav
        aria-label="Navegação do cliente"
        className="flex max-h-56 gap-1 overflow-x-auto p-2 lg:h-full lg:max-h-none lg:flex-col lg:overflow-y-auto"
      >
        <div className="hidden px-2.5 py-2 lg:block">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs/relaxed font-semibold text-primary"
            >
              {getLeadInitials(companyName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs/relaxed font-semibold text-foreground">
                {companyName}
              </p>
              <p className="text-xs/relaxed text-muted-foreground">
                {completedCount}/8 etapas concluídas
              </p>
            </div>
          </div>
        </div>

        <p className="hidden px-2.5 pt-2 text-xs/relaxed font-medium tracking-wide text-muted-foreground uppercase lg:block">
          Áreas
        </p>
        <RailButton
          selected={area === "briefing"}
          onClick={() => onAreaChange("briefing")}
          icon={RiQuillPenLine}
          label="Briefing"
          detail={`${completedCount}/8 concluídas`}
          disabled={disabled}
        />
        <RailButton
          selected={area === "contact"}
          onClick={() => onAreaChange("contact")}
          icon={RiCalendarEventLine}
          label="Contato e kickoff"
          detail={
            contactEnabled
              ? "Histórico e próximos passos"
              : "Disponível após envio"
          }
          disabled={disabled || !contactEnabled}
        />
        <RailButton
          selected={area === "research"}
          onClick={() => onAreaChange("research")}
          icon={RiSearchEyeLine}
          label="Pesquisa"
          detail={
            researchEnabled
              ? researchDetail
              : "Disponível após o briefing ser enviado"
          }
          disabled={disabled || !researchEnabled}
        />

        {area === "briefing" ? (
          <>
            <div className="hidden border-t border-border/70 pt-3 lg:block" />
            <p className="hidden px-2.5 text-xs/relaxed font-medium tracking-wide text-muted-foreground uppercase lg:block">
              Etapas do briefing
            </p>
            {steps.map((step) => {
              const Icon = STEP_ICONS[step.id]
              const selected = activeStep === step.id
              return (
                <button
                  key={step.id}
                  type="button"
                  aria-current={selected ? "page" : undefined}
                  disabled={disabled}
                  onClick={() => onStepSelect(step.id)}
                  className={cn(
                    "flex min-w-[10rem] items-center gap-2.5 rounded-lg px-2.5 py-2 text-left lg:min-w-0",
                    "transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    selected ? "bg-primary/10" : "hover:bg-accent",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "inline-flex size-7 shrink-0 items-center justify-center rounded-md",
                      step.state === "completed" &&
                        "bg-success/10 text-success",
                      step.state === "in_progress" &&
                        "bg-warning/10 text-warning",
                      step.state === "empty" &&
                        "bg-background text-muted-foreground",
                    )}
                  >
                    {step.state === "completed" ? (
                      <RiCheckLine size={15} />
                    ) : (
                      <Icon size={15} />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs/relaxed font-medium text-foreground">
                      {step.label}
                    </span>
                    <span className="block truncate text-xs/relaxed text-muted-foreground">
                      {STATE_LABEL[step.state]}
                    </span>
                  </span>
                </button>
              )
            })}
          </>
        ) : null}
      </nav>
    </aside>
  )
}

function RailButton({
  selected,
  onClick,
  icon: Icon,
  label,
  detail,
  disabled,
}: {
  selected: boolean
  onClick: () => void
  icon: ComponentType<{ size?: number; className?: string }>
  label: string
  detail: string
  disabled: boolean
}) {
  return (
    <button
      type="button"
      aria-current={selected ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-w-[10rem] items-center gap-2.5 rounded-lg px-2.5 py-2 text-left lg:min-w-0",
        "transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        selected ? "bg-primary/10" : "hover:bg-accent",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
          selected
            ? "bg-primary/15 text-primary"
            : "bg-background text-muted-foreground",
        )}
      >
        <Icon size={16} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs/relaxed font-semibold text-foreground">
          {label}
        </span>
        <span className="block truncate text-xs/relaxed text-muted-foreground">
          {detail}
        </span>
      </span>
    </button>
  )
}
