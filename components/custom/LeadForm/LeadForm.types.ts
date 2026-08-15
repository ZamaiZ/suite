import type { LeadBoardItem } from "@/lib/leads/board-item"
import type { LeadFormValues } from "@/lib/validations/lead"
import type { LeadTag } from "@/lib/leads/tags"
import type { LeadRecord, LeadWritePayload } from "@/lib/leads/types"

export const LEAD_FORM_ID = "lead-form"

export type LeadFormSuccess =
  | { kind: "create"; item: LeadBoardItem }
  | { kind: "edit"; fields: LeadWritePayload; tags: LeadTag[] }

export type LeadFormProps = {
  mode: "create" | "edit"
  leadId?: string
  defaultValues?: Partial<LeadFormValues>
  lead?: LeadRecord
  initialTags?: LeadTag[]
  onSuccess?: (result: LeadFormSuccess) => void
  onPendingChange?: (pending: boolean) => void
  onDirtyChange?: (dirty: boolean) => void
  hideSubmit?: boolean
  readOnly?: boolean
}
