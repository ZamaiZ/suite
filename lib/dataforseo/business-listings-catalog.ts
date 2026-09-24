import "server-only"

import { getDataForSeoList } from "./client"

export const BUSINESS_LISTINGS_CATEGORIES_PATH =
  "/business_data/business_listings/categories"

const CATALOG_ERROR =
  "Não foi possível carregar as categorias de prospecção."

export type BusinessListingCategory = {
  name: string
  title: string | null
  businessCount: number | null
  catalogDate: string | null
}

export type BusinessListingCategoryCatalogResult =
  | {
      status: "ok"
      categories: BusinessListingCategory[]
      fetchedAt: string
    }
  | { status: "error"; message: string }

function asName(value: unknown): string | null {
  if (typeof value !== "string") return null
  const name = value.trim()
  return name.length > 0 ? name : null
}

function asCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null
}

export async function fetchBusinessListingCategories(): Promise<BusinessListingCategoryCatalogResult> {
  const fetched = await getDataForSeoList<Record<string, unknown>>(
    BUSINESS_LISTINGS_CATEGORIES_PATH,
    CATALOG_ERROR,
  )
  if (fetched.status === "error") return fetched

  const byName = new Map<string, BusinessListingCategory>()
  for (const row of fetched.data) {
    const name = asName(row.category_name)
    if (!name) continue
    byName.set(name, {
      name,
      // O endpoint medido só publica category_name e business_count.
      title: null,
      businessCount: asCount(row.business_count),
      catalogDate: null,
    })
  }

  if (byName.size === 0) return { status: "error", message: CATALOG_ERROR }
  return {
    status: "ok",
    categories: [...byName.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    ),
    fetchedAt: new Date().toISOString(),
  }
}
