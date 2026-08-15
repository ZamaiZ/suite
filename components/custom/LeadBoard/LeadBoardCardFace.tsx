"use client"

import { RiCalendarEventLine, RiChat3Line, RiTimeLine } from "react-icons/ri"
import { LEAD_ACTIVITY_CHANNEL_ICONS } from "@/components/custom/LeadActivityChannelPicker"
import { LeadTagChips } from "@/components/custom/LeadTagField"
import { Tooltip } from "@/components/ui/Tooltip"
import { cn } from "@/lib/cn"
import {
  formatDateTimeShort,
  formatTimeShort,
  getCivilFollowUpKind,
} from "@/lib/date-time"
import {
  LEAD_ACTIVITY_CHANNEL_LABELS,
  type LeadActivityChannel,
} from "@/lib/leads/channel"
import { isPendingDailyActivity } from "@/lib/leads/daily-activity"
import type { LeadBoardItem } from "./LeadBoard.types"

const CHIP_CHANNELS: LeadActivityChannel[] = [
  "call",
  "whatsapp",
  "email",
  "other",
]

export function getLeadInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  const first = parts[0][0] ?? ""
  const last = parts[parts.length - 1][0] ?? ""
  return `${first}${last}`.toUpperCase()
}

function FollowUpMark({ at }: { at: string }) {
  const kind = getCivilFollowUpKind(at)
  const full = formatDateTimeShort(at)
  const time = formatTimeShort(at)

  if (kind === "later") {
    return (
      <Tooltip content={full} side="right" tone="accent">
        <span className="inline-flex size-6 items-center justify-center rounded-md bg-accent/10 text-accent">
          <RiCalendarEventLine size={14} aria-hidden />
          <span className="sr-only">Retorno {full}</span>
        </span>
      </Tooltip>
    )
  }

  const overdue = kind === "overdue"
  const label = overdue ? "Atrasado" : "Hoje"

  return (
    <span
      title={full}
      className={cn(
        "inline-flex h-4 items-center gap-1 rounded-md px-1",
        "font-sans text-[10px] font-medium leading-none tabular-nums",
        overdue ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning",
      )}
    >
      <RiTimeLine size={13} aria-hidden />
      {label} · {time}
      <span className="sr-only">Retorno {full}</span>
    </span>
  )
}

export function LeadBoardCardFace({
  lead,
  showOwner,
}: {
  lead: LeadBoardItem
  showOwner: boolean
}) {
  const visibleChannels = CHIP_CHANNELS.filter(
    (channel) => lead.activity_counts[channel] > 0,
  )
  const pendingActivity = isPendingDailyActivity(lead)

  return (
    <div className="flex min-w-0 items-start gap-3">
      <span
        aria-hidden
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10 font-sans text-caption font-semibold tracking-caption text-accent"
      >
        {getLeadInitials(lead.company_name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-body-sm font-semibold text-fg">
          {lead.company_name}
        </p>
        <p className="truncate font-sans text-caption text-fg-muted">
          {lead.website_domain}
        </p>
        {visibleChannels.length > 0 || lead.next_follow_up_at || pendingActivity ? (
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
            {pendingActivity ? (
              <Tooltip content="Sem atividade hoje" side="right" tone="accent">
                <span className="inline-flex size-6 items-center justify-center rounded-md bg-accent/10 text-accent">
                  <RiChat3Line size={14} aria-hidden />
                  <span className="sr-only">Sem atividade hoje</span>
                </span>
              </Tooltip>
            ) : null}
            {visibleChannels.map((channel) => {
              const Icon = LEAD_ACTIVITY_CHANNEL_ICONS[channel]
              const count = lead.activity_counts[channel]
              return (
                <span
                  key={channel}
                  className={cn(
                    "inline-flex items-center gap-0.5 font-sans text-caption tabular-nums",
                    channel === "whatsapp" ? "text-success" : "text-fg-muted",
                  )}
                  aria-label={`${count} ${LEAD_ACTIVITY_CHANNEL_LABELS[channel]}`}
                >
                  <Icon size={12} aria-hidden />
                  {count}
                </span>
              )
            })}
            {lead.next_follow_up_at ? (
              <FollowUpMark at={lead.next_follow_up_at} />
            ) : null}
          </div>
        ) : null}
        {lead.tags.length > 0 ? (
          <div className="mt-1.5">
            <LeadTagChips tags={lead.tags} max={2} compact />
          </div>
        ) : null}
        {lead.from_denial ? (
          <span className="mt-1.5 inline-flex rounded-md bg-danger/10 px-2 py-0.5 font-sans text-caption font-medium text-danger">
            Negativa
          </span>
        ) : null}
        {showOwner && lead.assignee_name ? (
          <p className="mt-1 truncate font-sans text-caption text-fg-muted">
            {lead.assignee_name}
          </p>
        ) : null}
      </div>
    </div>
  )
}
