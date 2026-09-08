"use server"

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createUserSchema } from "@/lib/validations/create-user"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit"

export type CreateUserState =
  | { status: "idle" }
  | {
      status: "error"
      fieldErrors?: Partial<Record<"name" | "email" | "password", string[]>>
      message?: string
    }

export async function createUser(formData: FormData): Promise<CreateUserState> {
  const headerStore = await headers()
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"

  const allowed = await checkRateLimit("signup", ip)
  if (!allowed) {
    return {
      status: "error",
      message: "Muitas tentativas. Tente novamente mais tarde.",
    }
  }

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors as Partial<
        Record<"name" | "email" | "password", string[]>
      >,
    }
  }

  const { name, email, password } = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })

  if (error || !data.user) {
    return {
      status: "error",
      message:
        "Não foi possível criar a conta. Verifique os dados e tente novamente.",
    }
  }

  if (!data.session) {
    return {
      status: "error",
      message: "Confirme seu e-mail para acessar o sistema.",
    }
  }

  redirect("/")
}
