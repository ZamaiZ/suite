import { leadFieldsSchema } from "@/lib/validations/lead"
import { parseTagNames } from "@/lib/leads/tags"
import {
  channelsFromSpreadsheetCells,
  DIGITAL_CHANNEL_LABELS,
  DIGITAL_CHANNEL_TYPES,
  digitalChannelConflictKey,
  isDigitalChannelType,
  normalizeDigitalChannelList,
  SPREADSHEET_FIELD_BY_TYPE,
  spreadsheetCellsFromChannels,
  type DigitalChannelType,
  type LeadDigitalChannelWrite,
} from "@/lib/leads/digital-channels"
import type {
  SpreadsheetEvaluatedRow,
  SpreadsheetIssue,
  SpreadsheetLeadWritePayload,
  SpreadsheetRawValues,
} from "@/lib/leads/types"

export const SPREADSHEET_VALUE_KEYS = [
  "company_name",
  "segment",
  "state_code",
  "city",
  "tags",
  "website",
  "contact_name",
  "phone",
  "email",
  ...DIGITAL_CHANNEL_TYPES.filter(
    (type): type is Exclude<DigitalChannelType, "website"> =>
      type !== "website",
  ),
] as const

export type SpreadsheetValueKey = (typeof SPREADSHEET_VALUE_KEYS)[number]

export const SPREADSHEET_FIELD_LABELS: Record<SpreadsheetValueKey, string> = {
  company_name: "Nome da empresa",
  segment: "Segmento",
  state_code: "UF",
  city: "Cidade",
  tags: "Tags",
  contact_name: "Nome do contato",
  phone: "Telefone",
  email: "E-mail",
  ...DIGITAL_CHANNEL_LABELS,
}

export const SPREADSHEET_FIELD_NOTES: Partial<
  Record<SpreadsheetValueKey, string>
> = {
  segment: "Use um segmento existente ou digite um novo nome.",
  state_code: "Sigla da UF com 2 letras (ex.: SP).",
  city: "Cidade conforme a UF selecionada.",
  tags: "Opcional. Separe múltiplas tags com ponto e vírgula (;).",
}

export const LEAD_SPREADSHEET_HEADERS = SPREADSHEET_VALUE_KEYS.map(
  (key) => SPREADSHEET_FIELD_LABELS[key],
)

export const LEAD_SPREADSHEET_MAX_BYTES = 1 * 1024 * 1024
export const LEAD_SPREADSHEET_MAX_ROWS = 500
export const LEAD_SPREADSHEET_MAX_FILES = 5
export const LEAD_SPREADSHEET_FILENAME = "modelo-leads.xlsx"
export const LEAD_SPREADSHEET_ACCEPT =
  ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

export const SPREADSHEET_CHANNEL_HEADER_NOTES: Record<
  DigitalChannelType,
  string
> = {
  website:
    "Vários sites: separe com ponto e vírgula (;). O primeiro é o principal.",
  instagram:
    "Vários Instagrams: separe com ponto e vírgula (;). O primeiro é o principal.",
  linkedin:
    "Vários LinkedIns: separe com ponto e vírgula (;). O primeiro é o principal.",
  facebook:
    "Vários Facebooks: separe com ponto e vírgula (;). O primeiro é o principal.",
  youtube:
    "Vários YouTubes: separe com ponto e vírgula (;). O primeiro é o principal.",
  tiktok:
    "Vários TikToks: separe com ponto e vírgula (;). O primeiro é o principal.",
  pinterest:
    "Vários Pinterests: separe com ponto e vírgula (;). O primeiro é o principal.",
  twitter:
    "Vários X (Twitter): separe com ponto e vírgula (;). O primeiro é o principal.",
}

export function spreadsheetDbConflictPrefix(type: DigitalChannelType): string {
  return `${DIGITAL_CHANNEL_LABELS[type]} já cadastrado`
}

export function spreadsheetSessionConflictPrefix(
  type: DigitalChannelType,
): string {
  return `${DIGITAL_CHANNEL_LABELS[type]} já existe em `
}

