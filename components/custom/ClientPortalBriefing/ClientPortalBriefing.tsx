"use client"

import { useCallback, useState } from "react"
import { ClientBriefingWorkspace } from "@/components/custom/ClientBriefingWorkspace"
import type { BriefingWorkspacePhase } from "@/components/custom/ClientBriefingWorkspace"
import { ClientPortalShell } from "@/components/custom/ClientPortalShell"

export function ClientPortalBriefing({ companyName }: { companyName: string }) {
  const [phase, setPhase] = useState<BriefingWorkspacePhase>("wizard")

  const onPhaseChange = useCallback((next: BriefingWorkspacePhase) => {
    setPhase(next)
  }, [])

  const description =
    phase === "complete"
      ? "Briefing enviado"
      : phase === "editing"
        ? "Você pode revisar e ajustar as respostas."
        : "Preencha com calma. Tudo é salvo automaticamente."

  return (
    <ClientPortalShell
      variant="workspace"
      title="Briefing inicial"
      description={description}
    >
      <ClientBriefingWorkspace
        companyName={companyName}
        onPhaseChange={onPhaseChange}
      />
    </ClientPortalShell>
  )
}
