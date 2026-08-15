"use server"

import { revalidatePath } from "next/cache"
import {
  getCurrentUserRoles,
  requireUser,
} from "@/lib/auth/session"
import {
  hasRole,
  sortAppRoles,
  type AppRole,
} from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"
import { updateTeamMemberRolesSchema } from "@/lib/validations/team-role"

export type UpdateTeamMemberRolesState =
  | {
      status: "success"
      message: string
      roles: AppRole[]
    }
  | {
      status: "error"
      message: string
    }

export async function updateTeamMemberRoles(
  formData: FormData,
): Promise<UpdateTeamMemberRolesState> {
  await requireUser()
  const actorRoles = await getCurrentUserRoles()

  if (!hasRole(actorRoles, "admin")) {
    return {
      status: "error",
      message: "Você não tem permissão para gerenciar papéis.",
    }
  }

  const parsed = updateTeamMemberRolesSchema.safeParse({
    user_id: formData.get("user_id"),
    roles: formData.getAll("roles"),
  })

  if (!parsed.success) {
    return {
      status: "error",
      message: "Revise os papéis selecionados.",
    }
  }

  const roles = sortAppRoles(parsed.data.roles)
  const supabase = await createClient()
  const { error } = await supabase.rpc("replace_user_roles", {
    p_user_id: parsed.data.user_id,
    p_roles: roles,
  })

  if (error) {
    if (error.code === "P0002") {
      return { status: "error", message: "Usuário não encontrado." }
    }

    if (error.code === "42501") {
      return {
        status: "error",
        message: "Você não tem permissão para alterar estes papéis.",
      }
    }

    if (error.code === "23514") {
      return {
        status: "error",
        message: "A equipe precisa manter pelo menos um administrador.",
      }
    }

    return {
      status: "error",
      message: "Não foi possível atualizar os papéis. Tente novamente.",
    }
  }

  revalidatePath("/settings/team")
  return {
    status: "success",
    message: "Papéis atualizados.",
    roles,
  }
}
