"use client"

import {
  RiCheckLine,
  RiExternalLinkLine,
  RiChatQuoteLine,
  RiRefreshLine,
  RiRobot2Line,
  RiSparkling2Line,
} from "react-icons/ri"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { formatRelativeShort } from "@/lib/date-time"

export function LeadGeoStepHeader({
  updatedAt,
  websiteAuditAt,
  siteHref,
  collecting,
  canEdit,
  readingMode,
  hasDomain,
  hasWebsiteAudit,
  onAnalyze,
  hasMentions,
  mentionsBusy,
  hasBacklinkAudit,
  onCollectMentions,
  hasProbe,
  probeBusy,
  probeRuns,
  onProbe,
}: {
  updatedAt: string | null
  /**
   * Duas datas, e a diferença entre elas é o dado.
   *
   * Esta etapa não coleta: ela reprojeta o crawl do Website. Carimbar só a hora
   * do clique repetiria o defeito que a onda 0 da visibilidade encontrou —
   * apresentar índice de dois meses atrás como coleta de hoje.
   */
  websiteAuditAt: string | null
  siteHref: string | null
  collecting: boolean
  canEdit: boolean
  /** Modo reunião: esconde edição. Nunca habilita nada. */
  readingMode: boolean
  hasDomain: boolean
  hasWebsiteAudit: boolean
  onAnalyze: () => void
  /** Já há menções coletadas neste snapshot. */
  hasMentions: boolean
  mentionsBusy: boolean
  /**
   * `multi_target_metrics` recusa um alvo só, e o lead sozinho é um alvo só.
   * Sem concorrente não há comparação a fazer nem chamada a pagar.
   */
  hasBacklinkAudit: boolean
  onCollectMentions: () => void
  /** Já há sondagem neste snapshot. */
  hasProbe: boolean
  probeBusy: boolean
  /** Quantas execuções a próxima sondagem dispara. Vai no rótulo do botão. */
  probeRuns: number
  onProbe: () => void
}) {
  const showActions = canEdit && !readingMode

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <LeadIconWell icon={RiSparkling2Line} />
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-semibold text-foreground">
            Presença em IA
          </h2>
          <p className="text-xs/relaxed text-muted-foreground">
            O que as IAs conseguem ler, entender e citar deste negócio.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {updatedAt ? (
          <span className="inline-flex items-center gap-1 text-xs/relaxed text-muted-foreground">
            <RiCheckLine size={14} aria-hidden className="text-success" />
            Analisado {formatRelativeShort(updatedAt)}
          </span>
        ) : null}
        {websiteAuditAt ? (
          <span className="text-xs/relaxed text-muted-foreground">
            sobre crawl de {formatRelativeShort(websiteAuditAt)}
          </span>
        ) : null}
        {showActions ? (
          <Button
            type="button"
            variant="secondary"
            disabled={collecting || !hasDomain || !hasWebsiteAudit}
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
            {updatedAt ? "Atualizar análise" : "Analisar presença em IA"}
          </Button>
        ) : null}
        {/* Botão próprio porque custa: US$ 0,10 a chamada, contra US$ 0,021 da
            análise. O padrão é o da malha geográfica — a coleta que gasta nunca
            se esconde dentro da que não gasta. */}
        {showActions && updatedAt ? (
          <Button
            type="button"
            variant="outline"
            disabled={mentionsBusy || !hasBacklinkAudit}
            onClick={onCollectMentions}
          >
            {mentionsBusy ? (
              <Spinner
                data-icon="inline-start"
                aria-hidden
                className="size-3.5"
              />
            ) : (
              <RiChatQuoteLine data-icon="inline-start" aria-hidden />
            )}
            {hasMentions ? "Atualizar menções" : "Coletar menções em IA"}
          </Button>
        ) : null}
        {/* A conta aparece no rótulo, antes do clique. É a coleta mais cara da
            etapa, e quem paga precisa ver o tamanho dela sem abrir a aba. */}
        {showActions && updatedAt ? (
          <Button
            type="button"
            variant="outline"
            disabled={probeBusy || probeRuns === 0}
            onClick={onProbe}
          >
            {probeBusy ? (
              <Spinner
                data-icon="inline-start"
                aria-hidden
                className="size-3.5"
              />
            ) : (
              <RiRobot2Line data-icon="inline-start" aria-hidden />
            )}
            {hasProbe
              ? "Sondar de novo"
              : `Sondar as IAs · ${probeRuns} respostas`}
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
