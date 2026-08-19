"use client"

import { useEffect, useState, useTransition, type ReactNode } from "react"
import { Controller, useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AnimatePresence, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { z } from "zod"
import { RiEditBoxLine, RiLoader4Line, RiSendPlaneLine } from "react-icons/ri"
import { logLeadActivity, listClosers, type CloserOption } from "@/app/actions/leads"
import { LeadActivityChannelPicker } from "@/components/custom/LeadActivityChannelPicker"
import { Button } from "@/components/ui/Button"
import { DateTimePicker } from "@/components/ui/DateTimePicker"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { cn } from "@/lib/cn"
import {
  datetimeLocalToCivilDate,
  datetimeLocalToCivilTime,
  joinDatetimeLocal,
} from "@/lib/date-time"
import {
  isLeadActivityChannel,
  type LeadActivityChannel,
} from "@/lib/leads/channel"
import {
  LEAD_ACTIVITY_TYPE_LABELS,
  LEAD_ACTIVITY_TYPES,
  type LeadActivityType,
} from "@/lib/leads/status"
import type { LeadActivityFormProps } from "./LeadActivityForm.types"

const activityFormSchema = z.object({
  type: z.enum(LEAD_ACTIVITY_TYPES),
  channel: z.string(),
  channel_detail: z.string(),
  note: z.string(),
  denied_reason: z.string(),
  closer_id: z.string(),
  follow_up_date: z.string(),
  follow_up_time: z.string(),
})

type ActivityFormValues = z.infer<typeof activityFormSchema>

const EASE = [0.23, 1, 0.32, 1] as const

function FieldReveal({
  show,
  id,
  children,
}: {
  show: boolean
  id: string
  children: ReactNode
}) {
  const reduced = !!useReducedMotion()
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <m.div
          key={id}
          initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0, y: 4 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, height: "auto", y: 0 }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: 0.12 } }
              : {
                  opacity: 0,
                  height: 0,
                  y: 4,
                  transition: { duration: 0.14, ease: EASE },
                }
          }
          transition={{ duration: reduced ? 0.12 : 0.18, ease: EASE }}
          style={reduced ? undefined : { overflow: "hidden" }}
        >
          {children}
        </m.div>
      ) : null}
    </AnimatePresence>
  )
}

const TYPE_CHIP: Record<LeadActivityType, { selected: string; dot: string }> = {
  no_contact: {
    selected: "border-accent bg-accent/10 text-accent",
    dot: "bg-accent",
  },
  call_later: {
    selected: "border-warning bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  denied: {
    selected: "border-danger bg-danger/10 text-danger",
    dot: "bg-danger",
  },
  interested: {
    selected: "border-success bg-success/10 text-success",
    dot: "bg-success",
  },
}

