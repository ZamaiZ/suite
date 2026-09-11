import { StepCard } from "@/components/custom/LeadStepShell"
import type { LeadGbpProfile } from "@/lib/leads/gbp"

/**
 * Chips em vez de lista vertical: dezoito serviços em dezoito linhas é o que
 * esticava a coluna direita e desalinhava as alturas da grade.
 */
export function LeadGbpServicesCard({
  profile,
}: {
  profile: LeadGbpProfile
}) {
  const services = profile.enrichment?.services ?? []

  return (
    <StepCard title="Serviços" className="h-full">
      {services.length === 0 ? (
        <p className="text-xs/relaxed text-muted-foreground">
          Nenhum serviço declarado no perfil.
        </p>
      ) : (
        <>
          <p className="mb-2 text-[11px] tabular-nums text-muted-foreground">
            {services.length === 1
              ? "1 declarado"
              : `${services.length.toLocaleString("pt-BR")} declarados`}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {services.map((service, index) => (
              <li
                key={`${service.category ?? ""}:${service.title}:${index}`}
                className="inline-flex h-[22px] items-center rounded-md bg-accent px-2 text-[11px] text-accent-foreground"
              >
                {service.title}
              </li>
            ))}
          </ul>
        </>
      )}
    </StepCard>
  )
}
