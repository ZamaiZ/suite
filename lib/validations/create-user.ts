import { z } from "zod"

export const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter no mínimo 2 caracteres.")
    .max(100, "Nome deve ter no máximo 100 caracteres."),
  email: z
    .string()
    .trim()
    .email("E-mail inválido.")
    .max(254, "E-mail deve ter no máximo 254 caracteres."),
  password: z
    .string()
    .min(12, "Senha deve ter no mínimo 12 caracteres.")
    .max(128, "Senha deve ter no máximo 128 caracteres."),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
