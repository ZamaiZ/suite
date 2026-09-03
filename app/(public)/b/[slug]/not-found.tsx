import { ClientPortalShell } from "@/components/custom/ClientPortalShell"

export default function ClientPortalNotFound() {
  return (
    <ClientPortalShell
      title="Link inválido"
      description="Este acesso não existe ou não está mais disponível."
    >
      <p className="font-sans text-body-sm text-fg-secondary">
        Confira o endereço que você recebeu ou peça um novo link.
      </p>
    </ClientPortalShell>
  )
}
