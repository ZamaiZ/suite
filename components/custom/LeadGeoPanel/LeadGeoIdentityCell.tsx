"use client"

import { RiGlobalLine, RiHistoryLine } from "react-icons/ri"
import { Badge } from "@/components/ui/badge"
import type { GeoController } from "./use-geo-controller"

/**
 * Primeira célula da faixa: quem é o domínio e **de onde veio o dado**.
 *
 * A segunda badge é a que muda a conversa: esta etapa não coleta nada por conta
 * própria, ela reprojeta o crawl do Website. Quando esse crawl é anterior à
 * coleta ampliada, metade dos checks não foi medida — e a tela precisa dizer
 * isso antes que alguém leia ausência como problema do lead.
 */
export function LeadGeoIdentityCell({
  controller,
}: {
  controller: GeoController
}) {
  const { domain, snapshot } = controller
  const extended = snapshot?.sources.websiteCrawlExtended ?? false

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
            {snapshot ? "Lido do crawl do Website" : "Sem análise"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {snapshot ? (
          <>
            <Badge variant="muted">
              {snapshot.accessibility.serverRenderedWords} palavras no HTML
            </Badge>
            {extended ? null : (
              /* Crawl anterior à coleta ampliada: llms.txt, robôs de IA e
                 headings não existem nele. Sem esta badge, o analista lê os
                 `—` da aba de Acesso como falha da tela. */
              <Badge variant="warning">
                <RiHistoryLine size={12} aria-hidden />
                Crawl antigo: recolete o Website
              </Badge>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
