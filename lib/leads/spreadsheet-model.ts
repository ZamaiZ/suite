import { leadFieldsSchema } from "@/lib/validations/lead"
import { normalizeWebsiteDomain } from "@/lib/leads/website"
import type {
  SpreadsheetEvaluatedRow,
  SpreadsheetIssue,
  SpreadsheetRawValues,
} from "@/lib/leads/types"

export const LEAD_SPREADSHEET_HEADERS = [
  "Nome da empresa",
  "Site",
  "Nome do contato",
  "Telefone",
  "E-mail",
  "Instagram",
  "LinkedIn",
] as const

export const SPREADSHEET_VALUE_KEYS = [
  "company_name",
  "website",
  "contact_name",
  "phone",
  "email",
  "instagram",
  "linkedin",
] as const

export type SpreadsheetValueKey = (typeof SPREADSHEET_VALUE_KEYS)[number]

export const SPREADSHEET_FIELD_LABELS: Record<SpreadsheetValueKey, string> = {
  company_name: "Nome da empresa",
  website: "Site",
  contact_name: "Nome do contato",
  phone: "Telefone",
  email: "E-mail",
  instagram: "Instagram",
  linkedin: "LinkedIn",
}

export const LEAD_SPREADSHEET_MAX_BYTES = 1 * 1024 * 1024
export const LEAD_SPREADSHEET_MAX_ROWS = 500
export const LEAD_SPREADSHEET_MAX_FILES = 5
export const LEAD_SPREADSHEET_FILENAME = "modelo-leads.xlsx"
export const LEAD_SPREADSHEET_ACCEPT =
  ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

export const SPREADSHEET_DB_CONFLICT_PREFIX = "Site já cadastrado"
export const SPREADSHEET_SESSION_CONFLICT_PREFIX = "Site já existe em "

export function rawValuesFromCells(cells: string[]): SpreadsheetRawValues {
  return {
    company_name: cells[0] ?? "",
    website: cells[1] ?? "",
    contact_name: cells[2] ?? "",
    phone: cells[3] ?? "",
    email: cells[4] ?? "",
    instagram: cells[5] ?? "",
    linkedin: cells[6] ?? "",
  }
}

export function isEmptyRawValues(values: SpreadsheetRawValues): boolean {
  return SPREADSHEET_VALUE_KEYS.every((key) => values[key].trim().length === 0)
}

export function isSpreadsheetRowClean(row: SpreadsheetEvaluatedRow): boolean {
  return row.issues.length === 0 && row.payload !== null
}

export function rowDomain(row: SpreadsheetEvaluatedRow): string | null {
  if (row.payload?.website_domain) return row.payload.website_domain
  return normalizeWebsiteDomain(row.values.website)
}

export function validateRawRows(
  input: { row: number; values: SpreadsheetRawValues }[],
): SpreadsheetEvaluatedRow[] {
  const seenDomains = new Map<string, number>()

  return input.map((item) => {
    const issues: SpreadsheetIssue[] = []
    const parsed = leadFieldsSchema.safeParse({
      ...item.values,
      observations: "",
    })

    let payload = parsed.success ? parsed.data : null
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      for (const [field, messages] of Object.entries(fieldErrors)) {
        for (const message of messages ?? []) {
          issues.push({
            row: item.row,
            field,
            kind: "problem",
            message,
          })
        }
      }
      if (issues.length === 0) {
        issues.push({
          row: item.row,
          field: null,
          kind: "problem",
          message: "Linha inválida.",
        })
      }
    }

    const domain = payload?.website_domain ?? normalizeWebsiteDomain(item.values.website)
    if (domain) {
      const previousRow = seenDomains.get(domain)
      if (previousRow) {
        issues.push({
          row: item.row,
          field: "website",
          kind: "conflict",
          message: `Site repetido na linha ${previousRow}.`,
        })
      } else {
        seenDomains.set(domain, item.row)
      }
    }

    if (issues.some((issue) => issue.kind === "problem")) {
      payload = null
    }

    return {
      row: item.row,
      values: item.values,
      payload,
      issues,
    }
  })
}

export function applyExistingDomainConflicts(
  rows: SpreadsheetEvaluatedRow[],
  existing: Map<string, { company_name: string }>,
): SpreadsheetEvaluatedRow[] {
  return rows.map((row) => {
    const domain = rowDomain(row)
    if (!domain) return row
    const found = existing.get(domain)
    if (!found) return row
    if (
      row.issues.some(
        (issue) =>
          issue.kind === "conflict" &&
          issue.field === "website" &&
          issue.message.startsWith(SPREADSHEET_DB_CONFLICT_PREFIX),
      )
    ) {
      return row
    }

    return {
      ...row,
      issues: [
        ...row.issues,
        {
          row: row.row,
          field: "website",
          kind: "conflict",
          message: `${SPREADSHEET_DB_CONFLICT_PREFIX} (${found.company_name}).`,
        },
      ],
    }
  })
}

export function stripSessionConflicts(
  rows: SpreadsheetEvaluatedRow[],
): SpreadsheetEvaluatedRow[] {
  return rows.map((row) => ({
    ...row,
    issues: row.issues.filter(
      (issue) => !issue.message.startsWith(SPREADSHEET_SESSION_CONFLICT_PREFIX),
    ),
  }))
}

export function applySessionDomainConflicts(
  files: { id: string; name: string; rows: SpreadsheetEvaluatedRow[] }[],
): { id: string; rows: SpreadsheetEvaluatedRow[] }[] {
  const owned = new Map<string, string>()

  return files.map((file) => {
    const rows = stripSessionConflicts(file.rows).map((row) => {
      const domain = rowDomain(row)
      if (!domain) return row
      const owner = owned.get(domain)
      if (owner && owner !== file.id) {
        const ownerFile = files.find((item) => item.id === owner)
        return {
          ...row,
          issues: [
            ...row.issues,
            {
              row: row.row,
              field: "website",
              kind: "conflict" as const,
              message: `${SPREADSHEET_SESSION_CONFLICT_PREFIX}${ownerFile?.name ?? "outro arquivo"}.`,
            },
          ],
        }
      }
      if (!owned.has(domain)) owned.set(domain, file.id)
      return row
    })
    return { id: file.id, rows }
  })
}

export function preserveExternalConflicts(
  previous: SpreadsheetEvaluatedRow[],
  next: SpreadsheetEvaluatedRow[],
): SpreadsheetEvaluatedRow[] {
  const previousByRow = new Map(previous.map((row) => [row.row, row]))

  return next.map((row) => {
    const old = previousByRow.get(row.row)
    if (!old || old.values.website !== row.values.website) return row
    const extra = old.issues.filter(
      (issue) =>
        issue.kind === "conflict" &&
        (issue.message.startsWith(SPREADSHEET_DB_CONFLICT_PREFIX) ||
          issue.message.startsWith(SPREADSHEET_SESSION_CONFLICT_PREFIX)),
    )
    if (extra.length === 0) return row
    const existing = new Set(row.issues.map((issue) => issue.message))
    const merged = extra.filter((issue) => !existing.has(issue.message))
    if (merged.length === 0) return row
    return { ...row, issues: [...row.issues, ...merged] }
  })
}

export function summarizeEvaluatedRows(rows: SpreadsheetEvaluatedRow[]) {
  let valid = 0
  let problems = 0
  for (const row of rows) {
    if (isSpreadsheetRowClean(row)) valid += 1
    else problems += 1
  }
  return { found: rows.length, valid, problems }
}
