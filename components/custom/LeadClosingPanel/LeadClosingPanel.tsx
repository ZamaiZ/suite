"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { convertLeadToClient } from "@/app/actions/clients"
import {
  listClosers,
  logClosingEvent,
  updateClosingChecklist,
  type CloserOption,
} from "@/app/actions/leads"
import { LeadActivityChannelPicker } from "@/components/custom/LeadActivityChannelPicker"
import { BriefingTextField as Input } from "@/components/custom/BriefingFormControls/BriefingFormControls"
import { Button } from "@/components/ui/button"
import { DateTimePicker } from "@/components/ui/DateTimePicker"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCnpj, formatCpf, digitsOnly } from "@/lib/br-documents"
import { cn } from "@/lib/cn"
import {
  datetimeLocalToCivilDate,
  datetimeLocalToCivilTime,
  getCivilFollowUpKind,
  joinDatetimeLocal,
  toDatetimeLocalInput,
} from "@/lib/date-time"
import {
  isLeadActivityChannel,
  type LeadActivityChannel,
} from "@/lib/leads/channel"
import {
  CLOSING_STAGE_LABELS,
  isClosingStage,
  type ClosingStage,
} from "@/lib/leads/closing"
import {
  LEAD_ACTIVITY_TYPE_LABELS,
  type LeadClosingActivityType,
} from "@/lib/leads/status"
import type { LeadClosingPanelProps } from "./LeadClosingPanel.types"

const EVENT_CHIP: Record<
  LeadClosingActivityType,
  { selected: string; dot: string }
> = {
  meeting_rescheduled: {
    selected: "border-accent bg-accent/10 text-accent",
    dot: "bg-accent",
  },
  meeting_no_show: {
    selected: "border-warning bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  closing_standby: {
    selected: "border-warning bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  closing_lost: {
    selected: "border-danger bg-danger/10 text-danger",
    dot: "bg-danger",
  },
  closing_won: {
    selected: "border-success bg-success/10 text-success",
    dot: "bg-success",
  },
}

function actionsForStage(
  stage: ClosingStage,
  canReschedule: boolean,
  canOutcome: boolean,
): LeadClosingActivityType[] {
  const items: LeadClosingActivityType[] = []
  if (canReschedule) items.push("meeting_rescheduled")
  if (!canOutcome) return items
  if (stage === "open") {
    items.push("meeting_no_show", "closing_standby", "closing_lost", "closing_won")
  } else if (stage === "no_show") {
    items.push("closing_lost")
  } else if (stage === "standby") {
    items.push("closing_standby", "closing_lost", "closing_won")
  }
  return items
}

function formatTaxId(value: string): string {
  const digits = digitsOnly(value)
  if (digits.length <= 11) return formatCpf(digits)
  return formatCnpj(digits)
}

export function LeadClosingPanel({
  detail,
  readOnly,
  onEventSuccess,
  onChecklistSuccess,
  onConvertSuccess,
  onPendingChange,
}: LeadClosingPanelProps) {
  const stage = isClosingStage(detail.lead.closing_stage)
    ? detail.lead.closing_stage
    : null
  const converted = detail.lead.status === "converted"
  const wonPending = stage === "won_pending"
  const meetingAt = detail.lead.closing_meeting_at
  const meetingOverdue =
    stage === "open" && meetingAt
      ? getCivilFollowUpKind(meetingAt) === "overdue"
      : false

  if (converted || wonPending) {
    return (
      <ClosingChecklist
        detail={detail}
        readOnly={readOnly || converted || !detail.canEditClosingChecklist}
        converted={converted}
        onChecklistSuccess={onChecklistSuccess}
        onConvertSuccess={onConvertSuccess}
        onPendingChange={onPendingChange}
      />
    )
  }

  if (!stage) return null

  return (
    <ClosingEventForm
      detail={detail}
      stage={stage}
      meetingOverdue={meetingOverdue}
      readOnly={readOnly}
      onEventSuccess={onEventSuccess}
      onPendingChange={onPendingChange}
    />
  )
}