export function LeadActivityForm({
  leadId,
  onSuccess,
  onPendingChange,
}: LeadActivityFormProps) {
  const reduced = !!useReducedMotion()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{
    tone: "error"
    text: string
  } | null>(null)

  const [closers, setClosers] = useState<CloserOption[]>([])
  const [closersLoading, setClosersLoading] = useState(false)

  useEffect(() => {
    onPendingChange?.(isPending)
    return () => onPendingChange?.(false)
  }, [isPending, onPendingChange])

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema) as Resolver<ActivityFormValues>,
    defaultValues: {
      type: "no_contact",
      channel: "",
      channel_detail: "",
      note: "",
      denied_reason: "",
      closer_id: "",
      follow_up_date: "",
      follow_up_time: "",
    },
  })

  const type = form.watch("type") as LeadActivityType
  const note = form.watch("note")
  const channel = form.watch("channel")
  const selectedChannel: LeadActivityChannel | "" = isLeadActivityChannel(
    channel,
  )
    ? channel
    : ""
  const showFollowUp =
    type === "call_later" || type === "denied" || type === "interested"
  const showDeniedReason = type === "denied"
  const showCloser = type === "interested"
  const showChannelDetail = selectedChannel === "other"

  useEffect(() => {
    if (!showCloser) return
    let cancelled = false
    setClosersLoading(true)
    void listClosers().then((rows) => {
      if (cancelled) return
      setClosers(rows)
      setClosersLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [showCloser])

  function onSubmit(values: ActivityFormValues) {
    setMessage(null)
    const formData = new FormData()
    formData.set("lead_id", leadId)
    formData.set("type", values.type)
    formData.set("channel", values.channel)
    formData.set(
      "channel_detail",
      showChannelDetail ? values.channel_detail : "",
    )
    formData.set("note", values.note)
    formData.set("denied_reason", showDeniedReason ? values.denied_reason : "")
    formData.set("closer_id", showCloser ? values.closer_id : "")
    formData.set("follow_up_date", showFollowUp ? values.follow_up_date : "")
    formData.set("follow_up_time", showFollowUp ? values.follow_up_time : "")

    startTransition(async () => {
      const result = await logLeadActivity(formData)
      if (result.status === "error") {
        const fields = result.fieldErrors
        if (fields?.denied_reason?.[0]) {
          form.setError("denied_reason", { message: fields.denied_reason[0] })
        }
        if (fields?.closer_id?.[0]) {
          form.setError("closer_id", { message: fields.closer_id[0] })
        }
        if (fields?.follow_up_date?.[0]) {
          form.setError("follow_up_date", { message: fields.follow_up_date[0] })
        }
        if (fields?.follow_up_time?.[0]) {
          form.setError("follow_up_time", { message: fields.follow_up_time[0] })
        }
        if (fields?.type?.[0]) {
          form.setError("type", { message: fields.type[0] })
        }
        if (fields?.channel?.[0]) {
          form.setError("channel", { message: fields.channel[0] })
        }
        if (fields?.channel_detail?.[0]) {
          form.setError("channel_detail", {
            message: fields.channel_detail[0],
          })
        }
        setMessage({ tone: "error", text: result.message })
        return
      }

      form.reset({
        type: "no_contact",
        channel: "",
        channel_detail: "",
        note: "",
        denied_reason: "",
        closer_id: "",
        follow_up_date: "",
        follow_up_time: "",
      })
      onSuccess?.(result)
    })
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="rounded-xl bg-surface p-4 shadow-card"
    >
      <h3 className="mb-3 flex items-center gap-2 font-sans text-body-sm font-semibold text-fg">
        <RiEditBoxLine size={16} aria-hidden className="text-accent" />
        Registrar atividade
      </h3>

      <p className="mb-1.5 font-sans text-caption text-fg-secondary">
        Status da atividade
      </p>
      <div
        role="radiogroup"
        aria-label="Tipo da tentativa"
        className="mb-3 flex flex-wrap gap-1.5"
      >
        {LEAD_ACTIVITY_TYPES.map((item) => {
          const selected = type === item
          return (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={isPending}
              onClick={() => form.setValue("type", item, { shouldDirty: true })}
              className={cn(
                "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2",
                "font-sans text-caption transition-[colors,transform] duration-150 ease-out",
                "active:scale-[0.97]",
                selected
                  ? TYPE_CHIP[item].selected
                  : "border-transparent text-fg-muted hover:text-fg",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              <span
                aria-hidden
                className={cn("size-1.5 rounded-full", TYPE_CHIP[item].dot)}
              />
              {LEAD_ACTIVITY_TYPE_LABELS[item]}
            </button>
          )
        })}
      </div>

      <p className="mb-1.5 font-sans text-caption text-fg-secondary">
        Canal de contato
      </p>
      <div className="mb-3">
        <LeadActivityChannelPicker
          id="lead-activity-channel-detail"
          value={selectedChannel}
          detail={form.watch("channel_detail")}
          onValueChange={(next) => {
            form.setValue("channel", next, { shouldDirty: true })
            if (next !== "other") {
              form.setValue("channel_detail", "", { shouldDirty: true })
            }
            form.clearErrors(["channel", "channel_detail"])
          }}
          onDetailChange={(next) => {
            form.setValue("channel_detail", next, { shouldDirty: true })
            form.clearErrors("channel_detail")
          }}
          error={form.formState.errors.channel?.message}
          detailError={form.formState.errors.channel_detail?.message}
          disabled={isPending}
        />
      </div>

      <FieldReveal show={showDeniedReason} id="denied-reason">
        <Controller
          name="denied_reason"
          control={form.control}
          render={({ field, fieldState }) => (
            <Input
              id="lead-denied-reason"
              label="Motivo da negativa"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              disabled={isPending}
              className="mb-3"
            />
          )}
        />
      </FieldReveal>

      <FieldReveal show={showCloser} id="closer">
        <div className="mb-3">
          <Controller
            name="closer_id"
            control={form.control}
            render={({ field, fieldState }) => (
              <Select
                id="lead-activity-closer"
                label="Closer"
                placeholder="Selecione o closer"
                items={closers.map((closer) => ({
                  value: closer.id,
                  label: closer.name,
                }))}
                value={field.value}
                onValueChange={(next) => {
                  field.onChange(typeof next === "string" ? next : "")
                }}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                disabled={isPending}
                loading={closersLoading}
              />
            )}
          />
        </div>
      </FieldReveal>

      <Controller
        name="note"
        control={form.control}
        render={({ field, fieldState }) => (
          <div className="mb-3">
            <label
              htmlFor="lead-activity-note"
              className="mb-1.5 block font-sans text-caption text-fg-secondary"
            >
              O que aconteceu?
            </label>
            <textarea
              id="lead-activity-note"
              rows={3}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={isPending}
              maxLength={2000}
              placeholder="Descreva o que aconteceu neste contato..."
              aria-invalid={fieldState.error ? true : undefined}
              className={cn(
                "w-full resize-none rounded-md border border-input-border bg-input px-3 py-2",
                "font-sans text-body-sm text-fg outline-none",
                "placeholder:text-fg-muted",
                "transition-[border-color,opacity] duration-150 ease-out",
                "focus-visible:border-accent",
                "disabled:opacity-50",
                fieldState.error && "border-danger focus-visible:border-danger",
              )}
            />
            <p className="mt-1 text-right font-sans text-caption tabular-nums text-fg-muted">
              {note.length}/2000
            </p>
            {fieldState.error?.message ? (
              <p role="alert" className="mt-1 font-sans text-caption text-danger">
                {fieldState.error.message}
              </p>
            ) : null}
          </div>
        )}
      />

      <div className="flex items-end gap-3">
        <AnimatePresence initial={false}>
          {showFollowUp ? (
            <m.div
              key="follow-up"
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={
                reduced
                  ? { opacity: 0, transition: { duration: 0.12 } }
                  : {
                      opacity: 0,
                      x: -6,
                      transition: { duration: 0.14, ease: EASE },
                    }
              }
              transition={{ duration: reduced ? 0.12 : 0.18, ease: EASE }}
              className="w-[15.5rem] max-w-full"
            >
              <Controller
                name="follow_up_date"
                control={form.control}
                render={({ field: dateField, fieldState: dateState }) => (
                  <Controller
                    name="follow_up_time"
                    control={form.control}
                    render={({ field: timeField, fieldState: timeState }) => (
                      <DateTimePicker
                        id="lead-follow-up-at"
                        label={
                          type === "call_later"
                            ? "Data e horário para ligar"
                            : type === "interested"
                              ? "Data e horário da reunião"
                              : "Retorno (opcional)"
                        }
                        placeholder="Data e hora"
                        value={joinDatetimeLocal(dateField.value, timeField.value)}
                        onValueChange={(next) => {
                          dateField.onChange(datetimeLocalToCivilDate(next))
                          timeField.onChange(datetimeLocalToCivilTime(next))
                        }}
                        onBlur={() => {
                          dateField.onBlur()
                          timeField.onBlur()
                        }}
                        error={
                          dateState.error?.message ?? timeState.error?.message
                        }
                        disabled={isPending}
                        clearable={type === "denied"}
                      />
                    )}
                  />
                )}
              />
            </m.div>
          ) : null}
        </AnimatePresence>
        <Button
          type="submit"
          disabled={isPending}
          className="ml-auto"
          leadingIcon={
            isPending ? (
              <RiLoader4Line size={16} aria-hidden className="animate-spin" />
            ) : (
              <RiSendPlaneLine size={16} aria-hidden />
            )
          }
        >
          {isPending ? "Registrando..." : "Registrar atividade"}
        </Button>
      </div>

      {message ? (
        <p role="alert" className="mt-3 font-sans text-body-sm text-danger">
          {message.text}
        </p>
      ) : null}
    </form>
  )
}
