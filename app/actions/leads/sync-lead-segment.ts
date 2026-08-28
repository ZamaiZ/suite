import {
  normalizeSegmentName,
  segmentSlug,
  type LeadSegment,
} from "@/lib/leads/segments"
import type { createClient } from "@/lib/supabase/server"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export async function ensureSegment(
  supabase: SupabaseClient,
  rawName: string,
): Promise<LeadSegment | null> {
  const name = normalizeSegmentName(rawName)
  const slug = name ? segmentSlug(name) : ""
  if (!name || !slug) return null

  const { error: upsertError } = await supabase.from("segments").upsert(
    [{ name, slug }],
    {
      onConflict: "slug",
      ignoreDuplicates: true,
    },
  )
  if (upsertError) return null

  const { data: segmentRow, error: selectError } = await supabase
    .from("segments")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle()
  if (selectError || !segmentRow) return null

  return { id: segmentRow.id as string, name: segmentRow.name as string }
}

export async function syncLeadSegment(
  supabase: SupabaseClient,
  leadId: string,
  rawName: string,
): Promise<LeadSegment | null> {
  const segment = await ensureSegment(supabase, rawName)
  if (!segment) return null

  const { error: updateError } = await supabase
    .from("leads")
    .update({
      segment_id: segment.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId)
  if (updateError) return null

  return segment
}
