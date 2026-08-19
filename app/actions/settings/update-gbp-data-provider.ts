"use server"

import { revalidatePath } from "next/cache"
import { hasRole } from "@/lib/auth/roles"
import { requireCommercialMember } from "@/lib/auth/session"
import { GBP_DATA_PROVIDER_KEY } from "@/lib/gbp-vendor/types"
import { createClient } from "@/lib/supabase/server"
import { updateGbpDataProviderSchema } from "@/lib/validations/gbp-vendor"

export type UpdateGbpDataProviderState =
  | { status: "success" }
  | { status: "error"; message: string }

export async function updateGbpDataProvider(
  formData: FormData,
): Promise<UpdateGbpDataProviderState> {
  const { user, roles } = await requireCommercialMember()
  if (!hasRole(roles, "admin")) {
    return {
      status: "error",
      message: "Só administradores alteram.",
    }
  }

  const parsed = updateGbpDataProviderSchema.safeParse({
    provider: formData.get("provider"),
  })
  if (!parsed.success) {
    return { status: "error", message: "Fonte de dados inválida." }
  }

  const supabase = await createClient()
  const now = new Date().toISOString()
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: GBP_DATA_PROVIDER_KEY,
      value: parsed.data.provider,
      updated_at: now,
      updated_by: user.id,
    },
    { onConflict: "key" },
  )
  if (error) {
    return { status: "error", message: "Não foi possível salvar a fonte." }
  }

  revalidatePath("/settings/tools")
  return { status: "success" }
}
