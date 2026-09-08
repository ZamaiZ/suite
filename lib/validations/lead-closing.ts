import { z } from "zod"
import { digitsOnly, isValidCnpj, isValidCpf } from "@/lib/br-documents"
import { datetimeLocalToIso } from "@/lib/date-time"
import { isLeadActivityChannel } from "@/lib/leads/channel"
import { LEAD_CLOSING_ACTIVITY_TYPES } from "@/lib/leads/status"

function formText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

function optionalText(max: number, message: string) {
  return z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value.length === 0 ? null : value))
}

function parseFollowUp(date: string, time: string): string | null {
  if (!date || !time) return null
  return datetimeLocalToIso(`${date}T${time}`)
}

export const logClosingEventSchema = z
  .object({
    lead_id: z.uuid("Lead inválido."),
    type: z.enum(LEAD_CLOSING_ACTIVITY_TYPES),
    channel: z.string().trim(),
    channel_detail: optionalText(80, "Canal deve ter no máximo 80 caracteres."),
    note: optionalText(2000, "Observação deve ter no máximo 2000 caracteres."),
    denied_reason: optionalText(
      500,
      "Motivo deve ter no máximo 500 caracteres.",
    ),
    closer_id: z.string().trim(),
    follow_up_date: z.string().trim(),
    follow_up_time: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    const wantsDate =
      data.type === "meeting_rescheduled" ||
      data.type === "closing_standby" ||
      (data.type === "closing_lost" &&
        (data.follow_up_date.length > 0 || data.follow_up_time.length > 0))

    if (
      (data.type === "meeting_rescheduled" ||
        data.type === "closing_standby") &&
      (!data.follow_up_date || !data.follow_up_time)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["follow_up_date"],
        message:
          data.type === "meeting_rescheduled"
            ? "Informe data e horário da reunião."
            : "Informe data e horário do próximo contato.",
      })
    }

    if (wantsDate && data.follow_up_date && data.follow_up_time) {
      if (!parseFollowUp(data.follow_up_date, data.follow_up_time)) {
        ctx.addIssue({
          code: "custom",
          path: ["follow_up_date"],
          message: "Data ou horário inválido.",
        })
      }
    }

    if (
      data.type !== "meeting_rescheduled" &&
      data.type !== "closing_standby" &&
      data.type !== "closing_lost" &&
      (data.follow_up_date.length > 0 || data.follow_up_time.length > 0)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["follow_up_date"],
        message: "Esta ação não agenda data.",
      })
    }

    if (data.type === "meeting_rescheduled") {
      if (!data.closer_id) {
        ctx.addIssue({
          code: "custom",
          path: ["closer_id"],
          message: "Selecione o closer.",
        })
      } else if (!z.uuid().safeParse(data.closer_id).success) {
        ctx.addIssue({
          code: "custom",
          path: ["closer_id"],
          message: "Closer inválido.",
        })
      }
    } else if (data.closer_id) {
      ctx.addIssue({
        code: "custom",
        path: ["closer_id"],
        message: "Closer só se aplica a reagendamento.",
      })
    }

    if (data.type === "closing_standby") {
      if (!isLeadActivityChannel(data.channel)) {
        ctx.addIssue({
          code: "custom",
          path: ["channel"],
          message: "Informe o canal do contato.",
        })
      }
      if (data.channel === "other" && !data.channel_detail) {
        ctx.addIssue({
          code: "custom",
          path: ["channel_detail"],
          message: "Informe o canal do contato.",
        })
      }
      if (data.channel !== "other" && data.channel_detail) {
        ctx.addIssue({
          code: "custom",
          path: ["channel_detail"],
          message: "Detalhe só se aplica a outro canal.",
        })
      }
    } else {
      if (data.channel) {
        ctx.addIssue({
          code: "custom",
          path: ["channel"],
          message: "Canal só se aplica a stand-by.",
        })
      }
      if (data.channel_detail) {
        ctx.addIssue({
          code: "custom",
          path: ["channel_detail"],
          message: "Canal só se aplica a stand-by.",
        })
      }
    }

    if (data.type === "closing_lost" && !data.denied_reason) {
      ctx.addIssue({
        code: "custom",
        path: ["denied_reason"],
        message: "Informe o motivo da perda.",
      })
    }

    if (data.type !== "closing_lost" && data.denied_reason) {
      ctx.addIssue({
        code: "custom",
        path: ["denied_reason"],
        message: "Motivo só se aplica a perda.",
      })
    }
  })
  .transform((data) => {
    const followUpAt = parseFollowUp(data.follow_up_date, data.follow_up_time)

    return {
      lead_id: data.lead_id,
      type: data.type,
      channel:
        data.type === "closing_standby" && isLeadActivityChannel(data.channel)
          ? data.channel
          : null,
      channel_detail:
        data.type === "closing_standby" && data.channel === "other"
          ? data.channel_detail
          : null,
      note: data.note,
      denied_reason: data.type === "closing_lost" ? data.denied_reason : null,
      closer_id: data.type === "meeting_rescheduled" ? data.closer_id : null,
      follow_up_at:
        data.type === "meeting_rescheduled" ||
        data.type === "closing_standby" ||
        (data.type === "closing_lost" && followUpAt)
          ? followUpAt
          : null,
    }
  })

