"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { searchCities, type CitySearchResult } from "@/lib/br-locations"
import { z } from "zod"

const searchCitiesSchema = z.object({
  q: z.string().optional().default(""),
  offset: z.number().int().nonnegative().optional().default(0),
})

export type SearchCitiesState =
  | { status: "success"; result: CitySearchResult }
  | { status: "error"; message: string }

export async function searchLeadCities(input: {
  q?: string
  offset?: number
}): Promise<SearchCitiesState> {
  await requireCommercialMember()
  const parsed = searchCitiesSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: "Busca inválida." }
  }

  return {
    status: "success",
    result: searchCities({
      q: parsed.data.q,
      offset: parsed.data.offset,
      limit: 50,
    }),
  }
}
