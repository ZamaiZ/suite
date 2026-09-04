export type ClientStage = "initial"
export type ClientKickoffStage = "none" | "scheduled" | "no_show" | "completed"

export type ClientRecord = {
  id: string
  lead_id: string
  company_name: string
  closer_id: string | null
  converted_at: string
  stage: ClientStage
  kickoff_stage: ClientKickoffStage
  kickoff_meeting_at: string | null
  portal_slug: string | null
  portal_code_hash: string | null
  portal_code_generated_at: string | null
  portal_code_rotated_at: string | null
  portal_code_rotated_by: string | null
  portal_session_version: number
  portal_auth_failures: number
  portal_locked_until: string | null
}

export const CLIENT_PORTAL_SELECT = [
  "id",
  "lead_id",
  "company_name",
  "closer_id",
  "converted_at",
  "stage",
  "kickoff_stage",
  "kickoff_meeting_at",
  "portal_slug",
  "portal_code_hash",
  "portal_code_generated_at",
  "portal_code_rotated_at",
  "portal_code_rotated_by",
  "portal_session_version",
  "portal_auth_failures",
  "portal_locked_until",
].join(", ")
