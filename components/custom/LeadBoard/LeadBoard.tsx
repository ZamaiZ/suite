"use client"

import {
  useEffect,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react"
import {
  DragDropProvider,
  DragOverlay,
  PointerSensor,
  useDragOperation,
} from "@dnd-kit/react"
import { PointerActivationConstraints } from "@dnd-kit/dom"
import { RiDragMoveLine } from "react-icons/ri"
import {
  claimLead,
  logLeadActivity,
  type LeadAssignmentPatch,
} from "@/app/actions/leads"
import { LeadDetailDialog } from "@/components/custom/LeadDetailDialog"
import { cn } from "cn"
import { getCivilFollowUpKind } from "@/lib/date-time"
import {
  BOARD_COLUMNS,
  groupLeadsByColumn,
  isBoardColumnId,
  isLegalBoardMove,
} from "@/lib/leads/board"
import { incrementChannelCount } from "@/lib/leads/channel"
import {
  isPendingDailyActivity,
  matchesPendingFilter,
} from "@/lib/leads/daily-activity"
import { isLeadId, leadsListHref } from "@/lib/leads/queues"
import { leadHasTagSlug } from "@/lib/leads/tags"
import { LeadBoardCardFace } from "./LeadBoardCardFace"
import { LeadBoardColumn, readDragColumn } from "./LeadBoardColumn"
import { LeadBoardToolbar } from "./LeadBoardToolbar"
import {
  LeadDropDialogs,
  type LeadDropCommit,
  type LeadDropRequest,
} from "./LeadDropDialogs"
import type { LeadBoardItem, LeadBoardProps } from "./LeadBoard.types"

type LeadBoardMove = {
  leadId: string
  patch: Partial<LeadBoardItem>
}

const pointerSensor = PointerSensor.configure({
  preventActivation: (event: PointerEvent) => event.pointerType === "touch",
  activationConstraints: [
    new PointerActivationConstraints.Distance({ value: 8 }),
  ],
})

function readLeadIdFromLocation(): string | null {
  if (typeof window === "undefined") return null
  const value = new URLSearchParams(window.location.search).get("lead")
  return isLeadId(value) ? value : null
}

function useFinePointer() {
  const [fine, setFine] = useState(false)
  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)")
    function update() {
      setFine(media.matches)
    }
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])
  return fine
}

function DraggingColumnReader({
  onColumnChange,
}: {
  onColumnChange: (column: unknown) => void
}) {
  const { source } = useDragOperation()
  const column = readDragColumn(source?.data)
  useEffect(() => {
    onColumnChange(column)
  }, [column, onColumnChange])
  return null
}

function applyLeadPatch(
  current: LeadBoardItem[],
  leadId: string,
  patch: Partial<LeadBoardItem>,
) {
  return current.map((lead) =>
    lead.id === leadId ? { ...lead, ...patch } : lead,
  )
}

function isDueFollowUp(lead: {
  status: string
  next_follow_up_at: string | null
  closing_meeting_at: string | null
}): boolean {
  if (lead.status === "converted") return false
  const times = [lead.next_follow_up_at, lead.closing_meeting_at]
  return times.some((at) => {
    if (!at) return false
    const kind = getCivilFollowUpKind(at)
    return kind === "overdue" || kind === "today"
  })
}

