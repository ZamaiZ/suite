"use client"

import { useEffect, useState } from "react"
import type { IconType } from "react-icons"
import {
  RiCalendarEventLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiInformationLine,
} from "react-icons/ri"
import { listClosers, type CloserOption } from "@/app/actions/leads"
import { LeadActivityChannelPicker } from "@/components/custom/LeadActivityChannelPicker"
import { BriefingTextField as Input } from "@/components/custom/BriefingFormControls/BriefingFormControls"
import { Button } from "@/components/ui/button"
import { DateTimePicker } from "@/components/ui/DateTimePicker"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/cn"
import {
  datetimeLocalToCivilDate,
  datetimeLocalToCivilTime,
} from "@/lib/date-time"
import type { LeadActivityChannel } from "@/lib/leads/channel"
import { deriveLeadStatus } from "@/lib/leads/status"
import {
  logLeadActivitySchema,
  readLeadActivityFormFields,
} from "@/lib/validations/lead-activity"
import type { LeadBoardItem } from "./LeadBoard.types"
import { LeadDropHeader } from "./LeadDropHeader"

export type LeadDropKind = "follow_up" | "denied" | "interested"

export type LeadDropRequest = {
  kind: LeadDropKind
  leadId: string
  companyName: string
  websiteDomain: string
}

export type LeadDropCommit = {
  formData: FormData
  patch: Pick<
    LeadBoardItem,
    | "status"
    | "next_follow_up_at"
    | "from_denial"
    | "from_closing_loss"
    | "assigned_closer_id"
    | "closer_name"
    | "closing_meeting_at"
    | "closing_stage"
  >
}

const DROP_KIND: Record<
  LeadDropKind,
  {
    icon: IconType
    wellClassName: string
    title: string
    banner: string
    bannerClassName: string
    submitLabel: string
    submitVariant: "default" | "destructive"
  }
> = {
  follow_up: {
    icon: RiCalendarEventLine,
    wellClassName: "bg-warning/10 text-warning",
    title: "Ligar depois",
    banner: "O lead vai para Retorno com a data e o horário definidos.",
    bannerClassName: "bg-warning/10 text-warning",
    submitLabel: "Agendar retorno",
    submitVariant: "default",
  },
  denied: {
    icon: RiCloseCircleLine,
    wellClassName: "bg-danger/10 text-danger",
    title: "Negar lead",
    banner:
      "Sem retorno, vai para Negado. Com retorno, volta para Retorno marcado como negativa.",
    bannerClassName: "bg-danger/10 text-danger",
    submitLabel: "Registrar negativa",
    submitVariant: "destructive",
  },
  interested: {
    icon: RiCheckboxCircleLine,
    wellClassName: "bg-success/10 text-success",
    title: "Tem interesse",
    banner: "O lead vira oportunidade com closer e reunião.",
    bannerClassName: "bg-success/10 text-success",
    submitLabel: "Registrar interesse",
    submitVariant: "default",
  },
}

