import { z } from "zod"

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("E-mail inválido.")
    .max(254, "E-mail deve ter no máximo 254 caracteres."),
  password: z
    .string()
    .min(1, "Senha obrigatória.")
    .max(128, "Senha deve ter no máximo 128 caracteres."),
})

export type LoginInput = z.infer<typeof loginSchema>
