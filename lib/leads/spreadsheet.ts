import "server-only"
import { Workbook, type CellValue } from "exceljs"
import { BR_STATES } from "@/lib/br-locations"
import {
  DIGITAL_CHANNEL_LABELS,
  DIGITAL_CHANNEL_TYPES,
} from "@/lib/leads/digital-channels"
import {
  isEmptyRawValues,
  LEAD_SPREADSHEET_FILENAME,
  LEAD_SPREADSHEET_HEADERS,
  LEAD_SPREADSHEET_MAX_BYTES,
  LEAD_SPREADSHEET_MAX_ROWS,
  rawValuesFromCells,
  SPREADSHEET_CHANNEL_HEADER_NOTES,
  SPREADSHEET_FIELD_LABELS,
  SPREADSHEET_FIELD_NOTES,
  SPREADSHEET_VALUE_KEYS,
  validateRawRows,
} from "@/lib/leads/spreadsheet-model"
import type { SpreadsheetEvaluatedRow } from "@/lib/leads/types"

export {
  LEAD_SPREADSHEET_FILENAME,
  LEAD_SPREADSHEET_HEADERS,
  LEAD_SPREADSHEET_MAX_BYTES,
  LEAD_SPREADSHEET_MAX_ROWS,
}

export type ParsedLeadSpreadsheet =
  | { status: "ok"; rows: SpreadsheetEvaluatedRow[] }
  | { status: "error"; message: string }

export type LeadTemplateCatalog = {
  segments: string[]
  tags: string[]
}

function cellText(value: CellValue): string {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim()
  }
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim()
    }
    if ("hyperlink" in value) {
      const hyperlink = value as { hyperlink?: string; text?: string }
      return (hyperlink.text || hyperlink.hyperlink || "").trim()
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part) => ("text" in part ? String(part.text) : ""))
        .join("")
        .trim()
    }
    if ("result" in value && value.result != null) {
      return cellText(value.result as CellValue)
    }
  }
  return String(value).trim()
}

function normalizeHeader(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR")
}

function columnLetter(index: number): string {
  let value = index
  let letters = ""
  while (value > 0) {
    const remainder = (value - 1) % 26
    letters = String.fromCharCode(65 + remainder) + letters
    value = Math.floor((value - 1) / 26)
  }
  return letters
}

