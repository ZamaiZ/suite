import "server-only"
import { Workbook, type CellValue } from "exceljs"
import {
  isEmptyRawValues,
  LEAD_SPREADSHEET_FILENAME,
  LEAD_SPREADSHEET_HEADERS,
  LEAD_SPREADSHEET_MAX_BYTES,
  LEAD_SPREADSHEET_MAX_ROWS,
  rawValuesFromCells,
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

export async function buildLeadTemplateBuffer(): Promise<Buffer> {
  const workbook = new Workbook()
  const sheet = workbook.addWorksheet("Leads")
  sheet.columns = LEAD_SPREADSHEET_HEADERS.map((header) => ({
    header,
    width: header.length < 18 ? 22 : 32,
  }))
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
