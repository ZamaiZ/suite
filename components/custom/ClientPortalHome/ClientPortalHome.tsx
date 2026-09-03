import type { ClientPortalHomeProps } from "./ClientPortalHome.types"

export function ClientPortalHome({ companyName }: ClientPortalHomeProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-sans text-body-sm font-semibold text-fg">{companyName}</p>
      <p className="font-sans text-body-sm text-fg-secondary">
        Briefing em breve. Você já está autenticado nesta conta.
      </p>
    </div>
  )
}
