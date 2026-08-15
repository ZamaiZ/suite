"use client"

import { useEffect, useState } from "react"
import { RiCheckLine } from "react-icons/ri"
import { LeadActivityChannelPicker } from "@/components/custom/LeadActivityChannelPicker"
import { Button } from "@/components/ui/Button"
import { DateTimePicker } from "@/components/ui/DateTimePicker"
import { Dialog } from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
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

export type LeadDropKind = "follow_up" | "denied"

export type LeadDropRequest = {
  kind: LeadDropKind
  leadId: string
  companyName: string
}

export type LeadDropCommit = {
  formData: FormData
  patch: Pick<LeadBoardItem, "status" | "next_follow_up_at" | "from_denial">
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
  const [channel, setChannel] = useState<LeadActivityChannel | "">("")
  const [channelDetail, setChannelDetail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [followUpError, setFollowUpError] = useState<string | null>(null)
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [channelError, setChannelError] = useState<string | null>(null)
  const [channelDetailError, setChannelDetailError] = useState<string | null>(
    null,
  )

  const open = request !== null
  const kind = request?.kind ?? "follow_up"

  useEffect(() => {
    setFollowUpAt("")
    setDeniedReason("")
    setChannel("")
    setChannelDetail("")
    setError(null)
    setFollowUpError(null)
    setReasonError(null)
    setChannelError(null)
    setChannelDetailError(null)
  }, [request?.leadId, request?.kind])

  function reset() {
    setFollowUpAt("")
    setDeniedReason("")
    setChannel("")
    setChannelDetail("")
    setError(null)
    setFollowUpError(null)
    setReasonError(null)
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
    setChannelError(null)
    setChannelDetailError(null)

    const formData = new FormData()
    formData.set("lead_id", request.leadId)
    formData.set("note", "")
    formData.set("channel", channel)
    formData.set("channel_detail", channel === "other" ? channelDetail : "")

    if (kind === "follow_up") {
      formData.set("type", "call_later")
      formData.set("denied_reason", "")
      formData.set("follow_up_date", datetimeLocalToCivilDate(followUpAt))
      formData.set("follow_up_time", datetimeLocalToCivilTime(followUpAt))
    } else {
      formData.set("type", "denied")
      formData.set("denied_reason", deniedReason)
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
    reset()
    onCommit({
      formData,
      patch: {
        status: next.status,
        next_follow_up_at: next.nextFollowUpAt,
        from_denial:
          parsed.data.type === "denied" && next.status === "follow_up",
      },
    })
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={kind === "follow_up" ? "Ligar depois" : "Negar lead"}
      description={request?.companyName}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            leadingIcon={<RiCheckLine size={16} aria-hidden />}
          >
            Confirmar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
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
        {kind === "denied" ? (
          <Input
            id="lead-drop-denied-reason"
            label="Motivo da negativa"
            value={deniedReason}
            onChange={(event) => setDeniedReason(event.target.value)}
            error={reasonError ?? undefined}
          />
        ) : null}
        <DateTimePicker
          id="lead-drop-follow-up"
          label={
            kind === "follow_up"
              ? "Data e horário para ligar"
              : "Retorno (opcional)"
          }
          value={followUpAt}
          onValueChange={setFollowUpAt}
          error={followUpError ?? undefined}
          clearable={kind === "denied"}
        />
        {error ? (
          <p role="alert" className={cn("font-sans text-body-sm text-danger")}>
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  )
}
