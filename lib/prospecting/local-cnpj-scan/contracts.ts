export type CnpjSearchCandidate = {
  run_id: string
  candidate_id: string
  company_name: string
  primary_category: string
  address: string
  phone: string
  website: string
  website_domain: string
  city: string
  state_code: string
  existing_cnpj: string
}

export type CnpjSearchResult = {
  candidate_id: string
  research_status: "found" | "not_found" | "ambiguous" | "skipped"
  cnpj: string | null
  legal_name?: string | null
  trade_name?: string | null
  registration_status?: string | null
  matched_city?: string | null
  matched_state_code?: string | null
  primary_cnae?: string | null
  source_url?: string | null
  source_checked_at?: string | null
  source_row_number?: number
}

export type LocalCnpjSourceFile = {
  group: "Empresas" | "Estabelecimentos"
  part: number
  relativePath: string
  bytes: number
  fieldCount: number | null
  modifiedAt: string
  snapshotToken: string | null
}

export type LocalCnpjSourceInspection = {
  snapshotKey: string
  competence: string | null
  files: LocalCnpjSourceFile[]
  totalBytes: number
  missingFiles: string[]
  layoutErrors: string[]
  ready: boolean
}

export type LocalCnpjSourceInspectionState = LocalCnpjSourceInspection & {
  enabled: boolean
  status: "not_configured" | "missing" | "source_ready" | "failed"
  message: string | null
  stateDirectory: string | null
  localStateBytes: number
  localEventCount: number
  activeExecution: boolean
}

export type LocalCnpjScanStatus = "idle" | "scanning" | "scan_complete" | "staging" | "committing" | "commit_pending" | "completed" | "cancelled" | "failed"
export type LocalCnpjScanPhase = "preparing" | "companies" | "establishments" | "matching" | "staging" | "committing" | "finished"

export type LocalCnpjScanSummary = {
  processed: number
  total: number
  suggestions: number
  ambiguous: number
  notFound: number
  skipped: number
  failed: number
  chunksStaged: number
  chunksTotal: number
  elapsedMs: number
}

export type LocalCnpjScanState = {
  enabled: boolean
  executionId: string | null
  runId: string | null
  snapshotKey: string | null
  datasetVersion: string | null
  status: LocalCnpjScanStatus
  phase: LocalCnpjScanPhase
  currentFile: string | null
  bytesRead: number
  totalBytes: number
  rowsRead: number
  completedFiles: number
  totalFiles: number
  candidateTotal: number
  candidatesProcessed: number
  freeBytes: number | null
  rateBytesPerSecond: number | null
  startedAt: string | null
  updatedAt: string | null
  finishedAt: string | null
  importId: string | null
  summary: LocalCnpjScanSummary | null
  message: string | null
}

export type LocalCnpjScanInput = CnpjSearchCandidate[]
export type LocalCnpjScanResult = CnpjSearchResult[]

export type LocalCnpjScanEvent = {
  at: string
  type: "phase" | "progress" | "cancel_requested" | "terminal" | "error" | "staging" | "commit"
  phase: LocalCnpjScanPhase
  message?: string
  bytesRead?: number
  rowsRead?: number
  candidatesProcessed?: number
  suggestions?: number
  ambiguous?: number
  notFound?: number
  chunksStaged?: number
}

export type LocalCnpjCleanupPreview = {
  imports: number
  batches: number
  attempts: number
  matches: number
  confirmedMatches: number
}

export type LocalCnpjCleanupSummary = LocalCnpjCleanupPreview & {
  deletedImports: number
  deletedBatches: number
  deletedAttempts: number
  deletedMatches: number
  resetCandidates: number
}