export function spreadsheetRepeatMessage(
  type: DigitalChannelType,
  previousRow: number,
): string {
  return `${DIGITAL_CHANNEL_LABELS[type]} repetido na linha ${previousRow}.`
}

export function parseSpreadsheetTags(raw: string): string[] {
  if (raw.trim().length === 0) return []
  return parseTagNames(
    raw
      .split(/[;,]/)
      .map((part) => part.trim())
      .filter(Boolean),
  )
}

export function spreadsheetValuesFromPayload(
  payload: {
    company_name: string
    segment: string
    state_code: string
    city: string
    channels: LeadDigitalChannelWrite[]
    contact_name: string | null
    phone: string | null
    email: string | null
  },
  tags: string[] = [],
): SpreadsheetRawValues {
  return {
    company_name: payload.company_name,
    segment: payload.segment,
    state_code: payload.state_code,
    city: payload.city,
    tags: tags.join("; "),
    contact_name: payload.contact_name ?? "",
    phone: payload.phone ?? "",
    email: payload.email ?? "",
    ...spreadsheetCellsFromChannels(payload.channels),
  }
}

export function rawValuesFromCells(cells: string[]): SpreadsheetRawValues {
  return Object.fromEntries(
    SPREADSHEET_VALUE_KEYS.map((key, index) => [key, cells[index] ?? ""]),
  ) as SpreadsheetRawValues
}

export function isEmptyRawValues(values: SpreadsheetRawValues): boolean {
  return SPREADSHEET_VALUE_KEYS.every((key) => values[key].trim().length === 0)
}

export function isSpreadsheetRowClean(row: SpreadsheetEvaluatedRow): boolean {
  return row.issues.length === 0 && row.payload !== null
}

export function rowChannelKeys(
  row: SpreadsheetEvaluatedRow,
): LeadDigitalChannelWrite[] {
  if (row.payload?.channels) return row.payload.channels
  return normalizeDigitalChannelList(channelsFromSpreadsheetCells(row.values))
    .channels
}

