"use client"

import { RiCloseLine } from "react-icons/ri"
import {
  ClientPortalMenu,
  type ClientPortalSnapshot,
} from "@/components/custom/ClientCardMenu"
import { getLeadInitials } from "@/components/custom/LeadBoard/LeadBoardCardFace"
import { Button } from "@/components/ui/button"
import { cn } from "cn"

const TONE_CLASS = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  muted: "bg-muted-foreground/10 text-muted-foreground",
}

export function ClientBriefingDialogHeader({
  companyName,
  clientId,
  portalSnapshot,
  statusLabel,
  statusTone,
  completedCount,
  closeDisabled,
  onClose,
}: {
  companyName: string
  /**
   * Sem cliente identificado não há menu: o diálogo abre em transição com
   * `clientId` nulo, e um menu que não sabe de quem é não tem o que fazer.
   */
  clientId?: string | null
  portalSnapshot?: ClientPortalSnapshot
  statusLabel?: string
  statusTone: keyof typeof TONE_CLASS
  completedCount?: number
  closeDisabled: boolean
  onClose: () => void
}) {
  return (
    <header className="grid min-h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 bg-popover px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2.5 py-2">
        <span
          aria-hidden
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs/relaxed font-semibold tracking-wide text-primary"
        >
          {getLeadInitials(companyName)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs/relaxed font-semibold text-foreground">
            {companyName}
          </p>
          <p className="text-xs/relaxed text-muted-foreground">
            Briefing interno
          </p>
        </div>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-1.5 py-2">
        {statusLabel ? (
          <span
            className={cn(
              "inline-flex rounded-md px-2 py-0.5 text-xs/relaxed font-medium",
              TONE_CLASS[statusTone],
            )}
          >
            {statusLabel}
          </span>
        ) : null}
        {typeof completedCount === "number" ? (
          <span className="inline-flex rounded-md bg-background px-2 py-0.5 text-xs/relaxed font-medium tabular-nums text-muted-foreground">
            {completedCount}/8
          </span>
        ) : null}
        {clientId ? (
          <ClientPortalMenu clientId={clientId} snapshot={portalSnapshot} />
        ) : null}
        <Button
          type="button"
          variant="ghost"
          aria-label="Fechar"
          disabled={closeDisabled}
          onClick={onClose}
          size="icon-lg"
          className="shrink-0"
        >
          <RiCloseLine size={18} aria-hidden />
        </Button>
      </div>
    </header>
  )
}
