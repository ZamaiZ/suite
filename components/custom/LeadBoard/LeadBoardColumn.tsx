"use client"

import { useDroppable } from "@dnd-kit/react"
import type { LeadAssignmentPatch } from "@/app/actions/leads"
import { LeadCreate } from "@/components/custom/LeadCreate"
import {
  RiCalendarEventLine,
  RiBuilding2Line,
  RiChat3Line,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiDragMoveLine,
  RiInboxLine,
} from "react-icons/ri"
import { cn } from "cn"
import {
  BOARD_COLUMN_DOT,
  BOARD_COLUMN_EMPTY,
  BOARD_COLUMN_LABELS,
  isBoardColumnId,
  isLegalBoardMove,
  type BoardColumnId,
} from "@/lib/leads/board"
import { LeadBoardCard } from "./LeadBoardCard"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import type { LeadBoardItem } from "./LeadBoard.types"

const EMPTY_ICON = {
  new: RiInboxLine,
  contacting: RiChat3Line,
  follow_up: RiCalendarEventLine,
  interested: RiCheckboxCircleLine,
  denied: RiCloseCircleLine,
  converted: RiBuilding2Line,
} as const

export function readDragColumn(data: unknown): unknown {
  if (!data || typeof data !== "object") return undefined
  if (!("columnId" in data)) return undefined
  return data.columnId
}

export function LeadBoardColumn({
  columnId,
  leads,
  selectedId,
  canDrag,
  allowActions,
  currentUserId,
  draggingFrom,
  hrefForLead,
  onOpen,
  onAssigned,
  onBoardError,
  onLeadCreated,
}: {
  columnId: BoardColumnId
  leads: LeadBoardItem[]
  selectedId: string | null
  canDrag: boolean
  allowActions: boolean
  currentUserId: string
  draggingFrom: unknown
  hrefForLead: (id: string) => string
  onOpen: (id: string, href: string) => void
  onAssigned: (leadId: string, patch: LeadAssignmentPatch) => void
  onBoardError: (message: string | null) => void
  onLeadCreated?: (item: LeadBoardItem) => void
}) {
  const legalTarget =
    isBoardColumnId(draggingFrom) && isLegalBoardMove(draggingFrom, columnId)
  const { ref, isDropTarget } = useDroppable({
    id: columnId,
    accept: "lead",
    disabled: Boolean(draggingFrom) && !legalTarget,
  })
  const empty = BOARD_COLUMN_EMPTY[columnId]
  const EmptyIcon = EMPTY_ICON[columnId]
  const showDrop = Boolean(draggingFrom) && legalTarget

  return (
    <section
      ref={ref}
      className={cn(
        "flex min-h-0 w-72 shrink-0 flex-col overflow-hidden rounded-xl border bg-card",
        "transition-[border-color,background-color] duration-150 ease-out",
        isDropTarget && legalTarget
          ? "border-primary bg-primary/5"
          : "border-border",
      )}
    >
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-2 border-b border-border/70 px-3 py-2.5">
        <h2 className="font-heading flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          <span
            aria-hidden
            className={cn(
              "size-2 shrink-0 rounded-full",
              BOARD_COLUMN_DOT[columnId],
            )}
          />
          {BOARD_COLUMN_LABELS[columnId]}
        </h2>
        <div className="flex items-center gap-1.5">
          <span className="text-xs/relaxed text-muted-foreground">
            {leads.length}
          </span>
          {columnId === "new" ? <LeadCreate onCreated={onLeadCreated} /> : null}
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 scrollbar-none [&::-webkit-scrollbar]:hidden">
        {leads.length === 0 && !showDrop ? (
          <Empty className="min-h-36 gap-3 p-3">
            <EmptyHeader>
              <EmptyMedia>
                <EmptyIcon
                  size={22}
                  aria-hidden
                  className="text-muted-foreground opacity-60"
                />
              </EmptyMedia>
              <EmptyTitle>{empty.title}</EmptyTitle>
              <EmptyDescription>{empty.body}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
        {leads.map((lead) => (
          <LeadBoardCard
            key={lead.id}
            lead={lead}
            columnId={columnId}
            href={hrefForLead(lead.id)}
            selected={lead.id === selectedId}
            canDrag={canDrag}
            allowActions={allowActions}
            currentUserId={currentUserId}
            onOpen={onOpen}
            onAssigned={onAssigned}
            onBoardError={onBoardError}
          />
        ))}
        {showDrop ? (
          <div
            className={cn(
              "mt-auto rounded-lg border border-dashed border-primary/60 px-3 py-2.5",
              "text-center transition-opacity duration-150 ease-out",
            )}
          >
            <p className="inline-flex items-center gap-1.5 text-xs/relaxed font-medium text-primary">
              <RiDragMoveLine size={14} aria-hidden />
              Solte os leads aqui
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}
