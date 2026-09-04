import "server-only"

import type { createClient } from "@/lib/supabase/server"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * Baseline da auditoria: o retrato usado como "antes" quando o resultado do
 * projeto for comparado depois.
 *
 * Nao ha copia de dados. `clients.baseline_at` guarda o momento da conversao e
 * cada dimensao resolve o snapshot mais recente ate aquela data. Sem ancora, o
 * "antes" seria a ultima vez que alguem clicou em analisar, que pode ter sido
 * meses antes da venda.
 */
export type AuditBaseline = {
  websiteAuditId: string | null
  visibilityAuditId: string | null
  gbpSnapshotId: string | null
}

export function emptyAuditBaseline(): AuditBaseline {
  return {
    websiteAuditId: null,
    visibilityAuditId: null,
    gbpSnapshotId: null,
  }
}

export async function resolveAuditBaseline(
  supabase: SupabaseClient,
  leadId: string,
  baselineAt: string | null,
): Promise<AuditBaseline> {
  if (!baselineAt) return emptyAuditBaseline()

  const [website, visibility, profiles] = await Promise.all([
    supabase
      .from("lead_website_audits")
      .select("id")
      .eq("lead_id", leadId)
      .lte("fetched_at", baselineAt)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("lead_visibility_audits")
      .select("id")
      .eq("lead_id", leadId)
      .lte("fetched_at", baselineAt)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("lead_gbp_profiles")
      .select("id")
      .eq("lead_id", leadId)
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle(),
  ])

  let gbpSnapshotId: string | null = null
  const profileId = profiles.data?.id
  if (typeof profileId === "string") {
    const { data } = await supabase
      .from("lead_gbp_snapshots")
      .select("id")
      .eq("profile_id", profileId)
      .lte("captured_at", baselineAt)
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    gbpSnapshotId = typeof data?.id === "string" ? data.id : null
  }

  return {
    websiteAuditId:
      typeof website.data?.id === "string" ? website.data.id : null,
    visibilityAuditId:
      typeof visibility.data?.id === "string" ? visibility.data.id : null,
    gbpSnapshotId,
  }
}
