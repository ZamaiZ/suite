"use client"

import { useEffect, useState, useTransition } from "react"
import { RiCalendarCheckLine, RiCheckboxCircleLine, RiLoader4Line, RiStickyNoteLine, RiUserUnfollowLine } from "react-icons/ri"
import { loadClientKickoff, logClientKickoffEvent, type ClientKickoffDetail } from "@/app/actions/clients"
import { LeadActivityChannelPicker } from "@/components/custom/LeadActivityChannelPicker"
import { Button } from "@/components/ui/button"
import { DateTimePicker } from "@/components/ui/DateTimePicker"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { CLIENT_KICKOFF_ACTIVITY_LABELS, CLIENT_KICKOFF_STAGE_LABELS, type ClientKickoffActivityType } from "@/lib/clients/kickoff"
import { cn } from "@/lib/cn"
import { formatDateTimeShort, toDatetimeLocalInput } from "@/lib/date-time"

type Action = ClientKickoffActivityType | null

const STAGE_TONE = {
  none: "bg-fg-muted/10 text-fg-muted",
  scheduled: "bg-accent/10 text-accent",
  no_show: "bg-danger/10 text-danger",
  completed: "bg-success/10 text-success",
}

export function ClientKickoffPanel({ clientId }: { clientId: string }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "ready"; detail: ClientKickoffDetail }>({ status: "loading" })
  const [action, setAction] = useState<Action>(null)
  const [meetingAt, setMeetingAt] = useState("")
  const [channel, setChannel] = useState("")
  const [channelDetail, setChannelDetail] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    void loadClientKickoff(clientId).then((result) => setState(result.status === "success" ? { status: "ready", detail: result.detail } : { status: "error", message: result.message }))
  }, [clientId])

  const detail = state.status === "ready" ? state.detail : null

  function selectAction(next: ClientKickoffActivityType) {
    setAction(next)
    setError(null)
    setNote("")
    setChannel("")
    setChannelDetail("")
    setMeetingAt(next === "kickoff_scheduled" || next === "kickoff_rescheduled" ? detail?.meetingAt ? toDatetimeLocalInput(detail.meetingAt) : "" : "")
  }

  function submit() {
    if (!action || !detail) return
    const formData = new FormData()
    formData.set("client_id", clientId)
    formData.set("type", action)
    formData.set("meeting_at", meetingAt)
    formData.set("channel", channel)
    formData.set("channel_detail", channelDetail)
    formData.set("note", note)
    startTransition(async () => {
      const result = await logClientKickoffEvent(formData)
      if (result.status === "error") {
        setError(result.message)
        return
      }
      setState({ status: "ready", detail: { ...detail, stage: result.stage, meetingAt: result.meetingAt, activities: [result.activity, ...detail.activities] } })
      setAction(null)
      setMeetingAt("")
      setChannel("")
      setChannelDetail("")
      setNote("")
    })
  }

  if (state.status === "loading") return <div className="flex items-center gap-2 py-12 font-sans text-body-sm text-fg-muted"><RiLoader4Line className="animate-spin" size={18} aria-hidden />Carregando contato…</div>
  if (state.status === "error") return <p role="alert" className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 font-sans text-body-sm text-danger">{state.message}</p>
  if (!detail) return null

  const scheduling = action === "kickoff_scheduled" || action === "kickoff_rescheduled"
  const needsChannel = scheduling || action === "kickoff_note"
  const meetingLabel = detail.meetingAt ? formatDateTimeShort(detail.meetingAt) : "Nenhuma reunião agendada"

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <section className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-sans text-caption font-medium tracking-wide text-fg-muted uppercase">{detail.meetingAt ? "Próximo encontro" : "Kickoff"}</p>
            <h3 className="mt-1 font-display text-title font-semibold text-fg">{meetingLabel}</h3>
            <p className="mt-1 font-sans text-caption text-fg-muted">{detail.meetingAt ? "Reunião mais recente registrada para o cliente." : "Agende o primeiro encontro para iniciar o onboarding."}</p>
          </div>
          <span className={cn("inline-flex shrink-0 rounded-md px-2 py-0.5 font-sans text-caption font-medium", STAGE_TONE[detail.stage])}>{CLIENT_KICKOFF_STAGE_LABELS[detail.stage]}</span>
        </div>

        {detail.canLog && detail.stage !== "completed" ? <div className="mt-4 flex flex-wrap gap-2 border-t border-border-subtle pt-4">
          {detail.stage === "none" ? <Button type="button" variant="secondary" onClick={() => selectAction("kickoff_scheduled")}><RiCalendarCheckLine size={16} aria-hidden data-icon="inline-start" />Agendar kickoff</Button> : null}
          {detail.stage === "scheduled" || detail.stage === "no_show" ? <><Button type="button" variant="secondary" onClick={() => selectAction("kickoff_rescheduled")}><RiCalendarCheckLine size={16} aria-hidden data-icon="inline-start" />Reagendar</Button><Button type="button" variant="secondary" onClick={() => selectAction("kickoff_completed")}><RiCheckboxCircleLine size={16} aria-hidden data-icon="inline-start" />Kickoff feito</Button></> : null}
          {detail.stage === "scheduled" ? <Button type="button" variant="ghost" onClick={() => selectAction("kickoff_no_show")}><RiUserUnfollowLine size={16} aria-hidden data-icon="inline-start" />No-show</Button> : null}
          <Button type="button" variant="ghost" onClick={() => selectAction("kickoff_note")}><RiStickyNoteLine size={16} aria-hidden data-icon="inline-start" />Nota</Button>
        </div> : null}

        {action ? <div className="mt-4 flex flex-col gap-3 border-t border-border-subtle pt-4">
          <div><p className="font-sans text-body-sm font-semibold text-fg">{CLIENT_KICKOFF_ACTIVITY_LABELS[action]}</p><p className="mt-1 font-sans text-caption text-fg-muted">Registre o contexto para manter o onboarding rastreável.</p></div>
          {scheduling ? <DateTimePicker id="client-kickoff-meeting-at" label="Data e horário" value={meetingAt} onValueChange={setMeetingAt} /> : null}
          {needsChannel ? <LeadActivityChannelPicker id="client-kickoff-channel-detail" value={channel as never} detail={channelDetail} onValueChange={setChannel} onDetailChange={setChannelDetail} disabled={pending} /> : null}
          {action === "kickoff_note" || action === "kickoff_no_show" || action === "kickoff_completed" ? <Field><FieldLabel htmlFor="client-kickoff-note">Observação</FieldLabel><Textarea id="client-kickoff-note" value={note} onChange={(event) => setNote(event.target.value)} /></Field> : null}
          {error ? <p role="alert" className="font-sans text-caption text-danger">{error}</p> : null}
          <div className="flex flex-wrap gap-2"><Button type="button" onClick={submit} disabled={pending}>{pending ? "Salvando…" : "Registrar"}</Button><Button type="button" variant="ghost" disabled={pending} onClick={() => setAction(null)}>Cancelar</Button></div>
        </div> : null}
      </section>

      <section className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
        <div className="flex items-center justify-between gap-3"><div><p className="font-sans text-caption font-medium tracking-wide text-fg-muted uppercase">Contato</p><h3 className="mt-1 font-display text-title font-semibold text-fg">Histórico de contato</h3></div><span className="font-sans text-caption tabular-nums text-fg-muted">{detail.activities.length} registros</span></div>
        {detail.activities.length === 0 ? <p className="mt-4 font-sans text-body-sm text-fg-muted">Nenhum registro ainda.</p> : <ol className="mt-5 flex flex-col gap-4">{detail.activities.map((item) => <li key={item.id} className="border-l-2 border-border-subtle pl-3"><p className="font-sans text-body-sm font-semibold text-fg">{CLIENT_KICKOFF_ACTIVITY_LABELS[item.type]}</p><p className="mt-1 font-sans text-caption text-fg-muted">{formatDateTimeShort(item.createdAt)} · {item.createdByName ?? "—"}{item.meetingAt ? ` · reunião ${formatDateTimeShort(item.meetingAt)}` : ""}</p>{item.note ? <p className="mt-2 font-sans text-body-sm text-fg-secondary">{item.note}</p> : null}</li>)}</ol>}
      </section>
    </div>
  )
}
