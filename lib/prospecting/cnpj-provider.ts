export type CnpjProviderCandidate = {
  id: string
  companyName: string
}

export type CnpjProviderMatch = {
  id: string
  candidateId: string
  cnpj: string
  legalName: string | null
  tradeName: string | null
  registrationStatus: string | null
  city: string | null
  stateCode: string | null
  primaryCnae: string | null
  source: "opencnpj_bigquery"
  sourceUpdatedAt: string | null
  sourceUrl: string
  structurallyValid: boolean
}

export type CnpjSearchAttemptStatus =
  | "not_found"
  | "suggestion"
  | "needs_review"
  | "source_limited"
  | "source_unavailable"

export type CnpjProviderAttempt = {
  candidateId: string
  status: CnpjSearchAttemptStatus
  matches: CnpjProviderMatch[]
}
