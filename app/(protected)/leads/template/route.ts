import { requireCommercialMember } from "@/lib/auth/session"
import {
  buildLeadTemplateBuffer,
  LEAD_SPREADSHEET_FILENAME,
} from "@/lib/leads/spreadsheet"

export async function GET() {
  await requireCommercialMember()
  const buffer = await buildLeadTemplateBuffer()
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
