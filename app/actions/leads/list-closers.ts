"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"

export type CloserOption = {
  id: string
  name: string
}

export async function listClosers(): Promise<CloserOption[]> {
  await requireCommercialMember()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("users")
    .select("id, name, user_roles!inner(role)")
    .eq("user_roles.role", "closer")
    .order("name")

  if (error) return []

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
  }))
}
