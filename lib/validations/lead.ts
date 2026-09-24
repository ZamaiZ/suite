import { z } from "zod"
import {
  isBrazilStateCode,
  normalizeCityMatch,
  normalizeStateCode,
} from "@/lib/br-locations"
import { digitsOnly, isValidBrPhone, toStoredPhone } from "@/lib/br-documents"
import {
  DIGITAL_CHANNEL_TYPES,
  DIGITAL_CHANNELS_MAX,
  isDigitalChannelType,
  normalizeDigitalChannelList,
  primaryWebsiteChannel,
  type DigitalChannelDraft,
} from "@/lib/leads/digital-channels"
import { normalizeSegmentName, segmentSlug } from "@/lib/leads/segments"
import { TAGS_PER_LEAD_MAX } from "@/lib/leads/tags"
import type { LeadWritePayload } from "@/lib/leads/types"

export const LEAD_OBSERVATIONS_MAX = 2000

const optionalText = z
  .string()
  .trim()
  .max(200, "Texto deve ter no máximo 200 caracteres.")
  .transform((value) => (value.length === 0 ? null : value))

const segmentFieldSchema = z
  .string()
  .trim()
  .min(1, "Selecione um segmento.")
  .superRefine((value, ctx) => {
    const name = normalizeSegmentName(value)
    if (!name || !segmentSlug(name)) {
      ctx.addIssue({ code: "custom", message: "Segmento inválido." })
    }
  })
  .transform((value) => normalizeSegmentName(value) as string)

const stateCodeFieldSchema = z
  .string()
  .trim()
  .min(1, "Selecione a UF.")
  .transform((value) => normalizeStateCode(value))
  .refine((value) => value !== null, "UF inválida.")

const cityFieldSchema = z.string().trim().min(1, "Selecione a cidade.")

function formText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

const digitalChannelDraftSchema = z.object({
  type: z.enum(DIGITAL_CHANNEL_TYPES),
  value: z.string(),
  is_primary: z.boolean(),
})

function parseFormChannels(formData: FormData): DigitalChannelDraft[] {
  const raw = formData.get("channels")
  if (typeof raw !== "string" || raw.length === 0) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const channels: DigitalChannelDraft[] = []
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue
      const type = "type" in item ? item.type : null
      const value = "value" in item ? item.value : null
      const is_primary = "is_primary" in item ? item.is_primary : false
      if (!isDigitalChannelType(type) || typeof value !== "string") continue
      channels.push({ type, value, is_primary: Boolean(is_primary) })
    }
    return channels
  } catch {
    return []
  }
}

const leadCoreObjectSchema = z.object({
  company_name: z
    .string()
    .trim()
    .min(2, "Nome da empresa deve ter no mínimo 2 caracteres.")
    .max(200, "Nome da empresa deve ter no máximo 200 caracteres."),
  channels: z
    .array(digitalChannelDraftSchema)
    .max(DIGITAL_CHANNELS_MAX, "No máximo 10 canais."),
  segment: segmentFieldSchema,
  state_code: stateCodeFieldSchema,
  city: cityFieldSchema,
  contact_name: optionalText,
  phone: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (digitsOnly(value).length === 0) return
      if (!isValidBrPhone(value)) {
        ctx.addIssue({ code: "custom", message: "Telefone inválido." })
      }
    })
    .transform((value) => toStoredPhone(value)),
  email: z
    .string()
    .trim()
    .max(254, "E-mail deve ter no máximo 254 caracteres.")
    .transform((value) => (value.length === 0 ? null : value.toLowerCase()))
    .refine(
      (value) => value === null || z.email().safeParse(value).success,
      "E-mail inválido.",
    ),
  observations: z
    .string()
    .trim()
    .max(
      LEAD_OBSERVATIONS_MAX,
      "Observação deve ter no máximo 2000 caracteres.",
    )
    .optional()
    .default("")
    .transform((value) => (value.length === 0 ? null : value)),
})

