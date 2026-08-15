import { parseTagNames, tagSlug, type LeadTag } from "@/lib/leads/tags"
import type { createClient } from "@/lib/supabase/server"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export async function syncLeadTags(
  supabase: SupabaseClient,
  leadId: string,
  names: string[],
): Promise<LeadTag[] | null> {
  const parsed = parseTagNames(names)

  if (parsed.length === 0) {
    const { error } = await supabase
      .from("lead_tags")
      .delete()
      .eq("lead_id", leadId)
    return error ? null : []
  }

  const rows = parsed.map((name) => ({
    name,
    slug: tagSlug(name),
  }))

  const { error: upsertError } = await supabase.from("tags").upsert(rows, {
    onConflict: "slug",
    ignoreDuplicates: true,
  })
  if (upsertError) return null

  const { data: tagRows, error: selectError } = await supabase
    .from("tags")
    .select("id, name, slug")
    .in(
      "slug",
      rows.map((row) => row.slug),
    )
  if (selectError || !tagRows) return null

  const bySlug = new Map(
    tagRows.map((row) => [row.slug as string, { id: row.id, name: row.name }]),
  )
  const tags: LeadTag[] = []
  for (const row of rows) {
    const tag = bySlug.get(row.slug)
    if (!tag) return null
    tags.push(tag)
  }

  const { data: current, error: currentError } = await supabase
    .from("lead_tags")
    .select("tag_id")
    .eq("lead_id", leadId)
  if (currentError) return null

  const currentIds = new Set((current ?? []).map((row) => row.tag_id as string))
  const nextIds = new Set(tags.map((tag) => tag.id))
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id))
  const toAdd = tags.filter((tag) => !currentIds.has(tag.id))

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("lead_tags")
      .delete()
      .eq("lead_id", leadId)
      .in("tag_id", toRemove)
    if (error) return null
  }

  if (toAdd.length > 0) {
    const { error } = await supabase.from("lead_tags").insert(
      toAdd.map((tag) => ({
        lead_id: leadId,
        tag_id: tag.id,
      })),
    )
    if (error) return null
  }

  return tags
}
