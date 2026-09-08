import { z } from "zod"
import {
  ACCESS_ANSWER_IDS,
  ACCESS_EMAIL_MAX,
  ACCESS_OTHER_ITEMS_MAX,
  ACCESS_OTHER_NAME_MAX,
  ACCESS_PASSWORD_MAX,
  ACCESS_URL_MAX,
  ACCESS_USERNAME_MAX,
  sanitizeAccessesPayload,
  type BriefingAccessesPayload,
} from "@/lib/briefing/accesses"
import { isBriefingSecretKind } from "@/lib/briefing/secrets"

const accessAnswer = z.union([z.enum(ACCESS_ANSWER_IDS), z.null()])

const credentialBlockSchema = z.object({
  status: accessAnswer,
  loginUrl: z.string().trim().max(ACCESS_URL_MAX),
  username: z.string().trim().max(ACCESS_USERNAME_MAX),
})

const inviteBlockSchema = z.object({
  status: accessAnswer,
  inviteEmail: z.string().trim().max(ACCESS_EMAIL_MAX),
})

const hostingBlockSchema = z.object({
  status: accessAnswer,
  panelUrl: z.string().trim().max(ACCESS_URL_MAX),
  username: z.string().trim().max(ACCESS_USERNAME_MAX),
})

const otherItemSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(ACCESS_OTHER_NAME_MAX),
  username: z.string().trim().max(ACCESS_USERNAME_MAX),
})

export const briefingAccessesPayloadSchema = z.object({
  wordpress: credentialBlockSchema,
  searchConsole: inviteBlockSchema,
  analytics: inviteBlockSchema,
  gbp: inviteBlockSchema,
  hosting: hostingBlockSchema,
  domain: hostingBlockSchema,
  otherTools: z.object({
    status: accessAnswer,
    items: z.array(otherItemSchema).max(ACCESS_OTHER_ITEMS_MAX),
  }),
})

export type BriefingAccessesInput = z.infer<
  typeof briefingAccessesPayloadSchema
>

export function toAccessesPayload(
  data: BriefingAccessesInput,
): BriefingAccessesPayload {
  return sanitizeAccessesPayload({
    wordpress: data.wordpress,
    searchConsole: data.searchConsole,
    analytics: data.analytics,
    gbp: data.gbp,
    hosting: data.hosting,
    domain: data.domain,
    otherTools: data.otherTools,
  })
}

export const briefingSecretUpsertSchema = z.object({
  kind: z.string().refine(isBriefingSecretKind, "Tipo de segredo inválido."),
  password: z.string().min(1).max(ACCESS_PASSWORD_MAX),
})

export const briefingSecretDeleteSchema = z.object({
  kind: z.string().refine(isBriefingSecretKind, "Tipo de segredo inválido."),
})
