"use server"

import { z } from "zod"
import { requireCommercialMember } from "@/lib/auth/session"
import { fetchBusinessListingCategories } from "@/lib/dataforseo/business-listings-catalog"
import {
  categoryLabel,
  categorySearchToken,
  localizedCategoryNames,
} from "@/lib/prospecting/category-catalog"
import { createClient } from "@/lib/supabase/server"

const searchSchema = z.object({
  query: z.string().trim().max(100).optional().default(""),
  limit: z.number().int().min(1).max(50).optional().default(20),
})

const mappingSchema = z
  .object({
    segmentId: z.uuid(),
    categoryNames: z.array(z.string().trim().min(1)).min(1).max(10),
    primaryCategory: z.string().trim().min(1),
  })
  .superRefine((value, context) => {
    const unique = new Set(value.categoryNames)
    if (unique.size !== value.categoryNames.length) {
      context.addIssue({
        code: "custom",
        path: ["categoryNames"],
        message: "Não repita categorias.",
      })
    }
    if (!unique.has(value.primaryCategory)) {
      context.addIssue({
        code: "custom",
        path: ["primaryCategory"],
        message: "A categoria principal deve fazer parte da seleção.",
      })
    }
  })

const segmentIdSchema = z.uuid()

export type ProspectingCategoryOption = {
  name: string
  label: string
  businessCount: number | null
}

export type CategorySearchState =
  | { status: "success"; items: ProspectingCategoryOption[] }
  | { status: "error"; message: string }

export type ProspectingSegmentCategoryMapping = {
  categoryNames: string[]
  primaryCategory: string
}

export type SegmentCategoryMappingState =
  | {
      status: "success"
      mapping: ProspectingSegmentCategoryMapping | null
    }
  | { status: "error"; message: string }

type CatalogRefreshState =
  | { status: "success"; count: number }
  | { status: "error"; message: string }

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

async function replaceCategoryCatalog(
  actorId: string,
  supabase: SupabaseServerClient,
): Promise<CatalogRefreshState> {
  const fetched = await fetchBusinessListingCategories()
  if (fetched.status === "error") return fetched

  const { error } = await supabase.rpc("replace_prospecting_category_catalog", {
    p_actor_id: actorId,
    p_fetched_at: fetched.fetchedAt,
    p_rows: fetched.categories.map((category) => ({
      category_name: category.name,
      business_count: category.businessCount,
      catalog_date: category.catalogDate,
    })),
  })
  if (error) {
    console.error("[prospecting] category catalog replacement failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      rowCount: fetched.categories.length,
    })
    const reference = error.code ? ` (${error.code})` : ""
    return {
      status: "error",
      message: `Não foi possível salvar as categorias${reference}.`,
    }
  }
  return { status: "success", count: fetched.categories.length }
}

export async function refreshProspectingCategoryCatalogAction(): Promise<
  CatalogRefreshState
> {
  const { user } = await requireCommercialMember()
  const supabase = await createClient()
  return replaceCategoryCatalog(user.id, supabase)
}

