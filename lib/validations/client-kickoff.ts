import { z } from "zod"
import { datetimeLocalToIso } from "@/lib/date-time"
import { isLeadActivityChannel } from "@/lib/leads/channel"
import { CLIENT_KICKOFF_ACTIVITY_TYPES } from "@/lib/clients/kickoff"

const text = (formData: FormData, key: string) => {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)

export const logClientKickoffEventSchema = z
  .object({
    client_id: z.uuid("Cliente inválido."),
    type: z.enum(CLIENT_KICKOFF_ACTIVITY_TYPES),
    channel: z.string().trim(),
    channel_detail: optional(80),
    note: optional(2000),
    meeting_at: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    const scheduling =
      data.type === "kickoff_scheduled" || data.type === "kickoff_rescheduled"
    const channelRequired = scheduling || data.type === "kickoff_note"
    if (channelRequired && !isLeadActivityChannel(data.channel))
      ctx.addIssue({
        code: "custom",
        path: ["channel"],
        message: "Informe o canal.",
      })
    if (data.channel === "other" && !data.channel_detail)
      ctx.addIssue({
        code: "custom",
        path: ["channel_detail"],
        message: "Informe o canal.",
      })
    if (data.channel !== "other" && data.channel_detail)
      ctx.addIssue({
        code: "custom",
        path: ["channel_detail"],
        message: "Detalhe só se aplica a outro canal.",
      })
    if (!channelRequired && data.channel)
      ctx.addIssue({
        code: "custom",
        path: ["channel"],
        message: "Canal não se aplica a esta ação.",
      })
    if (scheduling && !datetimeLocalToIso(data.meeting_at))
      ctx.addIssue({
        code: "custom",
        path: ["meeting_at"],
        message: "Informe data e horário.",
      })
    if (!scheduling && data.meeting_at)
      ctx.addIssue({
        code: "custom",
        path: ["meeting_at"],
        message: "Esta ação não agenda data.",
      })
    if (data.type === "kickoff_note" && !data.note)
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Escreva a observação.",
      })
  })
  .transform((data) => ({
    ...data,
    channel: isLeadActivityChannel(data.channel) ? data.channel : null,
    channel_detail: data.channel === "other" ? data.channel_detail : null,
    meeting_at: datetimeLocalToIso(data.meeting_at),
  }))

export type LogClientKickoffEventInput = z.infer<
  typeof logClientKickoffEventSchema
>
export function readClientKickoffEventFormFields(formData: FormData) {
  return {
    client_id: text(formData, "client_id"),
    type: text(formData, "type"),
    channel: text(formData, "channel"),
    channel_detail: text(formData, "channel_detail"),
    note: text(formData, "note"),
    meeting_at: text(formData, "meeting_at"),
  }
}
