"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import {
  readGeoPromptSet,
  stampGeoReview,
  type LeadGeoReview,
} from "@/lib/leads/geo-review"
import {
  readUpsertGeoReviewFields,
  upsertGeoReviewSchema,
} from "@/lib/validations/lead-geo-review"
import { createClient } from "@/lib/supabase/server"
import { denyGeoEdit, loadGeoAuditByLead } from "./geo-access"

export type UpsertGeoReviewState =
  | { status: "success"; review: LeadGeoReview }
  | { status: "error"; message: string }

const SAVE_FAILED = "Não foi possível salvar. Tente novamente."

/**
 * Grava o julgamento do analista da etapa de Presença em IA.
 *
 * `review` e `notes` chegam **juntos** porque moram na mesma linha e são
 * gravados pela mesma action: dois timers de debounce para a mesma linha
 * fariam a última requisição sobrescrever o campo que a outra acabou de
 * gravar.
 *
 * **`prompt_set` nunca é enviado.** No conflito o Postgres só atualiza as
 * colunas do payload, então omiti-la preserva o conjunto de prompts fixado
 * pela sondagem. Mandá-la aqui zeraria a série temporal inteira, e o estrago
 * só apareceria na segunda sondagem.
 */
export async function upsertLeadGeoReview(
  formData: FormData,
): Promise<UpsertGeoReviewState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = upsertGeoReviewSchema.safeParse(
    readUpsertGeoReviewFields(formData),
  )
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? SAVE_FAILED,
    }
  }

  const supabase = await createClient()
  const loaded = await loadGeoAuditByLead(supabase, parsed.data.lead_id)
  if (loaded.status === "error") {
    return { status: "error", message: SAVE_FAILED }
  }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Lead não encontrado." }
  }

  const denied = denyGeoEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  const now = new Date().toISOString()
  const review = stampGeoReview(parsed.data.review, user.id, now)

  // Campo ausente não entra no upsert: no conflito o Postgres só atualiza as
  // colunas enviadas, então omiti-lo preserva a nota que já estava lá.
  const notesPatch =
    parsed.data.notes === undefined ? {} : { notes: parsed.data.notes }

  const { data, error } = await supabase
    .from("lead_geo_reviews")
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
    .select("review, prompt_set, notes, updated_at, updated_by")
    .single()

  if (error || !data) return { status: "error", message: SAVE_FAILED }

  return {
    status: "success",
    review: {
      review,
      promptSet: readGeoPromptSet(data.prompt_set),
      notes: typeof data.notes === "string" ? data.notes : null,
      updated_at: now,
      updated_by: user.id,
    },
  }
}
