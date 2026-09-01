"use client"

import { useState } from "react"
import * as m from "motion/react-m"
import { useReducedMotion } from "motion/react"
import { RiFilter3Line } from "react-icons/ri"
import { LEAD_ACTIVITY_CHANNEL_ICONS } from "@/components/custom/LeadActivityChannelPicker"
import { Select } from "@/components/ui/Select"
import { cn } from "@/lib/cn"
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
  no_contact: "bg-accent",
  call_later: "bg-warning",
  denied: "bg-danger",
  interested: "bg-success",
  meeting_rescheduled: "bg-accent",
  meeting_no_show: "bg-warning",
  closing_standby: "bg-warning",
  closing_lost: "bg-danger",
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
    <section className="rounded-xl bg-surface p-4 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-sans text-body-sm font-semibold text-fg">
          Histórico de atividades
        </h3>
        <div className="w-48 shrink-0">
          <Select
            id="lead-activity-channel-filter"
            items={FILTER_ITEMS}
            value={channelFilter}
            onValueChange={(value) => {
              if (typeof value !== "string") return
              if (value === "all" || isLeadActivityChannel(value)) {
                setChannelFilter(value)
              }
            }}
            searchable={false}
            leadingIcon={<RiFilter3Line size={14} aria-hidden />}
          />
        </div>
      </div>

      {activities.length === 0 ? (
        <p className="font-sans text-caption text-fg-muted">
          Nenhuma tentativa ainda.
        </p>
      ) : visible.length === 0 ? (
        <p className="font-sans text-caption text-fg-muted">
          Nenhuma atividade neste canal.
        </p>
      ) : (
        <ol className="flex flex-col">
          {visible.map((activity, index) => {
            const type = isLeadActivityType(activity.type) ? activity.type : null
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
                    <span
                      aria-hidden
                      className="size-7 rounded-md bg-hover"
                    />
                  )}
                  {index < visible.length - 1 ? (
                    <span
                      aria-hidden
                      className="w-0.5 flex-1 bg-border-subtle"
                    />
                  ) : null}
                </div>
                <div
                  className={cn(
                    "min-w-0 flex-1",
                    index < visible.length - 1 && "pb-4",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-sans text-body-sm font-semibold text-fg">
                      {type ? LEAD_ACTIVITY_TYPE_LABELS[type] : activity.type}
                    </p>
                    {channelLabel ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-hover px-1.5 py-0.5 font-sans text-caption text-fg-muted">
                        <span
                          aria-hidden
                          className={cn(
                            "size-1.5 rounded-full",
                            type ? TYPE_DOT[type] : "bg-border",
                          )}
                        />
                        {channelLabel}
                      </span>
                    ) : null}
                  </div>
                  <p className="font-sans text-caption text-fg-muted">
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
                    <p className="mt-1 font-sans text-body-sm text-fg-secondary">
                      Motivo: {activity.denied_reason}
                    </p>
                  ) : null}
                  {activity.note ? (
                    <p className="mt-1 font-sans text-body-sm text-fg-secondary">
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
