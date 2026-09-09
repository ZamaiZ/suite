"use client"

import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiCloseLine, RiExternalLinkLine, RiHistoryLine } from "react-icons/ri"
import { getLeadInitials } from "@/components/custom/LeadBoard/LeadBoardCardFace"
import { LeadClaimActions } from "@/components/custom/LeadClaimActions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "cn"
import { LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/leads/status"
import { CLOSING_STAGE_LABELS, type ClosingStage } from "@/lib/leads/closing"
import { canonicalWebsiteUrl } from "@/lib/leads/website"
import { clientsListHref } from "@/lib/clients/href"
import type { LeadAssignmentPatch } from "@/app/actions/leads"
import type { LeadDetailTab } from "./LeadDetailDialog.types"

const STATUS_TONE: Record<LeadStatus, string> = {
  new: "bg-accent text-muted-foreground",
  contacting: "bg-primary/10 text-primary",
  follow_up: "bg-warning/10 text-warning",
  denied: "bg-destructive/10 text-destructive",
  interested: "bg-success/10 text-success",
  converted: "bg-success/10 text-success",
}

const TABS: { id: LeadDetailTab; label: string }[] = [
  { id: "activity", label: "Atividade" },
  { id: "record", label: "Cadastro" },
  { id: "opportunity", label: "Oportunidade" },
]

export function LeadDetailHeader({
  tab,
  showOpportunityTab,
  companyName,
  domain,
  status,
  closingStage,
  activityCount,
  leadId,
  canClaim,
  canUnclaim,
  createdByName,
  clientId,
  canViewClient,
  readOnly,
  closeDisabled,
  onClose,
  onClaimSuccess,
  onClaimPending,
  onClaimError,
}: {
  tab: LeadDetailTab
  showOpportunityTab: boolean
  companyName: string
  domain?: string
  status: LeadStatus | null
  closingStage: ClosingStage | null
  activityCount: number
  leadId: string | null
  canClaim: boolean
  canUnclaim: boolean
  createdByName: string | null
  clientId: string | null
  canViewClient: boolean
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
    <div className="grid min-h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-3 border-b border-border/70 bg-popover px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2 py-2">
        <span
          aria-hidden
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs/relaxed font-semibold tracking-wide text-primary"
        >
          {getLeadInitials(companyName)}
        </span>
        {clientId && canViewClient ? (
          <a
            href={clientsListHref({ client: clientId })}
            className="inline-flex h-7 items-center rounded-md bg-success/10 px-2 text-xs/relaxed font-medium text-success transition-colors hover:bg-success/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Abrir cliente
          </a>
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-xs/relaxed font-semibold text-foreground">
            {companyName}
          </p>
          {domain ? (
            <a
              href={canonicalWebsiteUrl(domain)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-1 truncate text-xs/relaxed text-muted-foreground transition-colors duration-150 ease-out hover:text-primary"
            >
              <span className="truncate">{domain}</span>
              <RiExternalLinkLine size={12} aria-hidden className="shrink-0" />
            </a>
          ) : null}
        </div>
      </div>

      <TabsList
        variant="line"
        aria-label="Seções do lead"
        className="h-auto items-stretch gap-5 self-center p-0"
      >
        {TABS.filter(
          (item) => item.id !== "opportunity" || showOpportunityTab,
        ).map((item) => (
          <TabsTrigger
            key={item.id}
            value={item.id}
            // O sublinhado é o `m.span` com layoutId abaixo; o do registry sai.
            className="relative h-auto flex-none cursor-pointer rounded-none border-0 px-0 py-2 text-xs/relaxed font-medium after:hidden data-active:text-foreground"
          >
            {item.label}
            {tab === item.id ? (
              <m.span
                layoutId={reduced ? undefined : "lead-detail-tab-underline"}
                className="absolute inset-x-0 bottom-0 h-0.5 bg-primary"
                transition={{
                  duration: reduced ? 0.12 : 0.18,
                  ease: [0.23, 1, 0.32, 1],
                }}
              />
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="flex min-w-0 items-center justify-end gap-1.5 py-2">
        {status ? (
          <span
            className={cn(
              "inline-flex rounded-md px-2 py-0.5 text-xs/relaxed font-medium",
              STATUS_TONE[status],
            )}
          >
            {LEAD_STATUS_LABELS[status]}
          </span>
        ) : null}
        {status === "interested" && closingStage ? (
          <Badge variant="muted">{CLOSING_STAGE_LABELS[closingStage]}</Badge>
        ) : null}
        <span
          className="inline-flex items-center gap-1 text-xs/relaxed tabular-nums text-muted-foreground"
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
          size="icon-lg"
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
