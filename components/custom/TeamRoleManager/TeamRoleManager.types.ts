import type { AppRole } from "@/lib/auth/roles"

export type TeamMember = {
  id: string
  name: string
  email: string
  roles: AppRole[]
}

export type TeamRoleManagerProps = {
  members: TeamMember[]
  currentUserId: string
  currentUserIsAdmin: boolean
}
