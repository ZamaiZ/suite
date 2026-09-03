import type { ClientRecord, ClientStage } from "@/lib/clients/types"

function isClientStage(value: unknown): value is ClientStage {
  return value === "initial"
}

function asInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && /^-?\d+$/.test(value)) return Number(value)
  return null
}

export function parseClientRow(value: unknown): ClientRecord | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>

  if (typeof row.id !== "string") return null
  if (typeof row.lead_id !== "string") return null
  if (typeof row.company_name !== "string") return null
  if (!isClientStage(row.stage)) return null
  if (typeof row.converted_at !== "string") return null
  const sessionVersion = asInteger(row.portal_session_version)
  const authFailures = asInteger(row.portal_auth_failures)
  if (sessionVersion === null || authFailures === null) return null

  return {
    id: row.id,
    lead_id: row.lead_id,
    company_name: row.company_name,
    closer_id: typeof row.closer_id === "string" ? row.closer_id : null,
    converted_at: row.converted_at,
    stage: row.stage,
    portal_slug: typeof row.portal_slug === "string" ? row.portal_slug : null,
    portal_code_hash:
      typeof row.portal_code_hash === "string" ? row.portal_code_hash : null,
    portal_code_generated_at:
      typeof row.portal_code_generated_at === "string"
        ? row.portal_code_generated_at
        : null,
    portal_code_rotated_at:
      typeof row.portal_code_rotated_at === "string"
        ? row.portal_code_rotated_at
        : null,
    portal_code_rotated_by:
      typeof row.portal_code_rotated_by === "string"
        ? row.portal_code_rotated_by
        : null,
    portal_session_version: sessionVersion,
    portal_auth_failures: authFailures,
    portal_locked_until:
      typeof row.portal_locked_until === "string"
        ? row.portal_locked_until
        : null,
  }
}
