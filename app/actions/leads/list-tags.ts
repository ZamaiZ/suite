"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import type { LeadTag } from "@/lib/leads/tags"
import { createClient } from "@/lib/supabase/server"

export async function listLeadTags(): Promise<LeadTag[]> {
  await requireCommercialMember()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tags")
    .select("id, name")
    .order("name")

  if (error) return []
  return (data ?? []).map((row) => ({ id: row.id, name: row.name }))
}
