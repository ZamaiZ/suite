"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireCommercialMember } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

const reviewSchema = z.object({
  runId: z.uuid(),
  candidateIds: z.array(z.uuid()).min(1).max(100),
  reviewState: z.enum(["selected", "ignored"]),
})

export async function setProspectingCandidateReviewAction(input: {
  runId: string
  candidateIds: string[]
  reviewState: "selected" | "ignored"
}): Promise<
  | { status: "success"; updatedCount: number }
  | { status: "error"; message: string }
> {
  const { user } = await requireCommercialMember()
  const parsed = reviewSchema.safeParse(input)
  if (!parsed.success || new Set(parsed.data.candidateIds).size !== parsed.data.candidateIds.length) {
    return { status: "error", message: "Seleção de candidatos inválida." }
  }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(
    "set_prospecting_candidate_review",
    {
      p_run_id: parsed.data.runId,
      p_actor_id: user.id,
      p_candidate_ids: parsed.data.candidateIds,
      p_review_state: parsed.data.reviewState,
    },
  )
  if (error || typeof data !== "number") {
    return { status: "error", message: "Não foi possível atualizar a seleção." }
  }
  revalidatePath(`/prospecting/${parsed.data.runId}`)
  return { status: "success", updatedCount: data }
}
