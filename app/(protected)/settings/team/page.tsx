import {
  hasRole,
  isAppRole,
  sortAppRoles,
} from "@/lib/auth/roles"
import { requireCommercialMember } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import {
  TeamRoleManager,
  type TeamMember,
} from "@/components/custom/TeamRoleManager"

type UserProfileRow = {
  id: string
  name: string
  email: string
}

type UserRoleRow = {
  user_id: string
  role: unknown
}

export default async function TeamSettingsPage() {
  const { user: currentUser, roles: currentUserRoles } =
    await requireCommercialMember()
  const supabase = await createClient()
  const [profilesResult, rolesResult] = await Promise.all([
    supabase.from("users").select("id, name, email").order("name"),
    supabase.from("user_roles").select("user_id, role"),
  ])

  if (profilesResult.error) {
    throw new Error("Unable to load team profiles.", {
      cause: profilesResult.error,
    })
  }

  if (rolesResult.error) {
    throw new Error("Unable to load team roles.", {
      cause: rolesResult.error,
    })
  }

  const rolesByUser = new Map<string, TeamMember["roles"]>()
  for (const entry of (rolesResult.data ?? []) as UserRoleRow[]) {
    if (!isAppRole(entry.role)) continue
    const roles = rolesByUser.get(entry.user_id) ?? []
    roles.push(entry.role)
    rolesByUser.set(entry.user_id, roles)
  }

  const members: TeamMember[] = (
    (profilesResult.data ?? []) as UserProfileRow[]
  ).map((profile) => ({
    id: profile.id,
    name: profile.name,
    email: profile.email,
    roles: sortAppRoles(rolesByUser.get(profile.id) ?? []),
  }))
  const currentUserIsAdmin = hasRole(currentUserRoles, "admin")

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <TeamRoleManager
        members={members}
        currentUserId={currentUser.id}
        currentUserIsAdmin={currentUserIsAdmin}
      />
    </div>
  )
}