export type LogClosingEventInput = z.infer<typeof logClosingEventSchema>

export function readClosingEventFormFields(formData: FormData) {
  return {
    lead_id: formText(formData, "lead_id"),
    type: formText(formData, "type"),
    channel: formText(formData, "channel"),
    channel_detail: formText(formData, "channel_detail"),
    note: formText(formData, "note"),
    denied_reason: formText(formData, "denied_reason"),
    closer_id: formText(formData, "closer_id"),
    follow_up_date: formText(formData, "follow_up_date"),
    follow_up_time: formText(formData, "follow_up_time"),
  }
}

function optionalIsoDatetime(message: string) {
  return z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value.length === 0) return null
      const iso = datetimeLocalToIso(value)
      if (!iso) {
        ctx.addIssue({ code: "custom", message })
        return z.NEVER
      }
      return iso
    })
}

export const updateClosingChecklistSchema = z.object({
  lead_id: z.uuid("Lead inválido."),
  legal_name: optionalText(
    200,
    "Razão social deve ter no máximo 200 caracteres.",
  ),
  tax_id: z
    .string()
    .trim()
    .transform((value) => {
      const digits = digitsOnly(value)
      return digits.length === 0 ? null : digits.slice(0, 14)
    }),
  signer_name: optionalText(
    200,
    "Signatário deve ter no máximo 200 caracteres.",
  ),
  contract_ref: optionalText(
    500,
    "Referência deve ter no máximo 500 caracteres.",
  ),
  invoice_ref: optionalText(
    500,
    "Referência deve ter no máximo 500 caracteres.",
  ),
  contract_sent_at: optionalIsoDatetime("Data de envio do contrato inválida."),
  contract_signed_at: optionalIsoDatetime("Data de assinatura inválida."),
  invoice_sent_at: optionalIsoDatetime("Data de envio da fatura inválida."),
  paid_at: optionalIsoDatetime("Data de pagamento inválida."),
})

export type UpdateClosingChecklistInput = z.infer<
  typeof updateClosingChecklistSchema
>

export function readClosingChecklistFormFields(formData: FormData) {
  return {
    lead_id: formText(formData, "lead_id"),
    legal_name: formText(formData, "legal_name"),
    tax_id: formText(formData, "tax_id"),
    signer_name: formText(formData, "signer_name"),
    contract_ref: formText(formData, "contract_ref"),
    invoice_ref: formText(formData, "invoice_ref"),
    contract_sent_at: formText(formData, "contract_sent_at"),
    contract_signed_at: formText(formData, "contract_signed_at"),
    invoice_sent_at: formText(formData, "invoice_sent_at"),
    paid_at: formText(formData, "paid_at"),
  }
}

export function isValidTaxId(value: string): boolean {
  return isValidCpf(value) || isValidCnpj(value)
}

export const convertLeadSchema = z.object({
  lead_id: z.uuid("Lead inválido."),
})

export function readConvertLeadFormFields(formData: FormData) {
  return {
    lead_id: formText(formData, "lead_id"),
  }
}
