"use client"

import {
  RiBarChartBoxLine,
  RiCheckLine,
  RiExternalLinkLine,
  RiRefreshLine,
} from "react-icons/ri"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { formatRelativeShort } from "@/lib/date-time"

export function LeadVisibilityStepHeader({
  updatedAt,
  costUsd,
  siteHref,
  collecting,
  canEdit,
  readingMode,
  hasDomain,
  onAnalyze,
}: {
  updatedAt: string | null
  /** Custo real da última coleta. `null` em snapshot antigo, que o descartava. */
  costUsd: number | null
  siteHref: string | null
  collecting: boolean
  canEdit: boolean
  /** Modo reunião: esconde edição. Nunca habilita nada. */
  readingMode: boolean
  hasDomain: boolean
  onAnalyze: () => void
}) {
  const showActions = canEdit && !readingMode

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <LeadIconWell icon={RiBarChartBoxLine} />
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-semibold text-foreground">
            Visibilidade
          </h2>
          <p className="text-xs/relaxed text-muted-foreground">
            Keywords orgânicas, páginas ranqueadas e veredito comercial.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {updatedAt ? (
          <span className="inline-flex items-center gap-1 text-xs/relaxed text-muted-foreground">
            <RiCheckLine size={14} aria-hidden className="text-success" />
            Coletado {formatRelativeShort(updatedAt)}
          </span>
        ) : null}
        {/*
          O custo real da coleta, lido da resposta da API. Fica ao lado da data
          porque é a mesma informação — o que aquele clique custou — e porque a
          etapa é a mais cara do fluxo: duas chamadas pagas por análise.
        */}
        {costUsd !== null ? (
          <span className="text-xs/relaxed text-muted-foreground tabular-nums">
            US$ {costUsd.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
          </span>
        ) : null}
        {showActions ? (
          <Button
            type="button"
            variant="secondary"
            disabled={collecting || !hasDomain}
            onClick={onAnalyze}
          >
            {collecting ? (
              <Spinner
                data-icon="inline-start"
                aria-hidden
                className="size-3.5"
              />
            ) : (
              <RiRefreshLine data-icon="inline-start" aria-hidden />
            )}
            {updatedAt ? "Atualizar análise" : "Analisar visibilidade"}
          </Button>
        ) : null}
        {siteHref && !readingMode ? (
          <Button
            type="button"
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
            onClick={() =>
              window.open(siteHref, "_blank", "noopener,noreferrer")
            }
          >
            Abrir site
            <RiExternalLinkLine data-icon="inline-end" aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
