import { z } from "zod"
import { digitsOnly, isValidBrPhone, toStoredPhone } from "@/lib/br-documents"
import {
  canonicalWebsiteUrl,
  normalizeWebsiteDomain,
} from "@/lib/leads/website"
import { TAGS_PER_LEAD_MAX } from "@/lib/leads/tags"
import type { LeadWritePayload } from "@/lib/leads/types"

export const LEAD_OBSERVATIONS_MAX = 2000

const optionalText = z
  .string()
  .trim()
  .max(200, "Texto deve ter no máximo 200 caracteres.")
  .transform((value) => (value.length === 0 ? null : value))

function formText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

export const leadFieldsSchema = z
  .object({
    company_name: z
      .string()
      .trim()
      .min(2, "Nome da empresa deve ter no mínimo 2 caracteres.")
      .max(200, "Nome da empresa deve ter no máximo 200 caracteres."),
    website: z
      .string()
      .trim()
      .min(1, "Site obrigatório.")
      .max(500, "Site deve ter no máximo 500 caracteres."),
    instagram: optionalText,
    linkedin: optionalText,
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
  .superRefine((data, ctx) => {
    if (!normalizeWebsiteDomain(data.website)) {
      ctx.addIssue({
        code: "custom",
        path: ["website"],
        message: "Site inválido.",
      })
    }
  })
  .transform((data): LeadWritePayload => {
    const website_domain = normalizeWebsiteDomain(data.website)
    if (!website_domain) {
      return {
        company_name: data.company_name,
        website: data.website,
        website_domain: "",
        instagram: data.instagram,
        linkedin: data.linkedin,
        contact_name: data.contact_name,
        phone: data.phone,
        email: data.email,
        observations: data.observations,
      }
    }

    return {
      company_name: data.company_name,
      website: canonicalWebsiteUrl(website_domain),
      website_domain,
      instagram: data.instagram,
      linkedin: data.linkedin,
      contact_name: data.contact_name,
      phone: data.phone,
      email: data.email,
      observations: data.observations,
    }
  })

export const leadFormSchema = z.object({
  company_name: z
    .string()
    .trim()
    .min(2, "Nome da empresa deve ter no mínimo 2 caracteres.")
    .max(200, "Nome da empresa deve ter no máximo 200 caracteres."),
  website: z
    .string()
    .trim()
    .min(1, "Site obrigatório.")
    .max(500, "Site deve ter no máximo 500 caracteres."),
  instagram: z.string(),
  linkedin: z.string(),
  contact_name: z.string(),
  phone: z.string(),
  email: z.string(),
  tags: z
    .array(z.string())
    .max(TAGS_PER_LEAD_MAX, "No máximo 8 tags."),
})

export type LeadFormValues = z.infer<typeof leadFormSchema>

export type LeadWriteFormFields = LeadFormValues & { observations: string }

export type LeadFieldName = keyof LeadWriteFormFields

export function readLeadFormFields(formData: FormData): LeadWriteFormFields {
  return {
    company_name: formText(formData, "company_name"),
    website: formText(formData, "website"),
    instagram: formText(formData, "instagram"),
    linkedin: formText(formData, "linkedin"),
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
