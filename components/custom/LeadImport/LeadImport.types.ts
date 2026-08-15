import type {
  SpreadsheetEvaluatedRow,
  SpreadsheetIssue,
} from "@/lib/leads/types"

export type ImportFileStatus = "queued" | "analyzing" | "ready" | "failed"

export type ImportFileEntry = {
  id: string
  file: File
  name: string
  uploadedAt: string
  status: ImportFileStatus
  progress: number
  stageLabel: string
  failureMessage: string | null
  rows: SpreadsheetEvaluatedRow[]
}

export type SidebarMode = "hidden" | "overview" | { editing: string }

export type ImportIssueItem = {
  fileId: string
  fileName: string
  issue: SpreadsheetIssue
}

export type ImportPreviewRow = {
  fileId: string
  row: number
  company_name: string
  website: string
  contact_name: string
  phone: string
  email: string
}

export type ImportTotals = {
  files: number
  found: number
  valid: number
  problems: number
}
