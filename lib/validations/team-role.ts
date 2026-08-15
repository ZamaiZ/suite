import { z } from "zod"
import { APP_ROLES } from "@/lib/auth/roles"

export const updateTeamMemberRolesSchema = z.object({
  user_id: z.uuid("Usuário inválido."),
  roles: z
    .array(z.enum(APP_ROLES))
    .max(APP_ROLES.length, "Seleção de papéis inválida.")
    .transform((roles) => [...new Set(roles)]),
})

export type UpdateTeamMemberRolesInput = z.infer<
  typeof updateTeamMemberRolesSchema
>
