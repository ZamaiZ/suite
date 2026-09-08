import type { ClientPortalHomeProps } from "./ClientPortalHome.types"

export function ClientPortalHome({ companyName }: ClientPortalHomeProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs/relaxed font-semibold text-foreground">
        {companyName}
      </p>
      <p className="text-xs/relaxed text-muted-foreground">
        Briefing em breve. Você já está autenticado nesta conta.
      </p>
    </div>
  )
}
