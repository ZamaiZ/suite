import { z } from "zod"
import {
  GBP_RANK_KEYWORD_MAX_LEN,
  GBP_RANK_KEYWORDS_MAX,
} from "@/lib/leads/gbp-audit"
import { GBP_NOTES_MAX } from "@/lib/leads/gbp"
import { PLACES_SUGGEST_MIN_CHARS } from "@/lib/places"

function formText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

export const suggestPlacesSchema = z.object({
  query: z
    .string()
    .trim()
    .min(PLACES_SUGGEST_MIN_CHARS, "Digite pelo menos 3 caracteres.")
    .max(200, "Busca deve ter no máximo 200 caracteres."),
  session_token: z.uuid("Sessão inválida."),
  location_hint: z
    .string()
    .trim()
    .max(200, "Localização inválida.")
    .transform((value) => (value.length === 0 ? null : value))
    .optional(),
})

export const linkLeadGbpSchema = z.object({
  lead_id: z.uuid("Lead inválido."),
  place_id: z
    .string()
    .trim()
    .min(10, "Estabelecimento inválido.")
    .max(500, "Estabelecimento inválido."),
  session_token: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || z.uuid().safeParse(value).success,
      "Sessão inválida.",
    )
    .transform((value) => (value.length === 0 ? null : value)),
})

export const gbpProfileIdSchema = z.object({
  profile_id: z.uuid("Perfil inválido."),
})

export const updateLeadGbpSchema = z.object({
  profile_id: z.uuid("Perfil inválido."),
  notes: z
    .string()
    .max(GBP_NOTES_MAX, `Nota deve ter no máximo ${GBP_NOTES_MAX} caracteres.`)
    .transform((value) => {
      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    }),
  set_primary: z.boolean(),
})

export const updateGbpRankKeywordsSchema = z.object({
  profile_id: z.uuid("Perfil inválido."),
  rank_keywords: z
    .array(z.string())
    .superRefine((values, ctx) => {
      const seen = new Set<string>()
      let count = 0
      for (const value of values) {
        const trimmed = value.trim()
        if (!trimmed) continue
        if (trimmed.length > GBP_RANK_KEYWORD_MAX_LEN) {
          ctx.addIssue({
            code: "custom",
            message: `Termo deve ter no máximo ${GBP_RANK_KEYWORD_MAX_LEN} caracteres.`,
          })
          return
        }
        const folded = trimmed.toLowerCase()
        if (seen.has(folded)) continue
        seen.add(folded)
        count += 1
        if (count > GBP_RANK_KEYWORDS_MAX) {
          ctx.addIssue({
            code: "custom",
            message: "Use no máximo 3 termos.",
          })
          return
        }
      }
    })
    .transform((values) => {
      const seen = new Set<string>()
      const keywords: string[] = []
      for (const value of values) {
        const trimmed = value.trim()
        if (!trimmed) continue
        const folded = trimmed.toLowerCase()
        if (seen.has(folded)) continue
        seen.add(folded)
        keywords.push(trimmed)
      }
      return keywords
    }),
})

export function readSuggestPlacesFields(formData: FormData) {
  return {
    query: formText(formData, "query"),
    session_token: formText(formData, "session_token"),
    location_hint: formText(formData, "location_hint"),
  }
}

export function readLinkLeadGbpFields(formData: FormData) {
  return {
    lead_id: formText(formData, "lead_id"),
    place_id: formText(formData, "place_id"),
    session_token: formText(formData, "session_token"),
  }
}

export function readGbpProfileIdFields(formData: FormData) {
  return {
    profile_id: formText(formData, "profile_id"),
  }
}

export function readUpdateLeadGbpFields(formData: FormData) {
  return {
    profile_id: formText(formData, "profile_id"),
    notes: formText(formData, "notes"),
    set_primary: formText(formData, "set_primary") === "true",
  }
}

export function readGbpRankKeywordsFields(formData: FormData) {
  const raw = formText(formData, "rank_keywords")
  let rank_keywords: unknown = []
  if (raw.length > 0) {
    try {
      rank_keywords = JSON.parse(raw) as unknown
    } catch {
      rank_keywords = null
    }
  }
  return {
    profile_id: formText(formData, "profile_id"),
    rank_keywords,
  }
}
