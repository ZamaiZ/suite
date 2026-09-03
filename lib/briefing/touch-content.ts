import type { createAdminClient } from "@/lib/supabase/admin"

type AdminClient = ReturnType<typeof createAdminClient>

export async function touchBriefingContentUpdatedAt(
  admin: AdminClient,
  clientId: string,
): Promise<boolean> {
  const now = new Date().toISOString()
  const { error } = await admin
    .from("clients")
    .update({ briefing_content_updated_at: now })
    .eq("id", clientId)
    .not("briefing_finalized_at", "is", null)

  return !error
}
