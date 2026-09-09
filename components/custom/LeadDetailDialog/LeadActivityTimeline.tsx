"use client"

import { useState } from "react"
import * as m from "motion/react-m"
import { useReducedMotion } from "motion/react"
import { RiFilter3Line } from "react-icons/ri"
import { LEAD_ACTIVITY_CHANNEL_ICONS } from "@/components/custom/LeadActivityChannelPicker"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "cn"
import { formatDateTimeShort } from "@/lib/date-time"
import {
  activityChannelLabel,
  isLeadActivityChannel,
  LEAD_ACTIVITY_CHANNEL_LABELS,
  LEAD_ACTIVITY_CHANNELS,
  type LeadActivityChannel,
} from "@/lib/leads/channel"
import {
  isLeadActivityType,
  LEAD_ACTIVITY_TYPE_LABELS,
  type LeadActivityType,
} from "@/lib/leads/status"
import type { LeadDetailActivity } from "@/lib/leads/types"
import { LeadIconWell } from "./LeadIconWell"

const EASE = [0.23, 1, 0.32, 1] as const

const TYPE_DOT: Record<LeadActivityType, string> = {
  no_contact: "bg-primary",
  call_later: "bg-warning",
  denied: "bg-destructive",
  interested: "bg-success",
  meeting_rescheduled: "bg-primary",
  meeting_no_show: "bg-warning",
  closing_standby: "bg-warning",
  closing_lost: "bg-destructive",
  closing_won: "bg-success",
}

type ChannelFilter = "all" | LeadActivityChannel

const FILTER_ITEMS = [
  { value: "all", label: "Todos os canais" },
  ...LEAD_ACTIVITY_CHANNELS.map((channel) => ({
    value: channel,
    label: LEAD_ACTIVITY_CHANNEL_LABELS[channel],
  })),
]

export function LeadActivityTimeline({
  activities,
  enteredActivityId,
}: {
  activities: LeadDetailActivity[]
  enteredActivityId: string | null
}) {
  const reduced = !!useReducedMotion()
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all")

  const visible =
    channelFilter === "all"
      ? activities
      : activities.filter((activity) => activity.channel === channelFilter)

  return (
    <section className="rounded-xl bg-card p-4 shadow-xs">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-heading text-sm font-semibold text-foreground">
          Histórico de atividades
        </h3>
        <div className="w-48 shrink-0">
          <Select
            items={FILTER_ITEMS}
            value={channelFilter}
            onValueChange={(value) => {
              const next = String(value)
              if (next === "all" || isLeadActivityChannel(next))
                setChannelFilter(next)
            }}
          >
            <SelectTrigger id="lead-activity-channel-filter" className="w-full">
              <RiFilter3Line size={14} aria-hidden />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {FILTER_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {activities.length === 0 ? (
        <p className="text-xs/relaxed text-muted-foreground">
          Nenhuma tentativa ainda.
        </p>
      ) : visible.length === 0 ? (
        <p className="text-xs/relaxed text-muted-foreground">
          Nenhuma atividade neste canal.
        </p>
      ) : (
        <ol className="flex flex-col">
          {visible.map((activity, index) => {
            const type = isLeadActivityType(activity.type)
              ? activity.type
              : null
            const channel = isLeadActivityChannel(activity.channel)
              ? activity.channel
              : null
            const ChannelIcon = channel
              ? LEAD_ACTIVITY_CHANNEL_ICONS[channel]
              : null
            const channelLabel = activityChannelLabel(
              activity.channel,
              activity.channel_detail,
            )
            const entering = activity.id === enteredActivityId
            return (
              <m.li
                key={activity.id}
                initial={entering && !reduced ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="flex gap-3"
              >
                <div className="flex w-7 shrink-0 flex-col items-center">
                  {ChannelIcon ? (
                    <LeadIconWell
                      icon={ChannelIcon}
                      className={
                        channel === "whatsapp" ? "text-success" : undefined
                      }
                    />
                  ) : (
                    <span aria-hidden className="size-7 rounded-md bg-accent" />
                  )}
                  {index < visible.length - 1 ? (
                    <span aria-hidden className="w-0.5 flex-1 bg-border/70" />
                  ) : null}
                </div>
                <div
                  className={cn(
                    "min-w-0 flex-1",
                    index < visible.length - 1 && "pb-4",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-xs/relaxed font-semibold text-foreground">
                      {type ? LEAD_ACTIVITY_TYPE_LABELS[type] : activity.type}
                    </p>
                    {channelLabel ? (
                      <Badge variant="muted">
                        <span
                          aria-hidden
                          className={cn(
                            "size-1.5 rounded-full",
                            type ? TYPE_DOT[type] : "bg-border",
                          )}
                        />
                        {channelLabel}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs/relaxed text-muted-foreground">
                    {formatDateTimeShort(activity.created_at)}
                    {" · "}
                    {activity.created_by_name ?? "—"}
                    {activity.follow_up_at
                      ? ` · ${
                          activity.type === "interested" ||
                          activity.type === "meeting_rescheduled"
                            ? "reunião"
                            : activity.type === "closing_standby"
                              ? "contato"
                              : "retorno"
                        } ${formatDateTimeShort(activity.follow_up_at)}`
                      : ""}
                  </p>
                  {activity.denied_reason ? (
                    <p className="mt-1 text-xs/relaxed text-muted-foreground">
                      Motivo: {activity.denied_reason}
                    </p>
                  ) : null}
                  {activity.note ? (
                    <p className="mt-1 text-xs/relaxed text-muted-foreground">
                      {activity.note}
                    </p>
                  ) : null}
                </div>
              </m.li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
