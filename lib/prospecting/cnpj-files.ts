import { isValidCnpj, normalizeCnpj } from "./cnpj"

export const CNPJ_RESEARCH_CSV_COLUMNS = [
  "run_id",
  "candidate_id",
  "company_name",
  "primary_category",
  "address",
  "phone",
  "website",
  "website_domain",
  "city",
  "state_code",
  "existing_cnpj",
  "research_status",
  "cnpj",
  "legal_name",
  "trade_name",
  "registration_status",
  "matched_city",
  "matched_state_code",
  "primary_cnae",
  "source_url",
  "source_checked_at",
] as const

export type CnpjResearchStatus = "found" | "not_found" | "ambiguous"

export type CnpjResearchMatch = {
  id: string
  candidateId: string
  cnpj: string
  legalName: string | null
  tradeName: string | null
  registrationStatus: string | null
  city: string | null
  stateCode: string | null
  primaryCnae: string | null
  source: "ai_research" | "opencnpj_bigquery" | "receita_local_index"
  datasetVersion: string | null
  sourceCheckedAt: string | null
  sourceUrl: string
  structurallyValid: boolean
}

export type CnpjCsvRow = Record<(typeof CNPJ_RESEARCH_CSV_COLUMNS)[number], string>

export type ValidatedCnpjCsvRow = {
  run_id: string
  candidate_id: string
  research_status: CnpjResearchStatus
  cnpj: string | null
  legal_name: string | null
  trade_name: string | null
  registration_status: string | null
  matched_city: string | null
  matched_state_code: string | null
  primary_cnae: string | null
  source_url: string | null
  source_checked_at: string | null
}

export class CnpjCsvError extends Error {
  constructor(
    message: string,
    readonly rowNumber?: number,
    readonly column?: string,
  ) {
    super(message)
    this.name = "CnpjCsvError"
  }
}

export function validateCnpjCsvRow(
  row: CnpjCsvRow,
  rowNumber: number,
): ValidatedCnpjCsvRow {
  validateCnpjCsvContext(row, rowNumber)
  const runId = row.run_id.trim()
  const candidateId = row.candidate_id.trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) {
    throw new CnpjCsvError("run_id inválido.", rowNumber, "run_id")
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidateId)) {
    throw new CnpjCsvError("candidate_id inválido.", rowNumber, "candidate_id")
  }

  const status = row.research_status.trim()
  if (status !== "found" && status !== "not_found" && status !== "ambiguous") {
    throw new CnpjCsvError(
      "Use found, not_found ou ambiguous.",
      rowNumber,
      "research_status",
    )
  }

  const textLimits: Array<[keyof CnpjCsvRow, number]> = [
    ["legal_name", 300],
    ["trade_name", 300],
    ["registration_status", 80],
    ["matched_city", 160],
    ["primary_cnae", 100],
    ["source_url", 500],
  ]
  for (const [column, limit] of textLimits) {
    if (row[column].trim().length > limit) {
      throw new CnpjCsvError(
        `Máximo de ${limit} caracteres.`,
        rowNumber,
        column,
      )
    }
  }

  const cnpjInput = row.cnpj.trim()
  if (status === "found") {
    const cnpj = normalizeCnpj(cnpjInput)
    if (!cnpj || !isValidCnpj(cnpj)) {
      throw new CnpjCsvError("CNPJ inválido ou com dígitos verificadores incorretos.", rowNumber, "cnpj")
    }
    const sourceUrl = safeHttpsUrl(row.source_url, rowNumber)
    const sourceDate = parseSourceDate(row.source_checked_at, rowNumber)
    const matchedState = row.matched_state_code.trim().toUpperCase()
    if (matchedState && !/^[A-Z]{2}$/.test(matchedState)) {
      throw new CnpjCsvError("Use a sigla de UF com duas letras.", rowNumber, "matched_state_code")
    }
    return {
      run_id: runId,
      candidate_id: candidateId,
      research_status: status,
      cnpj,
      legal_name: nullableText(row.legal_name),
      trade_name: nullableText(row.trade_name),
      registration_status: nullableText(row.registration_status),
      matched_city: nullableText(row.matched_city),
      matched_state_code: matchedState || null,
      primary_cnae: nullableText(row.primary_cnae),
      source_url: sourceUrl,
      source_checked_at: sourceDate,
    }
  }

  if (cnpjInput) {
    throw new CnpjCsvError("Deixe o CNPJ vazio quando não houver correspondência confirmada.", rowNumber, "cnpj")
  }
  return {
    run_id: runId,
    candidate_id: candidateId,
    research_status: status,
    cnpj: null,
    legal_name: null,
    trade_name: null,
    registration_status: null,
    matched_city: null,
    matched_state_code: null,
    primary_cnae: null,
    source_url: null,
    source_checked_at: null,
  }
}

export function validateCnpjCsvContext(row: CnpjCsvRow, rowNumber: number) {
  const limits: Array<[keyof CnpjCsvRow, number]> = [
    ["company_name", 300],
    ["primary_category", 300],
    ["address", 1000],
    ["phone", 100],
    ["website", 2048],
    ["website_domain", 253],
    ["city", 160],
    ["state_code", 2],
    ["existing_cnpj", 14],
  ]
  for (const [column, limit] of limits) {
    if (row[column].length > limit) {
      throw new CnpjCsvError(`Maximum ${limit} characters in candidate context.`, rowNumber, column)
    }
  }
}

function safeHttpsUrl(value: string, rowNumber: number): string {
  const input = value.trim()
  try {
    const url = new URL(input)
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      throw new Error("invalid")
    }
    return url.toString()
  } catch {
    throw new CnpjCsvError("Informe uma URL https válida para a fonte.", rowNumber, "source_url")
  }
}

function parseSourceDate(value: string, rowNumber: number): string {
  const input = value.trim()
  const timestamp = Date.parse(input)
  if (!input || Number.isNaN(timestamp)) {
    throw new CnpjCsvError("Informe uma data válida da consulta.", rowNumber, "source_checked_at")
  }
  return new Date(timestamp).toISOString()
}

function nullableText(value: string): string | null {
  return value.trim() || null
}
