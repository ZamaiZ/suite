import { redirect } from "next/navigation"
import { logout } from "@/app/actions/logout"
import {
  getCurrentUserRoles,
  requireAuthenticatedUser,
} from "@/lib/auth/session"
import { isCommercialMember } from "@/lib/auth/roles"
import { AuthPageShell } from "@/components/custom/AuthPageShell"
import { Button } from "@/components/ui/button"

export default async function AccessPendingPage() {
  await requireAuthenticatedUser()
  const roles = await getCurrentUserRoles()

  if (isCommercialMember(roles)) {
    redirect("/")
  }

  return (
    <AuthPageShell
      title="Acesso pendente"
      description="Sua conta foi criada, mas ainda não possui um papel."
    >
      <div className="flex flex-col gap-4">
        <p className="font-sans text-body-sm text-fg-secondary">
          Solicite a um administrador a liberação do seu acesso.
        </p>
        <form action={logout}>
          <Button type="submit" variant="secondary" className="w-full">
            Sair
          </Button>
        </form>
      </div>
    </AuthPageShell>
  )
}
