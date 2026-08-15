import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import {
  hasAnyRole,
  isAppRole,
  isCommercialMember,
  sortAppRoles,
  type AppRole,
} from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"

export type SessionUser = {
  id: string
  email?: string
  user_metadata?: {
    name?: string
  }
}

function userFromClaims(
  claims: Record<string, unknown> | null | undefined,
): SessionUser | null {
  if (!claims) return null
  const id = claims.sub
  if (typeof id !== "string" || id.length === 0) return null
  const metadata = claims.user_metadata
  return {
    id,
    email: typeof claims.email === "string" ? claims.email : undefined,
    user_metadata:
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as { name?: string })
        : undefined,
  }
}

export const getUser = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) return null
  return userFromClaims(data.claims as Record<string, unknown>)
})

export const getCurrentUserRoles = cache(async (): Promise<AppRole[]> => {
  const user = await getUser()
  if (!user) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)

  if (error) {
    throw new Error("Unable to load the current user roles.", { cause: error })
  }

  return sortAppRoles(
    (data ?? []).map((entry) => entry.role).filter(isAppRole),
  )
})

export async function requireAuthenticatedUser() {
  const user = await getUser()
  if (!user) redirect("/login")
  return user
}

export async function requireCommercialMember() {
  const user = await requireAuthenticatedUser()
  const roles = await getCurrentUserRoles()

  if (!isCommercialMember(roles)) {
    redirect("/access-pending")
  }

  return { user, roles }
}

export async function requireUser() {
  const { user } = await requireCommercialMember()
  return user
}

export async function requireAnyRole(requiredRoles: readonly AppRole[]) {
  const session = await requireCommercialMember()

  if (!hasAnyRole(session.roles, requiredRoles)) {
    redirect("/")
  }

  return session
}

export async function requireRole(role: AppRole) {
  return requireAnyRole([role])
}
