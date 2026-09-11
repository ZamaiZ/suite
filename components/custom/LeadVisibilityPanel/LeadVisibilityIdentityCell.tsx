"use client"

import { RiGlobalLine, RiHistoryLine } from "react-icons/ri"
import { Badge } from "@/components/ui/badge"
import { VISIBILITY_STALE_SERP_DAYS } from "@/lib/leads/visibility-audit"
import { visibilitySourceLabel } from "@/lib/leads/visibility-presenters"
import type { VisibilityController } from "./use-visibility-controller"

/**
 * Primeira célula da faixa do cabeçalho: quem é o domínio, de onde vem o dado e
 * **de quando ele é**.
 *
 * A terceira badge é a que muda a conversa com o cliente e não existia em lugar
 * nenhum da tela: a posição exibida tem, na medição de 2026-09-10, mediana de
 * 59 dias. O cabeçalho carimbava a hora do clique como se fosse a hora da
 * medida, e é daí que vinha a maior parte da divergência contra outras
 * ferramentas — cada vendor reindexa num ciclo próprio.
 */
export function LeadVisibilityIdentityCell({
  controller,
}: {
  controller: VisibilityController
}) {
  const { domain, snapshot } = controller
  const indexAge = snapshot?.indexAge ?? null
  const stale =
    indexAge !== null && indexAge.serpMedianDays > VISIBILITY_STALE_SERP_DAYS

  return (
    <div className="flex min-w-0 flex-col justify-center gap-2 rounded-lg bg-accent/60 px-3 py-2.5 ring-1 ring-foreground/[0.06]">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <RiGlobalLine size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs/[1.5] font-semibold text-foreground">
            {domain ?? "Sem site cadastrado"}
          </p>
          <p className="truncate text-xs/[1.5] text-muted-foreground">
            {snapshot
              ? `${snapshot.locationLabel} · ${snapshot.languageCode}`
              : "Sem coleta"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {snapshot ? (
          <>
            <Badge variant="muted">
              {visibilitySourceLabel(snapshot.source)}
            </Badge>
            {indexAge ? (
              <Badge variant={stale ? "warning" : "muted"}>
                <RiHistoryLine size={12} aria-hidden />
                Índice de ~{indexAge.serpMedianDays} dias
              </Badge>
            ) : null}
            {snapshot.version === 1 ? (
              /* Fronteira de formato: o snapshot antigo não tem host, idade nem
                 cobertura, e as leituras novas aparecem vazias. Dizer isso é
                 mais honesto que deixar o analista achar que a coleta falhou. */
              <Badge variant="muted">Coleta em formato antigo</Badge>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
