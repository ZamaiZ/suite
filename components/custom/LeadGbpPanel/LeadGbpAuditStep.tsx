import type { IconType } from "react-icons"
import { RiCheckLine, RiErrorWarningLine } from "react-icons/ri"
import * as m from "motion/react-m"
import { cn } from "@/lib/cn"
import type { GbpAuditRailStep } from "@/lib/leads/gbp-audit-rail"

const STEP_STATE_LABEL: Record<GbpAuditRailStep["state"], string> = {
  current: "Etapa atual",
  processing: "Em análise",
  complete: "Analisada",
  error: "Erro na análise",
  upcoming: "Etapa futura",
}

export function LeadGbpAuditStep({
  step,
  index,
  icon: Icon,
  reduced,
  onSelect,
}: {
  step: GbpAuditRailStep
  index: number
  icon: IconType
  reduced: boolean
  onSelect?: (id: GbpAuditRailStep["id"]) => void
}) {
  const isSelected = step.selected
  const isComplete = step.state === "complete"
  const isProcessing = step.state === "processing"
  const isError = step.state === "error"
  const isActive = isSelected || step.state !== "upcoming"
  const showAlerts = isActive && step.showAlerts

  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          "relative inline-flex size-8 shrink-0 items-center justify-center rounded-full border font-sans text-caption font-semibold",
          "transition-[background-color,border-color,color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
          (step.state === "current" || isProcessing || isComplete) &&
            "border-primary bg-primary text-primary-foreground",
          isError && "border-danger bg-danger text-danger-fg",
          step.state === "upcoming" &&
            "border-border bg-elevated text-fg-secondary",
        )}
      >
        {isProcessing ? (
          <span className="absolute -inset-1 rounded-full border border-accent/25 motion-safe:animate-pulse motion-reduce:opacity-60" />
        ) : null}
        {isComplete ? (
          <RiCheckLine size={17} />
        ) : isError ? (
          <RiErrorWarningLine size={16} />
        ) : (
          index + 1
        )}
      </span>

      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-elevated",
            "transition-[background-color,border-color,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
            isActive ? "border-accent/15 text-accent" : "text-fg-muted",
          )}
        >
          <Icon size={16} />
        </span>

        <div className="min-w-0 text-left">
          <p
            className={cn(
              "truncate font-sans text-caption",
              isActive
                ? "font-semibold text-fg"
                : "font-medium text-fg-secondary",
            )}
          >
            {step.label}
          </p>
          {showAlerts ? (
            <span
              className={cn(
                "mt-1 inline-flex rounded-md px-2 py-0.5 font-sans text-caption font-medium",
                step.alertCount > 0
                  ? "bg-warning-subtle text-fg-secondary"
                  : "bg-success/10 text-success",
              )}
            >
              {step.alertCount === 0
                ? "Sem alertas"
                : step.alertCount === 1
                  ? "1 alerta"
                  : `${step.alertCount.toLocaleString("pt-BR")} alertas`}
            </span>
          ) : step.selectable && step.state === "upcoming" ? null : !step.selectable ? (
            <span className="mt-1 inline-flex font-sans text-caption text-fg-muted">
              Em breve
            </span>
          ) : null}
        </div>
      </div>
    </>
  )

  return (
    <m.li
      aria-current={isSelected ? "step" : undefined}
      aria-label={`${index + 1}. ${step.label}. ${STEP_STATE_LABEL[step.state]}`}
      initial={
        reduced
          ? { opacity: 0 }
          : { opacity: 0, transform: "translateY(6px)" }
      }
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{
        duration: reduced ? 0.12 : 0.18,
        delay: reduced ? 0 : index * 0.035,
        ease: [0.23, 1, 0.32, 1],
      }}
      className={cn(
        "relative z-10 rounded-xl",
        "transition-[background-color,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
        isActive && "border border-accent/20 bg-surface/80 shadow-card",
      )}
    >
      {step.selectable && onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(step.id)}
          className="grid min-h-14 w-full grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 rounded-xl px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          {body}
        </button>
      ) : (
        <div className="grid min-h-14 grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 px-2 py-1.5">
          {body}
        </div>
      )}
    </m.li>
  )
}
