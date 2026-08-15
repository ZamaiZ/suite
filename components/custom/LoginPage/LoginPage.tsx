import { AuthPageShell } from "@/components/custom/AuthPageShell"
import { LoginForm } from "@/components/custom/LoginForm"

export function LoginPage() {
  return (
    <AuthPageShell
      title="Entrar"
      description="Acesse sua conta para continuar."
    >
      <LoginForm />
    </AuthPageShell>
  )
}