export function validateRawRows(
  input: { row: number; values: SpreadsheetRawValues }[],
): SpreadsheetEvaluatedRow[] {
  const seenKeys = new Map<string, { row: number; type: DigitalChannelType }>()

  return input.map((item) => {
    const issues: SpreadsheetIssue[] = []
    const drafts = channelsFromSpreadsheetCells(item.values)
    const parsed = leadFieldsSchema.safeParse({
      company_name: item.values.company_name,
      segment: item.values.segment,
      state_code: item.values.state_code,
      city: item.values.city,
      channels: drafts,
      contact_name: item.values.contact_name,
      phone: item.values.phone,
      email: item.values.email,
      observations: "",
    })

    // O cadastro manual aceita lead só com telefone — a prospecção importa
    // perfis do Google sem site. A planilha não: ela continua exigindo o site,
    // e essa é a única regra que ela não divide com o schema compartilhado.
    const fields = parsed.success ? parsed.data : null
    let payload: SpreadsheetLeadWritePayload | null = null
    if (fields) {
      const { website, website_domain: websiteDomain } = fields
      if (website && websiteDomain) {
        payload = { ...fields, website, website_domain: websiteDomain }
      } else {
        issues.push({
          row: item.row,
          field: "website",
          kind: "problem",
          message: "Informe o site da empresa.",
        })
      }
    }
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path0 = issue.path[0]
        let field: string | null = typeof path0 === "string" ? path0 : null
        if (path0 === "channels") {
          const index = issue.path[1]
          if (typeof index === "number" && drafts[index]) {
            field = SPREADSHEET_FIELD_BY_TYPE[drafts[index].type]
          } else {
            field = "website"
          }
        }
        if (
          issues.some(
            (existing) =>
              existing.field === field && existing.message === issue.message,
          )
        ) {
          continue
        }
        issues.push({
          row: item.row,
          field,
          kind: "problem",
          message: issue.message,
        })
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

    const channels = fields?.channels ?? []
    for (const channel of channels) {
      const key = digitalChannelConflictKey(
        channel.type,
        channel.normalized_key,
      )
      const previous = seenKeys.get(key)
      if (previous) {
        issues.push({
          row: item.row,
          field: SPREADSHEET_FIELD_BY_TYPE[channel.type],
          kind: "conflict",
          message: spreadsheetRepeatMessage(channel.type, previous.row),
        })
      } else {
        seenKeys.set(key, { row: item.row, type: channel.type })
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

export type ExistingChannelConflict = {
  company_name: string
  type: DigitalChannelType
}

export function applyExistingChannelConflicts(
  rows: SpreadsheetEvaluatedRow[],
  existing: Map<string, ExistingChannelConflict>,
): SpreadsheetEvaluatedRow[] {
  return rows.map((row) => {
    let next = row
    for (const channel of rowChannelKeys(row)) {
      const key = digitalChannelConflictKey(
        channel.type,
        channel.normalized_key,
      )
      const found = existing.get(key)
      if (!found) continue
      const prefix = spreadsheetDbConflictPrefix(found.type)
      if (
        next.issues.some(
          (issue) =>
            issue.kind === "conflict" &&
            issue.field === SPREADSHEET_FIELD_BY_TYPE[found.type] &&
            issue.message.startsWith(prefix),
        )
      ) {
        continue
      }
      next = {
        ...next,
        issues: [
          ...next.issues,
          {
            row: next.row,
            field: SPREADSHEET_FIELD_BY_TYPE[found.type],
            kind: "conflict",
            message: `${prefix} (${found.company_name}).`,
          },
        ],
      }
    }
    return next
  })
}

export function stripSessionConflicts(
  rows: SpreadsheetEvaluatedRow[],
): SpreadsheetEvaluatedRow[] {
  const prefixes = DIGITAL_CHANNEL_TYPES.map(spreadsheetSessionConflictPrefix)
  return rows.map((row) => ({
    ...row,
    issues: row.issues.filter(
      (issue) => !prefixes.some((prefix) => issue.message.startsWith(prefix)),
    ),
  }))
}

export function applySessionChannelConflicts(
  files: { id: string; name: string; rows: SpreadsheetEvaluatedRow[] }[],
): { id: string; rows: SpreadsheetEvaluatedRow[] }[] {
  const owned = new Map<string, string>()

  return files.map((file) => {
    const rows = stripSessionConflicts(file.rows).map((row) => {
      let next = row
      for (const channel of rowChannelKeys(row)) {
        const key = digitalChannelConflictKey(
          channel.type,
          channel.normalized_key,
        )
        const owner = owned.get(key)
        if (owner && owner !== file.id) {
          const ownerFile = files.find((item) => item.id === owner)
          const prefix = spreadsheetSessionConflictPrefix(channel.type)
          next = {
            ...next,
            issues: [
              ...next.issues,
              {
                row: next.row,
                field: SPREADSHEET_FIELD_BY_TYPE[channel.type],
                kind: "conflict" as const,
                message: `${prefix}${ownerFile?.name ?? "outro arquivo"}.`,
              },
            ],
          }
          continue
        }
        if (!owned.has(key)) owned.set(key, file.id)
      }
      return next
    })
    return { id: file.id, rows }
  })
}

export function preserveExternalConflicts(
  previous: SpreadsheetEvaluatedRow[],
  next: SpreadsheetEvaluatedRow[],
): SpreadsheetEvaluatedRow[] {
  const previousByRow = new Map(previous.map((row) => [row.row, row]))
  const dbPrefixes = DIGITAL_CHANNEL_TYPES.map(spreadsheetDbConflictPrefix)
  const sessionPrefixes = DIGITAL_CHANNEL_TYPES.map(
    spreadsheetSessionConflictPrefix,
  )

  return next.map((row) => {
    const old = previousByRow.get(row.row)
    if (!old) return row
    const extra = old.issues.filter((issue) => {
      if (issue.kind !== "conflict") return false
      const isTracked =
        dbPrefixes.some((prefix) => issue.message.startsWith(prefix)) ||
        sessionPrefixes.some((prefix) => issue.message.startsWith(prefix))
      if (!isTracked) return false
      const field = issue.field
      if (isDigitalChannelType(field)) {
        return old.values[field] === row.values[field]
      }
      return old.values.website === row.values.website
    })
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

export { spreadsheetCellsFromChannels }
