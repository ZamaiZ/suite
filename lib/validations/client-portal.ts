import { z } from "zod"
import { isPortalCode, normalizePortalCode } from "@/lib/clients/portal-code"

export const portalCodeSchema = z
  .string()
  .transform(normalizePortalCode)
  .refine(isPortalCode, "Código inválido.")

export const clientIdSchema = z.uuid("Cliente inválido.")

export const issuePortalAccessSchema = z.object({
  client_id: clientIdSchema,
})

export const rotatePortalAccessSchema = z.object({
  client_id: clientIdSchema,
})

export const authenticateClientPortalSchema = z.object({
  slug: z.string().trim().min(1, "Acesso inválido.").max(64),
  code: portalCodeSchema,
})

export function readClientIdField(formData: FormData): { client_id: string } {
  const client_id = formData.get("client_id")
  return {
    client_id: typeof client_id === "string" ? client_id : "",
  }
}

export function readPortalAuthFields(formData: FormData): {
  slug: string
  code: string
} {
  const slug = formData.get("slug")
  const code = formData.get("code")
  return {
    slug: typeof slug === "string" ? slug : "",
    code: typeof code === "string" ? code : "",
  }
}

export { PORTAL_CODE_LENGTH } from "@/lib/clients/portal-code"