function listValidationFormula(values: string[]): string {
  const escaped = values.map((value) =>
    value.replace(/"/g, '""').replace(/,/g, ""),
  )
  return `"${escaped.join(",")}"`
}

export async function buildLeadTemplateBuffer(
  catalog: LeadTemplateCatalog,
): Promise<Buffer> {
  const workbook = new Workbook()
  const sheet = workbook.addWorksheet("Leads")
  sheet.columns = LEAD_SPREADSHEET_HEADERS.map((header) => ({
    header,
    width: header.length < 18 ? 22 : 32,
  }))

  for (const key of SPREADSHEET_VALUE_KEYS) {
    const index = SPREADSHEET_VALUE_KEYS.indexOf(key)
    const note = SPREADSHEET_FIELD_NOTES[key]
    if (note) {
      sheet.getRow(1).getCell(index + 1).note = note
    }
  }

  for (const type of DIGITAL_CHANNEL_TYPES) {
    const index = SPREADSHEET_VALUE_KEYS.findIndex((key) => key === type)
    if (index < 0) continue
    sheet.getRow(1).getCell(index + 1).note =
      SPREADSHEET_CHANNEL_HEADER_NOTES[type]
  }

  const lastRow = LEAD_SPREADSHEET_MAX_ROWS + 1
  const segmentIndex =
    SPREADSHEET_VALUE_KEYS.findIndex((key) => key === "segment") + 1
  const stateIndex =
    SPREADSHEET_VALUE_KEYS.findIndex((key) => key === "state_code") + 1
  const tagsIndex = SPREADSHEET_VALUE_KEYS.findIndex((key) => key === "tags") + 1

  if (catalog.segments.length > 0 && segmentIndex > 0) {
    sheet.dataValidations.add(`${columnLetter(segmentIndex)}2:${columnLetter(segmentIndex)}${lastRow}`, {
      type: "list",
      allowBlank: false,
      formulae: [listValidationFormula(catalog.segments)],
      showErrorMessage: true,
      errorTitle: "Segmento inválido",
      error: "Selecione um segmento existente ou baixe o modelo novamente.",
    })
  }

  if (stateIndex > 0) {
    sheet.dataValidations.add(`${columnLetter(stateIndex)}2:${columnLetter(stateIndex)}${lastRow}`, {
      type: "list",
      allowBlank: false,
      formulae: [listValidationFormula(BR_STATES.map((state) => state.code))],
      showErrorMessage: true,
      errorTitle: "UF inválida",
      error: "Selecione uma UF válida.",
    })
  }

  if (catalog.tags.length > 0 && tagsIndex > 0) {
    sheet.dataValidations.add(`${columnLetter(tagsIndex)}2:${columnLetter(tagsIndex)}${lastRow}`, {
      type: "list",
      allowBlank: true,
      formulae: [listValidationFormula(catalog.tags)],
      showErrorMessage: true,
      errorTitle: "Tag inválida",
      error: "Selecione tags existentes ou deixe em branco.",
    })
  }

  const instructions = workbook.addWorksheet("Instruções")
  instructions.columns = [
    { header: "Campo", width: 22 },
    { header: "Como preencher", width: 72 },
  ]
  for (const key of SPREADSHEET_VALUE_KEYS) {
    instructions.addRow([
      SPREADSHEET_FIELD_LABELS[key],
      SPREADSHEET_FIELD_NOTES[key] ??
        SPREADSHEET_CHANNEL_HEADER_NOTES[
          key as keyof typeof SPREADSHEET_CHANNEL_HEADER_NOTES
        ] ??
        "",
    ])
  }
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export async function parseLeadSpreadsheet(
  buffer: ArrayBuffer | Buffer,
): Promise<ParsedLeadSpreadsheet> {
  const workbook = new Workbook()
  await workbook.xlsx.load(buffer as ArrayBuffer)
  const sheet = workbook.worksheets[0]

  if (!sheet) {
    return {
      status: "error",
      message: "A planilha não tem nenhuma aba.",
    }
  }

  const headerValues = LEAD_SPREADSHEET_HEADERS.map((_, index) =>
    cellText(sheet.getRow(1).getCell(index + 1).value),
  )
  const headersMatch = LEAD_SPREADSHEET_HEADERS.every(
    (header, index) =>
      normalizeHeader(headerValues[index] ?? "") === normalizeHeader(header),
  )

  if (!headersMatch) {
    return {
      status: "error",
      message: "O cabeçalho não confere com o modelo. Baixe o arquivo oficial.",
    }
  }

  const rawRows: { row: number; values: ReturnType<typeof rawValuesFromCells> }[] =
    []
  let dataRowCount = 0
  let exceeded = false

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return

    const values = rawValuesFromCells(
      LEAD_SPREADSHEET_HEADERS.map((_, index) =>
        cellText(row.getCell(index + 1).value),
      ),
    )
    if (isEmptyRawValues(values)) return

    dataRowCount += 1
    if (dataRowCount > LEAD_SPREADSHEET_MAX_ROWS) {
      exceeded = true
      return
    }

    rawRows.push({ row: rowNumber, values })
  })

  if (exceeded) {
    return {
      status: "error",
      message: `A planilha pode ter no máximo ${LEAD_SPREADSHEET_MAX_ROWS} linhas.`,
    }
  }

  if (rawRows.length === 0) {
    return {
      status: "error",
      message: "A planilha não tem linhas para importar.",
    }
  }

  return { status: "ok", rows: validateRawRows(rawRows) }
}
