"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireCommercialMember } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import {
  applyExistingDomainConflicts,
  isSpreadsheetRowClean,
  LEAD_SPREADSHEET_MAX_BYTES,
  LEAD_SPREADSHEET_MAX_FILES,
  LEAD_SPREADSHEET_MAX_ROWS,
  rowDomain,
  summarizeEvaluatedRows,
  validateRawRows,
} from "@/lib/leads/spreadsheet-model"
import { parseLeadSpreadsheet } from "@/lib/leads/spreadsheet"
import type { LeadWritePayload, SpreadsheetEvaluatedRow } from "@/lib/leads/types"

const rawValuesSchema = z.object({
  company_name: z.string(),
  website: z.string(),
  contact_name: z.string(),
  phone: z.string(),
  email: z.string(),
  instagram: z.string(),
  linkedin: z.string(),
})

const evaluateRowsInputSchema = z
  .array(
    z.object({
      row: z.number().int().positive(),
      values: rawValuesSchema,
    }),
  )
  .min(1, "A planilha não tem linhas para importar.")
  .max(
    LEAD_SPREADSHEET_MAX_ROWS,
    `A planilha pode ter no máximo ${LEAD_SPREADSHEET_MAX_ROWS} linhas.`,
  )

const importPayloadSchema = z.object({
  company_name: z.string().min(2).max(200),
  website: z.string().min(1).max(500),
  website_domain: z.string().min(1),
  instagram: z.string().nullable(),
  linkedin: z.string().nullable(),
  contact_name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  observations: z.string().nullable(),
})

const importLeadsInputSchema = z
  .array(importPayloadSchema)
  .min(1, "Nenhuma linha válida para importar.")
  .max(
    LEAD_SPREADSHEET_MAX_ROWS * LEAD_SPREADSHEET_MAX_FILES,
    "Quantidade de linhas excede o limite da importação.",
  )

export type EvaluateLeadSpreadsheetState =
  | {
      status: "ok"
      rows: SpreadsheetEvaluatedRow[]
      validCount: number
      problemCount: number
    }
  | {
      status: "error"
      message: string
    }

export type ImportLeadsState =
  | {
      status: "success"
      message: string
      insertedCount: number
    }
  | {
      status: "error"
      message: string
    }

async function readSpreadsheetFile(formData: FormData): Promise<
  | { ok: true; buffer: ArrayBuffer }
  | { ok: false; message: string }
> {
  const file = formData.get("file")
  if (!(file instanceof File)) {
    return { ok: false, message: "Envie um arquivo .xlsx." }
  }

  const name = file.name.toLowerCase()
  if (!name.endsWith(".xlsx")) {
    return { ok: false, message: "Envie um arquivo .xlsx." }
  }

  if (file.size === 0) {
    return { ok: false, message: "O arquivo está vazio." }
  }

  if (file.size > LEAD_SPREADSHEET_MAX_BYTES) {
    return { ok: false, message: "O arquivo pode ter no máximo 1 MB." }
  }

  return { ok: true, buffer: await file.arrayBuffer() }
}

async function attachDatabaseConflicts(
  rows: SpreadsheetEvaluatedRow[],
): Promise<SpreadsheetEvaluatedRow[]> {
  const domains = [
    ...new Set(
      rows
        .map((row) => rowDomain(row))
        .filter((domain): domain is string => Boolean(domain)),
    ),
  ]
  if (domains.length === 0) return rows

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("leads")
    .select("id, website_domain, company_name")
    .in("website_domain", domains)

  if (error) {
    throw new Error("Unable to check existing lead domains.", { cause: error })
  }

  const existing = new Map(
    (data ?? []).map((lead) => [
      lead.website_domain as string,
      { company_name: lead.company_name as string },
    ]),
  )
  return applyExistingDomainConflicts(rows, existing)
}

