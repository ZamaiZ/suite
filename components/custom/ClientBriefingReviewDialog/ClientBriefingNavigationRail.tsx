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
} from "react-icons/ri"
import type { StaffBriefingOverview } from "@/app/actions/briefing"
import { getLeadInitials } from "@/components/custom/LeadBoard/LeadBoardCardFace"
import { cn } from "@/lib/cn"
import type { BriefingStepId } from "@/lib/briefing/steps"

export type ClientBriefingArea = "briefing" | "contact"

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
  disabled: boolean
  onAreaChange: (area: ClientBriefingArea) => void
  onStepSelect: (stepId: BriefingStepId) => void
}) {
  return (
    <aside className="shrink-0 border-b border-border-subtle bg-elevated lg:w-56 lg:border-r lg:border-b-0">
      <nav
        aria-label="Navegação do cliente"
        className="flex max-h-56 gap-1 overflow-x-auto p-2 lg:h-full lg:max-h-none lg:flex-col lg:overflow-y-auto"
      >
        <div className="hidden px-2.5 py-2 lg:block">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/10 font-sans text-caption font-semibold text-accent"
            >
              {getLeadInitials(companyName)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-sans text-body-sm font-semibold text-fg">
                {companyName}
              </p>
              <p className="font-sans text-caption text-fg-muted">
                {completedCount}/8 etapas concluídas
              </p>
            </div>
          </div>
        </div>

        <p className="hidden px-2.5 pt-2 font-sans text-caption font-medium tracking-wide text-fg-muted uppercase lg:block">
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
          detail={contactEnabled ? "Histórico e próximos passos" : "Disponível após envio"}
          disabled={disabled || !contactEnabled}
        />

        {area === "briefing" ? (
          <>
            <div className="hidden border-t border-border-subtle pt-3 lg:block" />
            <p className="hidden px-2.5 font-sans text-caption font-medium tracking-wide text-fg-muted uppercase lg:block">
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
                    selected ? "bg-accent/10" : "hover:bg-hover",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "inline-flex size-7 shrink-0 items-center justify-center rounded-md",
                      step.state === "completed" && "bg-success/10 text-success",
                      step.state === "in_progress" && "bg-warning/10 text-warning",
                      step.state === "empty" && "bg-canvas text-fg-muted",
                    )}
                  >
                    {step.state === "completed" ? (
                      <RiCheckLine size={15} />
                    ) : (
                      <Icon size={15} />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-sans text-body-sm font-medium text-fg">
                      {step.label}
                    </span>
                    <span className="block truncate font-sans text-caption text-fg-muted">
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
        selected ? "bg-accent/10" : "hover:bg-hover",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
          selected ? "bg-accent/15 text-accent" : "bg-canvas text-fg-secondary",
        )}
      >
        <Icon size={16} />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-sans text-body-sm font-semibold text-fg">
          {label}
        </span>
        <span className="block truncate font-sans text-caption text-fg-muted">
          {detail}
        </span>
      </span>
    </button>
  )
}
