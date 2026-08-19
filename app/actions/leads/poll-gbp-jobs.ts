"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { DATAFORSEO_COLLECT_ERROR } from "@/lib/dataforseo/client"
import { getGoogleReviewsTask } from "@/lib/dataforseo/google-reviews"
import { getGoogleUpdatesTask } from "@/lib/dataforseo/google-updates"
import { resolveGbpDataProvider } from "@/lib/gbp-vendor/resolve"
import type { LeadGbpProfile } from "@/lib/leads/gbp"
import {
  gbpProfileIdSchema,
  readGbpProfileIdFields,
} from "@/lib/validations/lead-gbp"
import { createClient } from "@/lib/supabase/server"
import {
  denyGbpEdit,
  deleteGbpJobs,
  GBP_SELECT,
  loadGbpProfileRow,
  loadQueuedGbpJobs,
  rowToGbpProfile,
  upsertGbpJob,
} from "./gbp-access"

export type PollLeadGbpJobsState =
  | { status: "success"; profile: LeadGbpProfile }
  | { status: "error"; message: string }

const POLL_FAILED = "Não foi possível coletar os dados. Tente novamente."

export async function pollLeadGbpJobs(
  formData: FormData,
): Promise<PollLeadGbpJobsState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = gbpProfileIdSchema.safeParse(readGbpProfileIdFields(formData))
  if (!parsed.success) {
    return { status: "error", message: "Perfil inválido." }
  }

  const supabase = await createClient()
  const loaded = await loadGbpProfileRow(supabase, parsed.data.profile_id)
  if (loaded.status === "error") {
    return { status: "error", message: POLL_FAILED }
  }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Perfil não encontrado." }
  }

  const denied = denyGbpEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  const vendor = await resolveGbpDataProvider()
  const queued = await loadQueuedGbpJobs(supabase, parsed.data.profile_id)
  if (queued.status === "error") {
    return { status: "error", message: POLL_FAILED }
  }

  if (vendor.status !== "ok" || vendor.provider !== "dataforseo") {
    if (queued.jobs.length === 0) {
      return { status: "success", profile: loaded.profile }
    }
    const deleted = await deleteGbpJobs(supabase, parsed.data.profile_id)
    if (!deleted) return { status: "error", message: POLL_FAILED }
    const { data, error } = await supabase
      .from("lead_gbp_profiles")
      .select(GBP_SELECT)
      .eq("id", parsed.data.profile_id)
      .single()
    if (error || !data) {
      return { status: "error", message: POLL_FAILED }
    }
    const profile = rowToGbpProfile(data as Record<string, unknown>)
    if (!profile) {
      return { status: "error", message: POLL_FAILED }
    }
    return { status: "success", profile }
  }

  if (queued.jobs.length === 0) {
    return { status: "success", profile: loaded.profile }
  }

  const now = new Date().toISOString()

  for (const job of queued.jobs) {
    if (job.dfs_task_id === "unavailable") {
      const failed = await upsertGbpJob(
        supabase,
        parsed.data.profile_id,
        job.kind,
        {
          dfs_task_id: job.dfs_task_id,
          status: "failed",
          error_message: DATAFORSEO_COLLECT_ERROR,
        },
      )
      if (!failed) return { status: "error", message: POLL_FAILED }
      continue
    }

    if (job.kind === "reviews") {
      const result = await getGoogleReviewsTask(job.dfs_task_id)
      if (result.status === "pending") continue
      if (result.status === "error") {
        const failed = await upsertGbpJob(
          supabase,
          parsed.data.profile_id,
          "reviews",
          {
            dfs_task_id: job.dfs_task_id,
            status: "failed",
            error_message: result.message,
          },
        )
        if (!failed) return { status: "error", message: POLL_FAILED }
        continue
      }
      const { error } = await supabase
        .from("lead_gbp_profiles")
        .update({ reviews: result.reviews, reviews_at: now })
        .eq("id", parsed.data.profile_id)
      if (error) return { status: "error", message: POLL_FAILED }
      const ready = await upsertGbpJob(
        supabase,
        parsed.data.profile_id,
        "reviews",
        {
          dfs_task_id: job.dfs_task_id,
          status: "ready",
          error_message: null,
        },
      )
      if (!ready) return { status: "error", message: POLL_FAILED }
      continue
    }

    const result = await getGoogleUpdatesTask(job.dfs_task_id)
    if (result.status === "pending") continue
    if (result.status === "error") {
      const failed = await upsertGbpJob(
        supabase,
        parsed.data.profile_id,
        "updates",
        {
          dfs_task_id: job.dfs_task_id,
          status: "failed",
          error_message: result.message,
        },
      )
      if (!failed) return { status: "error", message: POLL_FAILED }
      continue
    }
    const { error } = await supabase
      .from("lead_gbp_profiles")
      .update({ posts: result.posts, posts_at: now })
      .eq("id", parsed.data.profile_id)
    if (error) return { status: "error", message: POLL_FAILED }
    const ready = await upsertGbpJob(
      supabase,
      parsed.data.profile_id,
      "updates",
      {
        dfs_task_id: job.dfs_task_id,
        status: "ready",
        error_message: null,
      },
    )
    if (!ready) return { status: "error", message: POLL_FAILED }
  }

  const { data, error } = await supabase
    .from("lead_gbp_profiles")
    .select(GBP_SELECT)
    .eq("id", parsed.data.profile_id)
    .single()

  if (error || !data) {
    return { status: "error", message: POLL_FAILED }
  }

  const profile = rowToGbpProfile(data as Record<string, unknown>)
  if (!profile) {
    return { status: "error", message: POLL_FAILED }
  }

  return { status: "success", profile }
}