export function LeadDropDialogs({
  request,
  onClose,
  onCommit,
}: {
  request: LeadDropRequest | null
  onClose: () => void
  onCommit: (commit: LeadDropCommit) => void
}) {
  const [followUpAt, setFollowUpAt] = useState("")
  const [deniedReason, setDeniedReason] = useState("")
  const [closerId, setCloserId] = useState("")
  const [closers, setClosers] = useState<CloserOption[]>([])
  const [closersLoading, setClosersLoading] = useState(false)
  const [channel, setChannel] = useState<LeadActivityChannel | "">("")
  const [channelDetail, setChannelDetail] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [followUpError, setFollowUpError] = useState<string | null>(null)
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [noteError, setNoteError] = useState<string | null>(null)
  const [closerError, setCloserError] = useState<string | null>(null)
  const [channelError, setChannelError] = useState<string | null>(null)
  const [channelDetailError, setChannelDetailError] = useState<string | null>(
    null,
  )

  const open = request !== null
  const kind = request?.kind ?? "follow_up"
  const config = DROP_KIND[kind]
  const SubmitIcon = config.icon

  useEffect(() => {
    setFollowUpAt("")
    setDeniedReason("")
    setCloserId("")
    setChannel("")
    setChannelDetail("")
    setNote("")
    setError(null)
    setFollowUpError(null)
    setReasonError(null)
    setNoteError(null)
    setCloserError(null)
    setChannelError(null)
    setChannelDetailError(null)
  }, [request?.leadId, request?.kind])

  useEffect(() => {
    if (request?.kind !== "interested") return
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
  }, [request?.kind])

  function reset() {
    setFollowUpAt("")
    setDeniedReason("")
    setCloserId("")
    setChannel("")
    setChannelDetail("")
    setNote("")
    setError(null)
    setFollowUpError(null)
    setReasonError(null)
    setNoteError(null)
    setCloserError(null)
    setChannelError(null)
    setChannelDetailError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleSubmit() {
    if (!request) return
    setError(null)
    setFollowUpError(null)
    setReasonError(null)
    setNoteError(null)
    setCloserError(null)
    setChannelError(null)
    setChannelDetailError(null)

    const formData = new FormData()
    formData.set("lead_id", request.leadId)
    formData.set("note", note)
    formData.set("channel", channel)
    formData.set("channel_detail", channel === "other" ? channelDetail : "")
    formData.set("closer_id", kind === "interested" ? closerId : "")

    if (kind === "follow_up") {
      formData.set("type", "call_later")
      formData.set("denied_reason", "")
      formData.set("follow_up_date", datetimeLocalToCivilDate(followUpAt))
      formData.set("follow_up_time", datetimeLocalToCivilTime(followUpAt))
    } else if (kind === "denied") {
      formData.set("type", "denied")
      formData.set("denied_reason", deniedReason)
      formData.set("follow_up_date", datetimeLocalToCivilDate(followUpAt))
      formData.set("follow_up_time", datetimeLocalToCivilTime(followUpAt))
    } else {
      formData.set("type", "interested")
      formData.set("denied_reason", "")
      formData.set("follow_up_date", datetimeLocalToCivilDate(followUpAt))
      formData.set("follow_up_time", datetimeLocalToCivilTime(followUpAt))
    }

    const parsed = logLeadActivitySchema.safeParse(
      readLeadActivityFormFields(formData),
    )
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      if (fieldErrors.follow_up_date?.[0]) {
        setFollowUpError(fieldErrors.follow_up_date[0])
      }
      if (fieldErrors.follow_up_time?.[0] && !fieldErrors.follow_up_date?.[0]) {
        setFollowUpError(fieldErrors.follow_up_time[0])
      }
      if (fieldErrors.denied_reason?.[0]) {
        setReasonError(fieldErrors.denied_reason[0])
      }
      if (fieldErrors.note?.[0]) {
        setNoteError(fieldErrors.note[0])
      }
      if (fieldErrors.closer_id?.[0]) {
        setCloserError(fieldErrors.closer_id[0])
      }
      if (fieldErrors.channel?.[0]) {
        setChannelError(fieldErrors.channel[0])
      }
      if (fieldErrors.channel_detail?.[0]) {
        setChannelDetailError(fieldErrors.channel_detail[0])
      }
      setError("Revise os dados da tentativa.")
      return
    }

    const next = deriveLeadStatus(parsed.data.type, parsed.data.follow_up_at)
    const closerName =
      parsed.data.closer_id
        ? (closers.find((closer) => closer.id === parsed.data.closer_id)?.name ??
          null)
        : null
    reset()
    onCommit({
      formData,
      patch: {
        status: next.status,
        next_follow_up_at: next.nextFollowUpAt,
        from_denial:
          parsed.data.type === "denied" && next.status === "follow_up",
        from_closing_loss: false,
        assigned_closer_id: parsed.data.closer_id,
        closer_name: closerName,
        closing_meeting_at:
          next.status === "interested" ? parsed.data.follow_up_at : null,
        closing_stage: next.status === "interested" ? "open" : null,
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose() }}>
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto bg-background p-0">
        <DialogTitle className="sr-only">{config.title}</DialogTitle>
        <DialogDescription className="sr-only">{request?.companyName}</DialogDescription>
        <LeadDropHeader
          icon={config.icon}
          wellClassName={config.wellClassName}
          title={config.title}
          companyName={request?.companyName ?? ""}
          websiteDomain={request?.websiteDomain ?? ""}
          onClose={handleClose}
        />
        <div className="p-4">
        
      <div className="flex flex-col gap-4">
        <section className="rounded-xl bg-surface p-4 shadow-card">
          <div
            className={cn(
              "mb-4 flex items-start gap-2.5 rounded-lg px-3 py-2.5",
              config.bannerClassName,
            )}
          >
            <RiInformationLine
              size={16}
              aria-hidden
              className="mt-0.5 shrink-0"
            />
            <p className="font-sans text-body-sm">{config.banner}</p>
          </div>
          <p className="mb-1.5 font-sans text-caption text-fg-secondary">
            Canal de contato
          </p>
          <div className="mb-4">
            <LeadActivityChannelPicker
              id="lead-drop-channel-detail"
              value={channel}
              detail={channelDetail}
              onValueChange={(next) => {
                setChannel(next)
                setChannelError(null)
                if (next !== "other") setChannelDetailError(null)
              }}
              onDetailChange={(next) => {
                setChannelDetail(next)
                setChannelDetailError(null)
              }}
              error={channelError ?? undefined}
              detailError={channelDetailError ?? undefined}
            />
          </div>
          {kind === "denied" ? (
            <Input
              id="lead-drop-denied-reason"
              label="Motivo da negativa"
              value={deniedReason}
              onChange={(event) => setDeniedReason(event.target.value)}
              error={reasonError ?? undefined}
              className="mb-4"
            />
          ) : null}
          {kind === "interested" ? (
            <div className="mb-4">
              <Field data-invalid={Boolean(closerError)}>
                <FieldLabel htmlFor="lead-drop-closer">Closer</FieldLabel>
                <Select value={closerId} onValueChange={(next) => {
                  setCloserId(String(next))
                  setCloserError(null)
                }} disabled={closersLoading}><SelectTrigger id="lead-drop-closer" className="h-10 w-full"><SelectValue placeholder={closersLoading ? "Carregando…" : "Selecione o closer"} /></SelectTrigger><SelectContent align="start">{closers.map((closer) => <SelectItem key={closer.id} value={closer.id}>{closer.name}</SelectItem>)}</SelectContent></Select>
                <FieldError>{closerError}</FieldError>
              </Field>
            </div>
          ) : null}
          <div className="mb-4">
            <label
              htmlFor="lead-drop-note"
              className="mb-1.5 block font-sans text-caption text-fg-secondary"
            >
              O que aconteceu?
            </label>
            <textarea
              id="lead-drop-note"
              rows={3}
              value={note}
              onChange={(event) => {
                setNote(event.target.value)
                setNoteError(null)
              }}
              maxLength={2000}
              placeholder="Descreva o que aconteceu neste contato..."
              aria-invalid={noteError ? true : undefined}
              className={cn(
                "w-full resize-none rounded-md border border-input-border bg-input px-3 py-2",
                "font-sans text-body-sm text-fg outline-none",
                "placeholder:text-fg-muted",
                "transition-[border-color,opacity] duration-150 ease-out",
                "focus-visible:border-accent",
                noteError && "border-danger focus-visible:border-danger",
              )}
            />
            <p className="mt-1 text-right font-sans text-caption tabular-nums text-fg-muted">
              {note.length}/2000
            </p>
            {noteError ? (
              <p role="alert" className="mt-1 font-sans text-caption text-danger">
                {noteError}
              </p>
            ) : null}
          </div>
          <DateTimePicker
            id="lead-drop-follow-up"
            label={
              kind === "follow_up"
                ? "Data e horário para ligar"
                : kind === "interested"
                  ? "Data e horário da reunião"
                  : "Retorno (opcional)"
            }
            value={followUpAt}
            onValueChange={setFollowUpAt}
            error={followUpError ?? undefined}
            clearable={kind === "denied"}
          />
        </section>
        {error ? (
          <p role="alert" className="font-sans text-body-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
      <DialogFooter className="border-t border-border p-4"><Button type="button" variant="ghost" onClick={handleClose}>Cancelar</Button><Button type="button" variant={config.submitVariant} onClick={handleSubmit}><SubmitIcon size={16} aria-hidden />{config.submitLabel}</Button></DialogFooter>
      </div>
      </DialogContent>
    </Dialog>
  )
}
