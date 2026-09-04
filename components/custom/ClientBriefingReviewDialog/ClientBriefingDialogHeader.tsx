"use client"

import { RiCloseLine } from "react-icons/ri"
import { getLeadInitials } from "@/components/custom/LeadBoard/LeadBoardCardFace"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/cn"

const TONE_CLASS = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  muted: "bg-fg-muted/10 text-fg-muted",
}

export function ClientBriefingDialogHeader({
  companyName,
  statusLabel,
  statusTone,
  completedCount,
  closeDisabled,
  onClose,
}: {
  companyName: string
  statusLabel?: string
  statusTone: keyof typeof TONE_CLASS
  completedCount?: number
  closeDisabled: boolean
  onClose: () => void
}) {
  return (
    <header className="grid min-h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border-subtle bg-elevated px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2.5 py-2">
        <span
          aria-hidden
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/10 font-sans text-caption font-semibold tracking-caption text-accent"
        >
          {getLeadInitials(companyName)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-sans text-body-sm font-semibold text-fg">
            {companyName}
          </p>
          <p className="font-sans text-caption text-fg-muted">
            Briefing interno
          </p>
        </div>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-1.5 py-2">
        {statusLabel ? (
          <span
            className={cn(
              "inline-flex rounded-md px-2 py-0.5 font-sans text-caption font-medium",
              TONE_CLASS[statusTone],
            )}
          >
            {statusLabel}
          </span>
        ) : null}
        {typeof completedCount === "number" ? (
          <span className="inline-flex rounded-md bg-canvas px-2 py-0.5 font-sans text-caption font-medium tabular-nums text-fg-secondary">
            {completedCount}/8
          </span>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          aria-label="Fechar"
          disabled={closeDisabled}
          onClick={onClose}
          className="size-9 shrink-0 px-0"
        >
          <RiCloseLine size={18} aria-hidden />
        </Button>
      </div>
    </header>
  )
}
