import { z } from "zod"
import {
  GBP_GRID_RADIUS_KM_MAX,
  GBP_GRID_RADIUS_KM_MIN,
  GBP_GRID_SIZES,
} from "@/lib/leads/gbp-grid"
import { GBP_RANK_KEYWORD_MAX_LEN } from "@/lib/leads/gbp-audit"

function formText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

function formNumber(formData: FormData, key: string): number {
  const value = formData.get(key)
  const parsed = typeof value === "string" ? Number(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function formFlag(formData: FormData, key: string): boolean {
  return formData.get(key) === "1"
}

export const startGbpGridScanSchema = z.object({
  profile_id: z.uuid("Perfil inválido."),
  keyword: z
    .string()
    .trim()
    .min(1, "Escolha uma keyword.")
    .max(
      GBP_RANK_KEYWORD_MAX_LEN,
      `Keyword deve ter no máximo ${GBP_RANK_KEYWORD_MAX_LEN} caracteres.`,
    ),
  size: z
    .number()
    .refine(
      (value) => (GBP_GRID_SIZES as readonly number[]).includes(value),
      "Tamanho de malha inválido.",
    ),
  radius_km: z
    .number()
    .min(GBP_GRID_RADIUS_KM_MIN, `Raio mínimo de ${GBP_GRID_RADIUS_KM_MIN} km.`)
    .max(GBP_GRID_RADIUS_KM_MAX, `Raio máximo de ${GBP_GRID_RADIUS_KM_MAX} km.`),
  mode: z.enum(["live", "queued"], "Modo de execução inválido."),
})

export function readStartGbpGridScanFields(formData: FormData) {
  return {
    profile_id: formText(formData, "profile_id"),
    keyword: formText(formData, "keyword"),
    size: formNumber(formData, "size"),
    radius_km: formNumber(formData, "radius_km"),
    mode: formText(formData, "mode"),
  }
}

export const pollGbpGridScanSchema = z.object({
  scan_id: z.uuid("Malha inválida."),
  /**
   * Só o botão "Retomar" manda isto. Zerar as tentativas é decisão de gastar de
   * novo, então o laço automático do navegador nunca zera.
   */
  reset_failed: z.boolean(),
})

export function readPollGbpGridScanFields(formData: FormData) {
  return {
    scan_id: formText(formData, "scan_id"),
    reset_failed: formFlag(formData, "reset_failed"),
  }
}
