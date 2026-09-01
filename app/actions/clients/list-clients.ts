"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export type ClientListItem = {
  id: string
  lead_id: string
  company_name: string
  closer_id: string | null
  closer_name: string | null
  converted_at: string
  stage: "initial"
}

export type ListClientsState =
  | { status: "success"; clients: ClientListItem[] }
  | { status: "error"; message: string }

export async function listClients(): Promise<ListClientsState> {
  await requireCommercialMember()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("clients")
    .select("id, lead_id, company_name, closer_id, converted_at, stage")
    .eq("stage", "initial")
    .order("converted_at", { ascending: false })

  if (error) {
    return {
      status: "error",
      message: "Não foi possível carregar os clientes.",
    }
  }

  const closerIds = [
    ...new Set(
      (data ?? [])
        .map((row) => row.closer_id)
        .filter((value): value is string => typeof value === "string"),
    ),
  ]
  const namesById = new Map<string, string>()
  if (closerIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("users")
      .select("id, name")
      .in("id", closerIds)
    if (profileError) {
      return {
        status: "error",
        message: "Não foi possível carregar os clientes.",
      }
    }
    for (const profile of profiles ?? []) {
      namesById.set(profile.id, profile.name)
    }
  }

  const clients: ClientListItem[] = (data ?? []).flatMap((row) => {
    if (row.stage !== "initial") return []
    return [
      {
        id: row.id,
        lead_id: row.lead_id,
        company_name: row.company_name,
        closer_id: row.closer_id,
        closer_name: row.closer_id ? (namesById.get(row.closer_id) ?? null) : null,
        converted_at: row.converted_at,
        stage: "initial",
      },
    ]
  })

  return { status: "success", clients }
}
