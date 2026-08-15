import { AuthPageShell } from "@/components/custom/AuthPageShell"
import { CreateUserForm } from "@/components/custom/CreateUserForm"

export function CreateUserPage() {
  return (
    <AuthPageShell
      title="Criar conta"
      description="Preencha os campos abaixo para criar sua conta no sistema."
    >
      <CreateUserForm />
    </AuthPageShell>
  )
}
