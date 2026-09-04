"use client"

import { useEffect, useRef, type MouseEvent } from "react"
import { useDraggable } from "@dnd-kit/react"
import type { LeadAssignmentPatch } from "@/app/actions/leads"
import { LeadClaimActions } from "@/components/custom/LeadClaimActions"
import { cn } from "@/lib/cn"
import { clientsListHref } from "@/lib/clients/href"
import type { BoardColumnId } from "@/lib/leads/board"
import { leadAccessFlags } from "@/lib/leads/board-item"
import { LeadBoardCardFace } from "./LeadBoardCardFace"
import type { LeadBoardItem } from "./LeadBoard.types"

function isModifiedClick(event: MouseEvent) {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
}

export function LeadBoardCard({
  lead,
  columnId,
  href,
  selected,
  canDrag,
  allowActions,
  currentUserId,
  onOpen,
  onAssigned,
  onBoardError,
}: {
  lead: LeadBoardItem
  columnId: BoardColumnId
  href: string
  selected: boolean
  canDrag: boolean
  allowActions: boolean
  currentUserId: string
  onOpen: (id: string, href: string) => void
  onAssigned: (leadId: string, patch: LeadAssignmentPatch) => void
  onBoardError: (message: string | null) => void
}) {
  const { ref, isDragging } = useDraggable({
    id: lead.id,
    type: "lead",
    data: { columnId, leadId: lead.id },
    disabled: !canDrag || columnId === "converted",
  })
  const draggedRef = useRef(false)
  const flags = leadAccessFlags(lead)
  const showMenu =
    allowActions && (flags.canClaim || flags.canUnclaim)
  const clientHref =
    lead.client_id && lead.can_view_client
      ? clientsListHref({ client: lead.client_id })
      : null

  useEffect(() => {
    if (isDragging) draggedRef.current = true
  }, [isDragging])

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-border bg-surface",
        "transition-[background-color,opacity,transform] duration-150 ease-out",
        "hover:bg-hover",
        selected && "bg-hover",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start">
        <a
          href={href}
          onClick={(event) => {
            if (isModifiedClick(event)) return
            event.preventDefault()
            if (draggedRef.current) {
              draggedRef.current = false
              return
            }
            onOpen(lead.id, href)
          }}
          className={cn(
            "min-w-0 flex-1 p-3",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            "active:scale-[0.97]",
          )}
        >
          <LeadBoardCardFace lead={lead} currentUserId={currentUserId} />
        </a>
        {showMenu ? (
          <div
            className="shrink-0 pt-1.5 pr-1.5"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <LeadClaimActions
              leadId={lead.id}
              canClaim={flags.canClaim}
              canUnclaim={flags.canUnclaim}
              variant="menu"
              onSuccess={(result) => {
                onBoardError(null)
                onAssigned(lead.id, result.patch)
              }}
              onError={onBoardError}
            />
          </div>
        ) : null}
      </div>
      {clientHref ? (
        <a
          href={clientHref}
          onPointerDown={(event) => event.stopPropagation()}
          className="mx-3 mb-3 inline-flex h-7 items-center rounded-md bg-success/10 px-2 font-sans text-caption font-medium text-success transition-colors hover:bg-success/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Abrir cliente
        </a>
      ) : null}
    </div>
  )
}
