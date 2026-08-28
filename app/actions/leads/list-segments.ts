"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { isSegmentSlug, type LeadSegment } from "@/lib/leads/segments"
import { createClient } from "@/lib/supabase/server"

export async function listLeadSegments(): Promise<LeadSegment[]> {
  await requireCommercialMember()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("segments")
    .select("id, name, slug")
    .order("name")

  if (error) return []

  return (data ?? []).flatMap((row) => {
    if (typeof row.id !== "string" || typeof row.name !== "string") return []
    if (!isSegmentSlug(row.slug)) return []
    return [{ id: row.id, name: row.name }]
  })
}