function ClosingEventForm({
  detail,
  stage,
  meetingOverdue,
  readOnly,
  onEventSuccess,
  onPendingChange,
}: {
  detail: LeadClosingPanelProps["detail"]
  stage: ClosingStage
  meetingOverdue: boolean
  readOnly: boolean
  onEventSuccess: LeadClosingPanelProps["onEventSuccess"]
  onPendingChange: (pending: boolean) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [action, setAction] = useState<LeadClosingActivityType | "">("")
  const [note, setNote] = useState("")
  const [deniedReason, setDeniedReason] = useState("")
  const [closerId, setCloserId] = useState(detail.lead.assigned_closer_id ?? "")
  const [followUpDate, setFollowUpDate] = useState("")
  const [followUpTime, setFollowUpTime] = useState("")
  const [channel, setChannel] = useState<LeadActivityChannel | "">("")
  const [channelDetail, setChannelDetail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<Partial<Record<string, string>>>(
    {},
  )
  const [closers, setClosers] = useState<CloserOption[]>([])
  const [closersLoading, setClosersLoading] = useState(false)

  const actions = useMemo(
    () =>
      actionsForStage(
        stage,
        detail.canRescheduleClosing,
        detail.canRecordClosingOutcome,
      ),
    [stage, detail.canRescheduleClosing, detail.canRecordClosingOutcome],
  )

  useEffect(() => {
    onPendingChange(isPending)
    return () => onPendingChange(false)
  }, [isPending, onPendingChange])

  useEffect(() => {
    setAction("")
    setNote("")
    setDeniedReason("")
    setFollowUpDate("")
    setFollowUpTime("")
    setChannel("")
    setChannelDetail("")
    setCloserId(detail.lead.assigned_closer_id ?? "")
  }, [stage, detail.lead.id, detail.lead.assigned_closer_id])

  const showCloser = action === "meeting_rescheduled"
  const showFollowUp =
    action === "meeting_rescheduled" ||
    action === "closing_standby" ||
    action === "closing_lost"
  const showChannel = action === "closing_standby"
  const showDenied = action === "closing_lost"

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

  function submit() {
    if (!action) {
      setError("Selecione uma ação.")
      return
    }
    setError(null)
    setFieldError({})
    const formData = new FormData()
    formData.set("lead_id", detail.lead.id)
    formData.set("type", action)
    formData.set("channel", showChannel ? channel : "")
    formData.set("channel_detail", showChannel ? channelDetail : "")
    formData.set("note", note)
    formData.set("denied_reason", showDenied ? deniedReason : "")
    formData.set("closer_id", showCloser ? closerId : "")
    formData.set("follow_up_date", showFollowUp ? followUpDate : "")
    formData.set("follow_up_time", showFollowUp ? followUpTime : "")

    startTransition(async () => {
      const result = await logClosingEvent(formData)
      if (result.status === "error") {
        const next: Partial<Record<string, string>> = {}
        if (result.fieldErrors?.denied_reason?.[0]) {
          next.denied_reason = result.fieldErrors.denied_reason[0]
        }
        if (result.fieldErrors?.closer_id?.[0]) {
          next.closer_id = result.fieldErrors.closer_id[0]
        }
        if (result.fieldErrors?.follow_up_date?.[0]) {
          next.follow_up_date = result.fieldErrors.follow_up_date[0]
        }
        if (result.fieldErrors?.channel?.[0]) {
          next.channel = result.fieldErrors.channel[0]
        }
        if (result.fieldErrors?.channel_detail?.[0]) {
          next.channel_detail = result.fieldErrors.channel_detail[0]
        }
        setFieldError(next)
        setError(result.message)
        return
      }
      onEventSuccess(result)
    })
  }

  const canAct =
    !readOnly && (detail.canRescheduleClosing || detail.canRecordClosingOutcome)

  return (
    <section className="rounded-xl bg-surface p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-sans text-body-sm font-semibold text-fg">
          Fechamento
        </h3>
        <span className="inline-flex rounded-md bg-hover px-2 py-0.5 font-sans text-caption font-medium text-fg-secondary">
          {CLOSING_STAGE_LABELS[stage]}
        </span>
        {meetingOverdue ? (
          <span className="inline-flex rounded-md bg-danger/10 px-2 py-0.5 font-sans text-caption font-medium text-danger">
            Reunião vencida
          </span>
        ) : null}
      </div>

      {!canAct ? (
        <p className="font-sans text-body-sm text-fg-secondary">
          {readOnly
            ? "Visualização da oportunidade."
            : "Você não pode registrar o desfecho desta reunião."}
        </p>
      ) : (
        <>
          <p className="mb-1.5 font-sans text-caption text-fg-secondary">
            Ação
          </p>
          <div
            role="radiogroup"
            aria-label="Ação de fechamento"
            className="mb-3 flex flex-wrap gap-1.5"
          >
            {actions.map((item) => {
              const selected = action === item
              return (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={isPending}
                  onClick={() => setAction(item)}
                  className={cn(
                    "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2",
                    "font-sans text-caption transition-[colors,transform] duration-150 ease-out",
                    "active:scale-[0.97]",
                    selected
                      ? EVENT_CHIP[item].selected
                      : "border-transparent text-fg-muted hover:text-fg",
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("size-1.5 rounded-full", EVENT_CHIP[item].dot)}
                  />
                  {item === "meeting_rescheduled" && stage === "standby"
                    ? "Outra reunião"
                    : LEAD_ACTIVITY_TYPE_LABELS[item]}
                </button>
              )
            })}
          </div>

          {showDenied ? (
            <Input
              id="closing-lost-reason"
              label="Motivo da perda"
              value={deniedReason}
              onChange={(event) => setDeniedReason(event.target.value)}
              error={fieldError.denied_reason}
              disabled={isPending}
              className="mb-3"
            />
          ) : null}

          {showCloser ? (
            <div className="mb-3">
              <Field data-invalid={Boolean(fieldError.closer_id)}>
                <FieldLabel htmlFor="closing-closer">Closer</FieldLabel>
                <Select value={closerId} onValueChange={(next) => setCloserId(String(next))} disabled={isPending || closersLoading}>
                  <SelectTrigger id="closing-closer" className="w-full"><SelectValue placeholder={closersLoading ? "Carregando…" : "Selecione o closer"} /></SelectTrigger>
                  <SelectContent align="start">{closers.map((closer) => <SelectItem key={closer.id} value={closer.id}>{closer.name}</SelectItem>)}</SelectContent>
                </Select>
                <FieldError>{fieldError.closer_id}</FieldError>
              </Field>
            </div>
          ) : null}

          {showChannel ? (
            <div className="mb-3">
              <p className="mb-1.5 font-sans text-caption text-fg-secondary">
                Canal de contato
              </p>
              <LeadActivityChannelPicker
                id="closing-standby-channel"
                value={isLeadActivityChannel(channel) ? channel : ""}
                detail={channelDetail}
                onValueChange={(next) => {
                  setChannel(next)
                  if (next !== "other") setChannelDetail("")
                }}
                onDetailChange={setChannelDetail}
                error={fieldError.channel}
                detailError={fieldError.channel_detail}
                disabled={isPending}
              />
            </div>
          ) : null}

          <label
            htmlFor="closing-note"
            className="mb-1.5 block font-sans text-caption text-fg-secondary"
          >
            Observação
          </label>
          <textarea
            id="closing-note"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={isPending}
            maxLength={2000}
            className={cn(
              "mb-3 w-full resize-none rounded-md border border-input-border bg-input px-3 py-2",
              "font-sans text-body-sm text-fg outline-none",
              "placeholder:text-fg-muted",
              "focus-visible:border-accent",
              "disabled:opacity-50",
            )}
          />

          <div className="flex items-end gap-3">
            {showFollowUp ? (
              <div className="w-[15.5rem] max-w-full">
                <DateTimePicker
                  id="closing-follow-up"
                  label={
                    action === "meeting_rescheduled"
                      ? "Data e horário da reunião"
                      : action === "closing_standby"
                        ? "Próximo contato"
                        : "Retorno (opcional)"
                  }
                  placeholder="Data e hora"
                  value={joinDatetimeLocal(followUpDate, followUpTime)}
                  onValueChange={(next) => {
                    setFollowUpDate(datetimeLocalToCivilDate(next))
                    setFollowUpTime(datetimeLocalToCivilTime(next))
                  }}
                  error={fieldError.follow_up_date}
                  disabled={isPending}
                  clearable={action === "closing_lost"}
                />
              </div>
            ) : null}
            <Button
              type="button"
              disabled={isPending || !action}
              className="ml-auto"
              onClick={submit}
            >
              {isPending ? "Registrando..." : "Registrar"}
            </Button>
          </div>
        </>
      )}

      {error ? (
        <p role="alert" className="mt-3 font-sans text-body-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  )
}

function isoToLocal(value: string | null): string {
  if (!value) return ""
  return toDatetimeLocalInput(value)
}

function ClosingChecklist({
  detail,
  readOnly,
  converted,
  onChecklistSuccess,
  onConvertSuccess,
  onPendingChange,
}: {
  detail: LeadClosingPanelProps["detail"]
  readOnly: boolean
  converted: boolean
  onChecklistSuccess: LeadClosingPanelProps["onChecklistSuccess"]
  onConvertSuccess: LeadClosingPanelProps["onConvertSuccess"]
  onPendingChange: (pending: boolean) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [legalName, setLegalName] = useState(
    detail.lead.legal_name ?? detail.lead.company_name,
  )
  const [taxId, setTaxId] = useState(
    detail.lead.tax_id ? formatTaxId(detail.lead.tax_id) : "",
  )
  const [signerName, setSignerName] = useState(
    detail.lead.signer_name ?? detail.lead.contact_name ?? "",
  )
  const [contractRef, setContractRef] = useState(detail.lead.contract_ref ?? "")
  const [invoiceRef, setInvoiceRef] = useState(detail.lead.invoice_ref ?? "")
  const [contractSentAt, setContractSentAt] = useState(
    isoToLocal(detail.lead.contract_sent_at),
  )
  const [contractSignedAt, setContractSignedAt] = useState(
    isoToLocal(detail.lead.contract_signed_at),
  )
  const [invoiceSentAt, setInvoiceSentAt] = useState(
    isoToLocal(detail.lead.invoice_sent_at),
  )
  const [paidAt, setPaidAt] = useState(isoToLocal(detail.lead.paid_at))

  useEffect(() => {
    onPendingChange(isPending)
    return () => onPendingChange(false)
  }, [isPending, onPendingChange])

  function saveThen(convert: boolean) {
    setError(null)
    const formData = new FormData()
    formData.set("lead_id", detail.lead.id)
    formData.set("legal_name", legalName)
    formData.set("tax_id", taxId)
    formData.set("signer_name", signerName)
    formData.set("contract_ref", contractRef)
    formData.set("invoice_ref", invoiceRef)
    formData.set("contract_sent_at", contractSentAt)
    formData.set("contract_signed_at", contractSignedAt)
    formData.set("invoice_sent_at", invoiceSentAt)
    formData.set("paid_at", paidAt)

    startTransition(async () => {
      const saved = await updateClosingChecklist(formData)
      if (saved.status === "error") {
        setError(saved.message)
        return
      }
      onChecklistSuccess(saved.patch)
      if (!convert) return
      const convertedResult = await convertLeadToClient(formData)
      if (convertedResult.status === "error") {
        setError(convertedResult.message)
        return
      }
      onConvertSuccess(convertedResult)
    })
  }

  return (
    <section className="rounded-xl bg-surface p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-sans text-body-sm font-semibold text-fg">
          {converted ? "Cliente consolidado" : "Consolidação do acordo"}
        </h3>
        <span className="inline-flex rounded-md bg-success/10 px-2 py-0.5 font-sans text-caption font-medium text-success">
          {converted ? "Início" : CLOSING_STAGE_LABELS.won_pending}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <Input
          id="closing-legal-name"
          label="Razão social / nome"
          value={legalName}
          onChange={(event) => setLegalName(event.target.value)}
          disabled={isPending || readOnly}
        />
        <Input
          id="closing-tax-id"
          label="CPF ou CNPJ"
          value={taxId}
          onChange={(event) => setTaxId(formatTaxId(event.target.value))}
          disabled={isPending || readOnly}
        />
        <Input
          id="closing-signer"
          label="Signatário"
          value={signerName}
          onChange={(event) => setSignerName(event.target.value)}
          disabled={isPending || readOnly}
        />
        <Input
          id="closing-contract-ref"
          label="Contrato (referência, opcional)"
          value={contractRef}
          onChange={(event) => setContractRef(event.target.value)}
          disabled={isPending || readOnly}
        />
        <DateTimePicker
          id="closing-contract-sent"
          label="Contrato enviado"
          value={contractSentAt}
          onValueChange={setContractSentAt}
          disabled={isPending || readOnly}
          clearable
        />
        <DateTimePicker
          id="closing-contract-signed"
          label="Contrato assinado"
          value={contractSignedAt}
          onValueChange={setContractSignedAt}
          disabled={isPending || readOnly}
          clearable
        />
        <Input
          id="closing-invoice-ref"
          label="Fatura (referência, opcional)"
          value={invoiceRef}
          onChange={(event) => setInvoiceRef(event.target.value)}
          disabled={isPending || readOnly}
        />
        <DateTimePicker
          id="closing-invoice-sent"
          label="Fatura enviada"
          value={invoiceSentAt}
          onValueChange={setInvoiceSentAt}
          disabled={isPending || readOnly}
          clearable
        />
        <DateTimePicker
          id="closing-paid-at"
          label="Pago"
          value={paidAt}
          onValueChange={setPaidAt}
          disabled={isPending || readOnly}
          clearable
        />
      </div>

      {!readOnly && !converted ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() => saveThen(false)}
          >
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={() => saveThen(true)}
          >
            Converter em cliente
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 font-sans text-body-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  )
}