function toEvaluateOk(rows: SpreadsheetEvaluatedRow[]): EvaluateLeadSpreadsheetState {
  const summary = summarizeEvaluatedRows(rows)
  return {
    status: "ok",
    rows,
    validCount: summary.valid,
    problemCount: summary.problems,
  }
}

export async function evaluateLeadSpreadsheet(
  formData: FormData,
): Promise<EvaluateLeadSpreadsheetState> {
  await requireCommercialMember()
  const file = await readSpreadsheetFile(formData)
  if (!file.ok) return { status: "error", message: file.message }

  try {
    const parsed = await parseLeadSpreadsheet(file.buffer)
    if (parsed.status === "error") {
      return { status: "error", message: parsed.message }
    }
    const rows = await attachDatabaseConflicts(parsed.rows)
    return toEvaluateOk(rows)
  } catch {
    return { status: "error", message: "Não foi possível ler a planilha." }
  }
}

export async function evaluateLeadRows(
  input: { row: number; values: z.infer<typeof rawValuesSchema> }[],
): Promise<EvaluateLeadSpreadsheetState> {
  await requireCommercialMember()
  const parsed = evaluateRowsInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Linhas inválidas.",
    }
  }

  try {
    const rows = await attachDatabaseConflicts(validateRawRows(parsed.data))
    return toEvaluateOk(rows)
  } catch {
    return { status: "error", message: "Não foi possível reavaliar as linhas." }
  }
}

export async function importLeads(
  payloads: LeadWritePayload[],
): Promise<ImportLeadsState> {
  const { user } = await requireCommercialMember()
  const parsed = importLeadsInputSchema.safeParse(payloads)
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Nenhuma linha válida para importar.",
    }
  }

  const unique = new Set<string>()
  for (const payload of parsed.data) {
    if (unique.has(payload.website_domain)) {
      return {
        status: "error",
        message: "Ainda há sites repetidos. Corrija e reavalie antes de importar.",
      }
    }
    unique.add(payload.website_domain)
  }

  try {
    const asRows = validateRawRows(
      parsed.data.map((payload, index) => ({
        row: index + 2,
        values: {
          company_name: payload.company_name,
          website: payload.website,
          contact_name: payload.contact_name ?? "",
          phone: payload.phone ?? "",
          email: payload.email ?? "",
          instagram: payload.instagram ?? "",
          linkedin: payload.linkedin ?? "",
        },
      })),
    )
    const evaluated = await attachDatabaseConflicts(asRows)
    const inserts: Array<{
      company_name: string
      website: string
      website_domain: string
      instagram: string | null
      linkedin: string | null
      contact_name: string | null
      phone: string | null
      email: string | null
      observations: string | null
      status: "new"
      assigned_sdr_id: null
      created_by: string
    }> = []

    for (const row of evaluated) {
      if (!isSpreadsheetRowClean(row) || !row.payload) {
        return {
          status: "error",
          message: "Ainda há problemas ou conflitos. Corrija e reavalie antes de importar.",
        }
      }
      inserts.push({
        company_name: row.payload.company_name,
        website: row.payload.website,
        website_domain: row.payload.website_domain,
        instagram: row.payload.instagram,
        linkedin: row.payload.linkedin,
        contact_name: row.payload.contact_name,
        phone: row.payload.phone,
        email: row.payload.email,
        observations: row.payload.observations,
        status: "new",
        assigned_sdr_id: null,
        created_by: user.id,
      })
    }

    const supabase = await createClient()
    const { error } = await supabase.from("leads").insert(inserts)

    if (error) {
      if (error.code === "23505") {
        return {
          status: "error",
          message: "Um dos sites já foi cadastrado enquanto você avaliava o arquivo.",
        }
      }
      return {
        status: "error",
        message: "Não foi possível importar os leads. Tente novamente.",
      }
    }

    revalidatePath("/leads")
    return {
      status: "success",
      insertedCount: evaluated.length,
      message: `${evaluated.length} leads importados.`,
    }
  } catch {
    return { status: "error", message: "Não foi possível importar os leads." }
  }
}
