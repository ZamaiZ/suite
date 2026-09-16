"use client"

import {
  RiCalendarEventLine,
  RiBuilding2Line,
  RiUser3Line,
} from "react-icons/ri"
import { ClientCardMenu } from "@/components/custom/ClientCardMenu"
import { getLeadInitials } from "@/components/custom/LeadBoard/LeadBoardCardFace"
import { formatDateTimeShort } from "@/lib/date-time"
import { cn } from "cn"
import type { ClientListItem } from "@/app/actions/clients"
import { Badge } from "@/components/ui/badge"
export function ClientListRow({
  client,
  onOpen,
}: {
  client: ClientListItem
  onOpen: () => void
}) {
  const interactive = client.canViewClient
  const rowClass = cn(
    "group flex items-center gap-3 px-4 py-3.5 transition-colors",
    interactive ? "cursor-pointer hover:bg-accent" : "opacity-75",
  )

  // O corpo sai do JSX da linha para não existir em duas versões: com menu,
  // quando há permissão, e sem menu, quando não há.
  const body = (
    <>
      <button
        type="button"
        onClick={interactive ? onOpen : undefined}
        disabled={!interactive}
        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs/relaxed font-semibold text-primary">
          {getLeadInitials(client.company_name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-xs/relaxed font-semibold text-foreground">
              {client.company_name}
            </span>
            <Badge variant="success">Início</Badge>
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-xs/relaxed font-medium",
                client.briefingStatus === "finalized"
                  ? "bg-success/10 text-success"
                  : client.briefingStatus === "edited_after_submit"
                    ? "bg-warning/10 text-warning"
                    : "bg-muted-foreground/10 text-muted-foreground",
              )}
            >
              {client.briefingStatusLabel}
            </span>
            {client.kickoffStage !== "none" ? (
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs/relaxed font-medium",
                  client.kickoffStage === "completed"
                    ? "bg-success/10 text-success"
                    : client.kickoffStage === "no_show"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/10 text-primary",
                )}
              >
                {client.kickoffStageLabel}
              </span>
            ) : null}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs/relaxed text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <RiUser3Line size={13} aria-hidden />
              {client.closer_name ?? "Sem closer"}
            </span>
            <span className="inline-flex items-center gap-1">
              <RiBuilding2Line size={13} aria-hidden />
              {client.websiteDomain ?? "Domínio não informado"}
            </span>
            <span>{formatDateTimeShort(client.converted_at)}</span>
            {client.kickoffMeetingAt ? (
              <span className="inline-flex items-center gap-1 text-primary">
                <RiCalendarEventLine size={13} aria-hidden />
                {formatDateTimeShort(client.kickoffMeetingAt)}
              </span>
            ) : null}
          </span>
        </span>
      </button>
    </>
  )

  return (
    <li>
      {interactive ? (
        // O `ClientCardMenu` É a linha: ele rende a div e acrescenta a setinha
        // depois do corpo. Sem permissão de ver o cliente, não há menu nenhum.
        <ClientCardMenu
          clientId={client.id}
          snapshot={{
            canManagePortal: client.canManagePortal,
            hasPortalAccess: client.hasPortalAccess,
            portalUrl: client.portalUrl,
          }}
          className={rowClass}
        >
          {body}
        </ClientCardMenu>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  )
}
