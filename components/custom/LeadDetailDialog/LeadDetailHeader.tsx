"use client"

import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiCloseLine, RiExternalLinkLine, RiHistoryLine } from "react-icons/ri"
import { getLeadInitials } from "@/components/custom/LeadBoard/LeadBoardCardFace"
import { LeadClaimActions } from "@/components/custom/LeadClaimActions"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/cn"
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/leads/status"
import { canonicalWebsiteUrl } from "@/lib/leads/website"
import type { LeadAssignmentPatch } from "@/app/actions/leads"
import type { LeadDetailTab } from "./LeadDetailDialog.types"

const STATUS_TONE: Record<LeadStatus, string> = {
  new: "bg-hover text-fg-secondary",
  contacting: "bg-accent/10 text-accent",
  follow_up: "bg-warning/10 text-warning",
  denied: "bg-danger/10 text-danger",
  interested: "bg-success/10 text-success",
}

const TABS: { id: LeadDetailTab; label: string }[] = [
  { id: "activity", label: "Atividade" },
  { id: "record", label: "Cadastro" },
  { id: "opportunity", label: "Oportunidade" },
]

export function LeadDetailHeader({
  tab,
  onTabChange,
  companyName,
  domain,
  status,
  activityCount,
  leadId,
  canClaim,
  canUnclaim,
  createdByName,
  readOnly,
  closeDisabled,
  onClose,
  onClaimSuccess,
  onClaimPending,
  onClaimError,
}: {
  tab: LeadDetailTab
  onTabChange: (tab: LeadDetailTab) => void
  companyName: string
  domain?: string
  status: LeadStatus | null
  activityCount: number
  leadId: string | null
  canClaim: boolean
  canUnclaim: boolean
  createdByName: string | null
  readOnly: boolean
  closeDisabled: boolean
  onClose: () => void
  onClaimSuccess: (patch: LeadAssignmentPatch) => void
  onClaimPending: (pending: boolean) => void
  onClaimError: (message: string | null) => void
}) {
  const reduced = !!useReducedMotion()
  const activityLabel =
    activityCount === 1 ? "1 atividade" : `${activityCount} atividades`

  return (
    <div className="grid min-h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-3 border-b border-border-subtle bg-elevated px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2 py-2">
        <span
          aria-hidden
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/10 font-sans text-caption font-semibold tracking-caption text-accent"
        >
          {getLeadInitials(companyName)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-sans text-body-sm font-semibold text-fg">
            {companyName}
          </p>
          {domain ? (
            <a
              href={canonicalWebsiteUrl(domain)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-1 truncate font-sans text-caption text-fg-muted transition-colors duration-150 ease-out hover:text-accent"
            >
              <span className="truncate">{domain}</span>
              <RiExternalLinkLine size={12} aria-hidden className="shrink-0" />
            </a>
          ) : null}
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Seções do lead"
        className="flex items-stretch gap-5"
      >
        {TABS.filter(
          (item) => item.id !== "opportunity" || status === "interested",
        ).map((item) => {
          const selected = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`lead-tab-${item.id}`}
              aria-controls={`lead-detail-${item.id}`}
              aria-selected={selected}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "relative cursor-pointer font-sans text-body-sm font-medium transition-colors duration-150 ease-out",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                selected ? "text-fg" : "text-fg-muted hover:text-fg",
              )}
            >
              {item.label}
              {selected ? (
                <m.span
                  layoutId={reduced ? undefined : "lead-detail-tab-underline"}
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-accent"
                  transition={{
                    duration: reduced ? 0.12 : 0.18,
                    ease: [0.23, 1, 0.32, 1],
                  }}
                />
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="flex min-w-0 items-center justify-end gap-1.5 py-2">
        {status ? (
          <span
            className={cn(
              "inline-flex rounded-md px-2 py-0.5 font-sans text-caption font-medium",
              STATUS_TONE[status],
            )}
          >
            {LEAD_STATUS_LABELS[status]}
          </span>
        ) : null}
        <span
          className="inline-flex items-center gap-1 font-sans text-caption tabular-nums text-fg-muted"
          aria-label={activityLabel}
        >
          <RiHistoryLine size={14} aria-hidden />
          {activityLabel}
        </span>
        {leadId ? (
          <LeadClaimActions
            variant="menu"
            leadId={leadId}
            canClaim={canClaim && !readOnly}
            canUnclaim={canUnclaim && !readOnly}
            createdByName={createdByName}
            onSuccess={(result) => {
              onClaimError(null)
              onClaimSuccess(result.patch)
            }}
            onPendingChange={onClaimPending}
            onError={onClaimError}
          />
        ) : null}
        <Button
          type="button"
          variant="ghost"
          aria-label="Fechar"
          onClick={onClose}
          disabled={closeDisabled}
          className="size-9 shrink-0 px-0"
        >
          <RiCloseLine size={18} aria-hidden />
        </Button>
      </div>
    </div>
  )
}
