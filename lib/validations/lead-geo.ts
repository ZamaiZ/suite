import { z } from "zod"

function formText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

export const analyzeGeoSchema = z.object({
  lead_id: z.uuid("Lead inválido."),
})

export function readAnalyzeGeoFields(formData: FormData) {
  return {
    lead_id: formText(formData, "lead_id"),
  }
}
