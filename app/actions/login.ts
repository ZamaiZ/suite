"use server"

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { loginSchema } from "@/lib/validations/login"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit"

export type LoginState =
  | { status: "idle" }
  | {
      status: "error"
      fieldErrors?: Partial<Record<"email" | "password", string[]>>
      message?: string
    }

export async function login(formData: FormData): Promise<LoginState> {
  const headerStore = await headers()
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"

  const allowed = await checkRateLimit("login", ip)
  if (!allowed) {
    return {
      status: "error",
      message: "Muitas tentativas. Tente novamente mais tarde.",
    }
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors as Partial<
        Record<"email" | "password", string[]>
      >,
    }
  }

  const { email, password } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return {
      status: "error",
      message: "E-mail ou senha incorretos.",
    }
  }

  redirect("/")
}
