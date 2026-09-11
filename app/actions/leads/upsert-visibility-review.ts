"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import {
  stampVisibilityReview,
  type LeadVisibilityReview,
} from "@/lib/leads/visibility-review"
import {
  readUpsertVisibilityReviewFields,
  upsertVisibilityReviewSchema,
} from "@/lib/validations/lead-visibility-review"
import { createClient } from "@/lib/supabase/server"
import {
  denyVisibilityEdit,
  loadVisibilityAuditByLead,
} from "./visibility-access"

export type UpsertVisibilityReviewState =
  | { status: "success"; review: LeadVisibilityReview }
  | { status: "error"; message: string }

const SAVE_FAILED = "Não foi possível salvar. Tente novamente."

/**
 * Grava o julgamento do analista da etapa de Visibilidade.
 *
 * `review` e `notes` chegam **juntos** porque moram na mesma linha e são
 * gravados pela mesma action: dois timers de debounce para a mesma linha
 * fariam a última requisição sobrescrever o campo que a outra acabou de
 * gravar. Um salvamento é um salvamento.
 */
export async function upsertLeadVisibilityReview(
  formData: FormData,
): Promise<UpsertVisibilityReviewState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = upsertVisibilityReviewSchema.safeParse(
    readUpsertVisibilityReviewFields(formData),
  )
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? SAVE_FAILED,
    }
  }

  const supabase = await createClient()
  const loaded = await loadVisibilityAuditByLead(supabase, parsed.data.lead_id)
  if (loaded.status === "error")
    return { status: "error", message: SAVE_FAILED }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Lead não encontrado." }
  }

  const denied = denyVisibilityEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  const now = new Date().toISOString()
  const review = stampVisibilityReview(parsed.data.review, user.id, now)

  // Campo ausente não entra no upsert: no conflito o Postgres só atualiza as
  // colunas enviadas, então omiti-lo preserva a nota que já estava lá.
  const notesPatch =
    parsed.data.notes === undefined ? {} : { notes: parsed.data.notes }

  const { data, error } = await supabase
    .from("lead_visibility_reviews")
    .upsert(
      {
        lead_id: parsed.data.lead_id,
        review,
        ...notesPatch,
        updated_at: now,
        updated_by: user.id,
      },
      { onConflict: "lead_id" },
    )
    .select("review, notes, updated_at, updated_by")
    .single()

  if (error || !data) return { status: "error", message: SAVE_FAILED }

  return {
    status: "success",
    review: {
      review,
      notes: typeof data.notes === "string" ? data.notes : null,
      updated_at: now,
      updated_by: user.id,
    },
  }
}