function refineDigitalChannels(
  data: { channels: DigitalChannelDraft[] },
  ctx: z.RefinementCtx,
) {
  const result = normalizeDigitalChannelList(data.channels)
  if (result.issues.length === 0) return
  ctx.addIssue({
    code: "custom",
    path: ["channels"],
    message: result.issues[0]?.message ?? "Canais inválidos.",
  })
}

function refineContactAvailability(
  data: { channels: DigitalChannelDraft[]; phone: string | null },
  ctx: z.RefinementCtx,
) {
  const channels = normalizeDigitalChannelList(data.channels)
  if (primaryWebsiteChannel(channels.channels) || data.phone) return
  ctx.addIssue({
    code: "custom",
    path: ["channels"],
    message: "Informe um site ou telefone.",
  })
}

function refineLeadLocation(
  data: { state_code: string | null; city: string },
  ctx: z.RefinementCtx,
) {
  if (!data.state_code || !isBrazilStateCode(data.state_code)) return
  const city = normalizeCityMatch(data.state_code, data.city)
  if (!city) {
    ctx.addIssue({
      code: "custom",
      path: ["city"],
      message: "Cidade inválida para a UF selecionada.",
    })
  }
}

function toLeadWritePayload(
  data: z.infer<typeof leadCoreObjectSchema>,
): LeadWritePayload {
  const result = normalizeDigitalChannelList(data.channels)
  const primary = primaryWebsiteChannel(result.channels)
  const stateCode = data.state_code as NonNullable<typeof data.state_code>
  const city = normalizeCityMatch(stateCode, data.city) ?? data.city.trim()
  return {
    company_name: data.company_name,
    website: primary?.value ?? null,
    website_domain: primary?.normalized_key ?? null,
    channels: result.channels,
    contact_name: data.contact_name,
    phone: data.phone,
    email: data.email,
    observations: data.observations,
    segment: data.segment,
    state_code: stateCode,
    city,
  }
}

export const leadFieldsSchema = leadCoreObjectSchema
  .superRefine((data, ctx) => {
    refineDigitalChannels(data, ctx)
    refineContactAvailability(data, ctx)
    refineLeadLocation({ state_code: data.state_code, city: data.city }, ctx)
  })
  .transform(toLeadWritePayload)

export const leadFormObjectSchema = leadCoreObjectSchema
  .extend({
    contact_name: z.string(),
    phone: z.string(),
    email: z.string(),
    tags: z.array(z.string()).max(TAGS_PER_LEAD_MAX, "No máximo 8 tags."),
  })
  .omit({ observations: true })

export const leadFormSchema = leadFormObjectSchema.superRefine((data, ctx) => {
  refineDigitalChannels(data, ctx)
  refineContactAvailability(data, ctx)
  refineLeadLocation({ state_code: data.state_code, city: data.city }, ctx)
})

export const leadCompanyFormSchema = leadFormObjectSchema
  .pick({
    company_name: true,
    channels: true,
    segment: true,
    state_code: true,
    city: true,
    tags: true,
  })
  .superRefine((data, ctx) => {
    refineDigitalChannels(data, ctx)
    refineLeadLocation({ state_code: data.state_code, city: data.city }, ctx)
  })

export const leadContactFormSchema = leadFormObjectSchema.pick({
  contact_name: true,
  phone: true,
  email: true,
})

export type LeadFormValues = z.infer<typeof leadFormSchema>

export type LeadWriteFormFields = LeadFormValues & { observations: string }

export type LeadFieldName = keyof LeadWriteFormFields

export function readLeadFormFields(formData: FormData): LeadWriteFormFields {
  return {
    company_name: formText(formData, "company_name"),
    channels: parseFormChannels(formData),
    segment: formText(formData, "segment"),
    state_code: formText(formData, "state_code"),
    city: formText(formData, "city"),
    contact_name: formText(formData, "contact_name"),
    phone: formText(formData, "phone"),
    email: formText(formData, "email"),
    observations: formText(formData, "observations"),
    tags: formData
      .getAll("tags")
      .filter((value): value is string => typeof value === "string"),
  }
}

export const updateLeadSchema = z.object({
  lead_id: z.uuid("Lead inválido."),
})