export function LeadBoard({
  leads,
  currentUserId,
  listParams,
  tagOptions,
  segmentOptions,
  canViewTeamLeads,
  initialLeadId = null,
}: LeadBoardProps) {
  const finePointer = useFinePointer()
  const [, startTransition] = useTransition()
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window !== "undefined") return readLeadIdFromLocation()
    return initialLeadId ?? null
  })
  const [dropRequest, setDropRequest] = useState<LeadDropRequest | null>(null)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [draggingFrom, setDraggingFrom] = useState<unknown>(undefined)
  const [items, setItems] = useState(leads)
  const [optimisticLeads, moveLead] = useOptimistic(
    items,
    (current, action: LeadBoardMove) =>
      applyLeadPatch(current, action.leadId, action.patch),
  )

  useEffect(() => {
    setItems(leads)
  }, [leads])

  const canDrag = !listParams.team && finePointer
  const visibleLeads = useMemo(
    () =>
      optimisticLeads.filter((lead) =>
        matchesPendingFilter(lead, listParams.pending),
      ),
    [optimisticLeads, listParams.pending],
  )
  const grouped = useMemo(
    () => groupLeadsByColumn(visibleLeads),
    [visibleLeads],
  )
  const dueTodayCount = useMemo(
    () =>
      optimisticLeads.reduce(
        (count, lead) => count + (isDueFollowUp(lead) ? 1 : 0),
        0,
      ),
    [optimisticLeads],
  )
  const pendingCount = useMemo(
    () =>
      optimisticLeads.reduce(
        (count, lead) => count + (isPendingDailyActivity(lead) ? 1 : 0),
        0,
      ),
    [optimisticLeads],
  )

  const leadsById = useMemo(() => {
    const map = new Map<string, LeadBoardItem>()
    for (const lead of optimisticLeads) map.set(lead.id, lead)
    return map
  }, [optimisticLeads])

  useEffect(() => {
    function onPopState() {
      setSelectedId(readLeadIdFromLocation())
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  function openLead(id: string, href: string) {
    setSelectedId(id)
    window.history.pushState(null, "", href)
  }

  function closeLead() {
    setSelectedId(null)
    window.history.pushState(null, "", leadsListHref(listParams))
  }

  function hrefForLead(id: string) {
    return leadsListHref({ ...listParams, lead: id })
  }

  function addItem(item: LeadBoardItem) {
    if (listParams.tag && !leadHasTagSlug(item.tags, listParams.tag)) return
    setItems((current) => {
      if (current.some((lead) => lead.id === item.id)) return current
      return [item, ...current]
    })
  }

  function patchItem(leadId: string, patch: Partial<LeadBoardItem>) {
    if (
      listParams.tag &&
      patch.tags &&
      !leadHasTagSlug(patch.tags, listParams.tag)
    ) {
      setItems((current) => current.filter((lead) => lead.id !== leadId))
      return
    }
    setItems((current) => applyLeadPatch(current, leadId, patch))
  }

  function handleAssigned(leadId: string, patch: LeadAssignmentPatch) {
    setBoardError(null)
    patchItem(leadId, patch)
  }

  function handleDropCommit({ formData, patch }: LeadDropCommit) {
    const leadId = String(formData.get("lead_id"))
    const current = leadsById.get(leadId)
    const nextCount = (current?.activity_count ?? 0) + 1
    const nextCounts = incrementChannelCount(
      current?.activity_counts,
      formData.get("channel"),
    )
    setDropRequest(null)
    setBoardError(null)
    startTransition(async () => {
      moveLead({
        leadId,
        patch: {
          ...patch,
          activity_count: nextCount,
          activity_counts: nextCounts,
          last_activity_at: new Date().toISOString(),
        },
      })
      const result = await logLeadActivity(formData)
      if (result.status === "error") {
        setBoardError(result.message)
        return
      }
      patchItem(leadId, {
        ...result.patch,
        activity_count: nextCount,
        activity_counts: incrementChannelCount(
          current?.activity_counts,
          result.activity.channel,
        ),
      })
    })
  }

  const selected = selectedId ? (leadsById.get(selectedId) ?? null) : null
  const scopeLabel =
    listParams.team && canViewTeamLeads ? "Todos" : "Minha carteira"
  const countLabel =
    optimisticLeads.length === 1 ? "1 lead" : `${optimisticLeads.length} leads`

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
      <LeadBoardToolbar
        listParams={listParams}
        tagOptions={tagOptions}
        segmentOptions={segmentOptions}
        canViewTeamLeads={canViewTeamLeads}
        dueTodayCount={dueTodayCount}
        pendingCount={pendingCount}
      />
      <div className="flex shrink-0 items-center gap-3">
        <p className="min-w-0 text-xs/relaxed text-muted-foreground">
          {scopeLabel} · {countLabel}
          {listParams.team ? " · somente leitura" : ""}
        </p>
        {canDrag ? (
          <p className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-xs/relaxed text-muted-foreground">
            <RiDragMoveLine size={14} aria-hidden />
            Arraste os leads entre as etapas
          </p>
        ) : null}
      </div>
      {boardError ? (
        <p role="alert" className="shrink-0 text-xs/relaxed text-destructive">
          {boardError}
        </p>
      ) : null}
      <DragDropProvider
        sensors={[pointerSensor]}
        onDragEnd={(event) => {
          setDraggingFrom(undefined)
          if (event.canceled) return
          const source = event.operation.source
          const target = event.operation.target
          if (!source || !target) return
          const from = readDragColumn(source.data)
          const to = target.id
          if (!isBoardColumnId(from) || !isBoardColumnId(to)) return
          if (!isLegalBoardMove(from, to)) return
          const leadId = String(source.id)
          const lead = leadsById.get(leadId)
          if (!lead) return

          if (from === "new" && to === "contacting") {
            setBoardError(null)
            const formData = new FormData()
            formData.set("lead_id", leadId)
            startTransition(async () => {
              moveLead({
                leadId,
                patch: {
                  status: "contacting",
                  assigned_sdr_id: currentUserId,
                },
              })
              const result = await claimLead(formData)
              if (result.status === "error") {
                setBoardError(result.message)
                return
              }
              patchItem(leadId, result.patch)
            })
            return
          }

          if (to === "follow_up") {
            setDropRequest({
              kind: "follow_up",
              leadId,
              companyName: lead.company_name,
              websiteDomain: lead.website_domain,
            })
            return
          }

          if (to === "denied") {
            setDropRequest({
              kind: "denied",
              leadId,
              companyName: lead.company_name,
              websiteDomain: lead.website_domain,
            })
            return
          }

          if (to === "interested") {
            setDropRequest({
              kind: "interested",
              leadId,
              companyName: lead.company_name,
              websiteDomain: lead.website_domain,
            })
          }
        }}
      >
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <DraggingColumnReader onColumnChange={setDraggingFrom} />
          <div className="flex min-h-0 min-w-0 flex-1 items-stretch gap-3 overflow-x-auto overflow-y-hidden scrollbar-none [&::-webkit-scrollbar]:hidden pb-1">
            {BOARD_COLUMNS.map((columnId) => (
              <LeadBoardColumn
                key={columnId}
                columnId={columnId}
                leads={grouped[columnId]}
                selectedId={selectedId}
                canDrag={canDrag}
                allowActions={!listParams.team}
                currentUserId={currentUserId}
                draggingFrom={draggingFrom}
                hrefForLead={hrefForLead}
                onOpen={openLead}
                onAssigned={handleAssigned}
                onBoardError={setBoardError}
                onLeadCreated={addItem}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
            {(source) => {
              const lead = leadsById.get(String(source.id))
              if (!lead) return null
              return (
                <div
                  className={cn(
                    "w-72 rounded-lg border border-border bg-popover p-3 shadow-xs",
                    "scale-[1.02]",
                  )}
                >
                  <LeadBoardCardFace
                    lead={lead}
                    currentUserId={currentUserId}
                  />
                </div>
              )
            }}
          </DragOverlay>
        </div>
      </DragDropProvider>
      <LeadDetailDialog
        open={selectedId !== null}
        onClose={closeLead}
        leadId={selectedId}
        readOnly={listParams.team || selected?.status === "converted"}
        onMutated={(patch) => {
          if (!selectedId) return
          patchItem(selectedId, patch)
        }}
        preview={
          selected
            ? {
                company_name: selected.company_name,
                website_domain: selected.website_domain,
                status: selected.status,
                next_follow_up_at: selected.next_follow_up_at,
                activity_count: selected.activity_count,
                assignee_name: selected.assignee_name,
              }
            : null
        }
      />
      <LeadDropDialogs
        request={dropRequest}
        onClose={() => setDropRequest(null)}
        onCommit={handleDropCommit}
      />
    </div>
  )
}
