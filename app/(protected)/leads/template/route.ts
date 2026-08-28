import { requireCommercialMember } from "@/lib/auth/session"
import {
  buildLeadTemplateBuffer,
  LEAD_SPREADSHEET_FILENAME,
} from "@/lib/leads/spreadsheet"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  await requireCommercialMember()
  const supabase = await createClient()
  const [{ data: segmentRows }, { data: tagRows }] = await Promise.all([
    supabase.from("segments").select("name").order("name"),
    supabase.from("tags").select("name").order("name"),
  ])

  const buffer = await buildLeadTemplateBuffer({
    segments: (segmentRows ?? [])
      .map((row) => (typeof row.name === "string" ? row.name : ""))
      .filter(Boolean),
    tags: (tagRows ?? [])
      .map((row) => (typeof row.name === "string" ? row.name : ""))
      .filter(Boolean),
  })
  const bytes = Uint8Array.from(buffer)

  return new Response(bytes, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${LEAD_SPREADSHEET_FILENAME}"`,
      "Cache-Control": "no-store",
    },
  })
}
