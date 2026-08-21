"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireCommercialMember } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import {
  DIGITAL_CHANNEL_TYPES,
  digitalChannelConflictKey,
  isDigitalChannelType,
} from "@/lib/leads/digital-channels"
import {
  applyExistingChannelConflicts,
  isSpreadsheetRowClean,
  LEAD_SPREADSHEET_MAX_BYTES,
  LEAD_SPREADSHEET_MAX_FILES,
  LEAD_SPREADSHEET_MAX_ROWS,
  rowChannelKeys,
  spreadsheetCellsFromChannels,
  SPREADSHEET_VALUE_KEYS,
  summarizeEvaluatedRows,
  validateRawRows,
  type ExistingChannelConflict,
  type SpreadsheetValueKey,
} from "@/lib/leads/spreadsheet-model"
import { parseLeadSpreadsheet } from "@/lib/leads/spreadsheet"
import type { LeadWritePayload, SpreadsheetEvaluatedRow } from "@/lib/leads/types"

const rawValuesSchema = z.object(
  Object.fromEntries(
    SPREADSHEET_VALUE_KEYS.map((key) => [key, z.string()]),
  ) as Record<SpreadsheetValueKey, z.ZodString>,
)

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

const importChannelSchema = z.object({
  type: z.enum(DIGITAL_CHANNEL_TYPES),
  value: z.string().min(1).max(500),
  normalized_key: z.string().min(1),
  is_primary: z.boolean(),
  sort_order: z.number().int().nonnegative(),
})

const importPayloadSchema = z.object({
  company_name: z.string().min(2).max(200),
  website: z.string().min(1).max(500),
  website_domain: z.string().min(1),
  channels: z.array(importChannelSchema).min(1),
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
  const keys = [
    ...new Set(
      rows.flatMap((row) =>
        rowChannelKeys(row).map((channel) => channel.normalized_key),
      ),
    ),
  ]
  if (keys.length === 0) return rows

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("lead_digital_channels")
    .select("type, normalized_key, leads(company_name)")
    .in("normalized_key", keys)

  if (error) {
    throw new Error("Unable to check existing lead channels.", { cause: error })
  }

  const existing = new Map<string, ExistingChannelConflict>()
  for (const row of data ?? []) {
    if (!isDigitalChannelType(row.type)) continue
    if (typeof row.normalized_key !== "string") continue
    const embed = row.leads as
      | { company_name: string }
      | { company_name: string }[]
      | null
    const company_name = Array.isArray(embed)
      ? (embed[0]?.company_name ?? "")
      : (embed?.company_name ?? "")
    existing.set(digitalChannelConflictKey(row.type, row.normalized_key), {
      type: row.type,
      company_name,
    })
  }
  return applyExistingChannelConflicts(rows, existing)
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
    for (const channel of payload.channels) {
      const key = digitalChannelConflictKey(
        channel.type,
        channel.normalized_key,
      )
      if (unique.has(key)) {
        return {
          status: "error",
          message:
            "Ainda há canais repetidos. Corrija e reavalie antes de importar.",
        }
      }
      unique.add(key)
    }
  }

  try {
    const asRows = validateRawRows(
      parsed.data.map((payload, index) => ({
        row: index + 2,
        values: {
          company_name: payload.company_name,
          ...spreadsheetCellsFromChannels(payload.channels),
          contact_name: payload.contact_name ?? "",
          phone: payload.phone ?? "",
          email: payload.email ?? "",
        },
      })),
    )
    const evaluated = await attachDatabaseConflicts(asRows)
    const inserts: Array<{
      company_name: string
      website: string
      website_domain: string
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
    const { data: inserted, error } = await supabase
      .from("leads")
      .insert(inserts)
      .select("id, website_domain")

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

    const idByDomain = new Map(
      (inserted ?? []).map((row) => [
        row.website_domain as string,
        row.id as string,
      ]),
    )
    const channelRows = parsed.data.flatMap((payload) => {
      const leadId = idByDomain.get(payload.website_domain)
      if (!leadId) return []
      return payload.channels.map((channel) => ({
        lead_id: leadId,
        type: channel.type,
        value: channel.value,
        normalized_key: channel.normalized_key,
        is_primary: channel.is_primary,
        sort_order: channel.sort_order,
      }))
    })

    if (channelRows.length > 0) {
      const { error: channelError } = await supabase
        .from("lead_digital_channels")
        .insert(channelRows)
      if (channelError) {
        if (channelError.code === "23505") {
          return {
            status: "error",
            message:
              "Um dos canais já foi cadastrado enquanto você avaliava o arquivo.",
          }
        }
        return {
          status: "error",
          message: "Não foi possível importar os leads. Tente novamente.",
        }
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
