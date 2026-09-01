import { z } from "zod"
import { LEAD_ACTIVITY_CHANNELS } from "@/lib/leads/channel"
import { LEAD_SDR_ACTIVITY_TYPES } from "@/lib/leads/status"
import { datetimeLocalToIso } from "@/lib/date-time"

function formText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

export const logLeadActivitySchema = z
  .object({
    lead_id: z.uuid("Lead inválido."),
    type: z.enum(LEAD_SDR_ACTIVITY_TYPES),
    channel: z.enum(LEAD_ACTIVITY_CHANNELS, {
      error: "Informe o canal do contato.",
    }),
    channel_detail: z
      .string()
      .trim()
      .max(80, "Canal deve ter no máximo 80 caracteres.")
      .transform((value) => (value.length === 0 ? null : value)),
    note: z
      .string()
      .trim()
      .max(2000, "Observação deve ter no máximo 2000 caracteres.")
      .transform((value) => (value.length === 0 ? null : value)),
    denied_reason: z
      .string()
      .trim()
      .max(500, "Motivo deve ter no máximo 500 caracteres.")
      .transform((value) => (value.length === 0 ? null : value)),
    closer_id: z.string().trim(),
    follow_up_date: z.string().trim(),
    follow_up_time: z.string().trim(),
  })
  .superRefine((data, ctx) => {
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

    if (data.type === "denied" && !data.denied_reason) {
      ctx.addIssue({
        code: "custom",
        path: ["denied_reason"],
        message: "Informe o motivo da negativa.",
      })
    }

    if (data.type !== "denied" && data.denied_reason) {
      ctx.addIssue({
        code: "custom",
        path: ["denied_reason"],
        message: "Motivo só se aplica a negativa.",
      })
    }

    if (data.type === "interested" && !data.closer_id) {
      ctx.addIssue({
        code: "custom",
        path: ["closer_id"],
        message: "Selecione o closer.",
      })
    }

    if (data.type === "interested" && data.closer_id) {
      if (!z.uuid().safeParse(data.closer_id).success) {
        ctx.addIssue({
          code: "custom",
          path: ["closer_id"],
          message: "Closer inválido.",
        })
      }
    }

    if (data.type !== "interested" && data.closer_id) {
      ctx.addIssue({
        code: "custom",
        path: ["closer_id"],
        message: "Closer só se aplica a interesse.",
      })
    }

    const wantsFollowUp =
      data.type === "call_later" ||
      data.type === "interested" ||
      (data.type === "denied" &&
        (data.follow_up_date.length > 0 || data.follow_up_time.length > 0))

    if (data.type === "call_later" && (!data.follow_up_date || !data.follow_up_time)) {
      ctx.addIssue({
        code: "custom",
        path: ["follow_up_date"],
        message: "Informe data e horário para ligar depois.",
      })
    }

    if (
      data.type === "interested" &&
      (!data.follow_up_date || !data.follow_up_time)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["follow_up_date"],
        message: "Informe data e horário da reunião.",
      })
    }

    if (wantsFollowUp && data.follow_up_date && data.follow_up_time) {
      const iso = datetimeLocalToIso(`${data.follow_up_date}T${data.follow_up_time}`)
      if (!iso) {
        ctx.addIssue({
          code: "custom",
          path: ["follow_up_date"],
          message: "Data ou horário inválido.",
        })
      }
    }

    if (
      data.type === "no_contact" &&
      (data.follow_up_date.length > 0 || data.follow_up_time.length > 0)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["follow_up_date"],
        message: "Esta tentativa não agenda retorno.",
      })
    }
  })
  .transform((data) => {
    const followUpAt =
      data.follow_up_date && data.follow_up_time
        ? datetimeLocalToIso(`${data.follow_up_date}T${data.follow_up_time}`)
        : null

    return {
      lead_id: data.lead_id,
      type: data.type,
      channel: data.channel,
      channel_detail: data.channel === "other" ? data.channel_detail : null,
      note: data.note,
      denied_reason: data.type === "denied" ? data.denied_reason : null,
      closer_id: data.type === "interested" ? data.closer_id : null,
      follow_up_at:
        data.type === "call_later" ||
        data.type === "interested" ||
        (data.type === "denied" && followUpAt)
          ? followUpAt
          : null,
    }
  })

export type LogLeadActivityInput = z.infer<typeof logLeadActivitySchema>

export function readLeadActivityFormFields(formData: FormData) {
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