export async function searchProspectingCategoriesAction(input: {
  query?: string
  limit?: number
}): Promise<CategorySearchState> {
  const { user } = await requireCommercialMember()
  const parsed = searchSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: "Busca de categoria inválida." }
  }

  const supabase = await createClient()
  // A narrowing de `parsed.success` não sobrevive dentro da closure abaixo:
  // o limite precisa sair do union antes de `addMatchingRows` fechar sobre ele.
  const { limit } = parsed.data
  const query = parsed.data.query.trim()
  const rowMap = new Map<
    string,
    { category_name: string; business_count: number | null }
  >()

  async function addMatchingRows(): Promise<string | null> {
    if (!query) {
      const { data, error } = await supabase
        .from("prospecting_category_catalog")
        .select("category_name, business_count")
        .order("business_count", { ascending: false, nullsFirst: false })
        .limit(limit)
      if (error) return "Não foi possível buscar categorias."
      for (const row of data ?? []) rowMap.set(row.category_name, row)
      return null
    }

    const token = categorySearchToken(query)
    if (token) {
      const { data, error } = await supabase
        .from("prospecting_category_catalog")
        .select("category_name, business_count")
        .ilike("category_name", `%${token}%`)
        .order("business_count", { ascending: false, nullsFirst: false })
        .limit(limit)
      if (error) return "Não foi possível buscar categorias."
      for (const row of data ?? []) rowMap.set(row.category_name, row)
    }
    const localizedNames = localizedCategoryNames(query)
    if (localizedNames.length > 0) {
      const { data, error } = await supabase
        .from("prospecting_category_catalog")
        .select("category_name, business_count")
        .in("category_name", localizedNames)
        .order("business_count", { ascending: false, nullsFirst: false })
      if (error) return "Não foi possível buscar categorias."
      for (const row of data ?? []) rowMap.set(row.category_name, row)
    }
    return null
  }

  const firstReadError = await addMatchingRows()
  if (firstReadError) return { status: "error", message: firstReadError }

  if (rowMap.size === 0) {
    const { count, error } = await supabase
      .from("prospecting_category_catalog")
      .select("category_name", { count: "exact", head: true })
    if (error) {
      return { status: "error", message: "Não foi possível buscar categorias." }
    }
    if (count === 0) {
      const refreshed = await replaceCategoryCatalog(user.id, supabase)
      if (refreshed.status === "error") return refreshed
      const secondReadError = await addMatchingRows()
      if (secondReadError) {
        return { status: "error", message: secondReadError }
      }
    }
  }

  const items = [...rowMap.values()]
    .flatMap((row) => {
      if (typeof row.category_name !== "string") return []
      const label = categoryLabel(row.category_name)
      return [
        {
          name: row.category_name,
          label,
          businessCount:
            typeof row.business_count === "number" ? row.business_count : null,
        },
      ]
    })
    .sort(
      (left, right) =>
        (right.businessCount ?? -1) - (left.businessCount ?? -1) ||
        left.label.localeCompare(right.label, "pt-BR"),
    )
    .slice(0, limit)

  return { status: "success", items }
}

export async function getProspectingSegmentCategoriesAction(
  segmentId: string,
): Promise<SegmentCategoryMappingState> {
  await requireCommercialMember()
  const parsed = segmentIdSchema.safeParse(segmentId)
  if (!parsed.success) {
    return { status: "error", message: "Segmento inválido." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("prospecting_segment_categories")
    .select("category_name, is_primary")
    .eq("segment_id", parsed.data)
    .order("is_primary", { ascending: false })
    .order("category_name")
  if (error) {
    return {
      status: "error",
      message: "Não foi possível carregar as categorias do segmento.",
    }
  }

  const rows = (data ?? []).flatMap((row) =>
    typeof row.category_name === "string" &&
    typeof row.is_primary === "boolean"
      ? [{ name: row.category_name, isPrimary: row.is_primary }]
      : [],
  )
  if (rows.length === 0) {
    return { status: "success", mapping: null }
  }
  const primaryCategory = rows.find((row) => row.isPrimary)?.name
  if (!primaryCategory) {
    return {
      status: "error",
      message: "O mapeamento do segmento não possui categoria principal.",
    }
  }
  return {
    status: "success",
    mapping: {
      categoryNames: rows.map((row) => row.name),
      primaryCategory,
    },
  }
}

export async function saveProspectingSegmentCategoriesAction(input: {
  segmentId: string
  categoryNames: string[]
  primaryCategory: string
}): Promise<{ status: "success" } | { status: "error"; message: string }> {
  const { user } = await requireCommercialMember()
  const parsed = mappingSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: "Mapeamento de categorias inválido." }
  }

  const supabase = await createClient()
  const [{ data: segment, error: segmentError }, { data: categories, error: categoryError }] =
    await Promise.all([
      supabase.from("segments").select("id").eq("id", parsed.data.segmentId).maybeSingle(),
      supabase
        .from("prospecting_category_catalog")
        .select("category_name")
        .in("category_name", parsed.data.categoryNames),
    ])
  if (segmentError || categoryError || !segment) {
    return { status: "error", message: "Não foi possível validar o mapeamento." }
  }
  if ((categories ?? []).length !== parsed.data.categoryNames.length) {
    return { status: "error", message: "Uma ou mais categorias não existem no catálogo." }
  }

  const { error } = await supabase.rpc("replace_prospecting_segment_categories", {
    p_actor_id: user.id,
    p_segment_id: parsed.data.segmentId,
    p_category_names: parsed.data.categoryNames,
    p_primary_category: parsed.data.primaryCategory,
  })
  return error
    ? { status: "error", message: "Não foi possível salvar o mapeamento." }
    : { status: "success" }
}
