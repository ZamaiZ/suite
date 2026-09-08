"use client"

import {
  RiBarChartBoxLine,
  RiCheckLine,
  RiLoader4Line,
  RiRefreshLine,
} from "react-icons/ri"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import { Button } from "@/components/ui/button"
import { formatRelativeShort } from "@/lib/date-time"
import { visibilitySourceLabel } from "@/lib/leads/visibility-presenters"
import type { VisibilitySource } from "@/lib/leads/visibility-audit"

export function LeadVisibilityStepHeader({
  updatedAt,
  source,
  collecting,
  canEdit,
  onAnalyze,
}: {
  updatedAt: string | null
  source: VisibilitySource | null
  collecting: boolean
  canEdit: boolean
  onAnalyze: () => void
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <LeadIconWell icon={RiBarChartBoxLine} />
        <div className="min-w-0">
          <h2 className="text-xs/relaxed font-semibold text-foreground">
            Visibilidade
          </h2>
          <p className="text-xs/relaxed text-muted-foreground">
            Keywords orgânicas, páginas ranqueadas e veredito comercial.
          </p>
          {source ? (
            <p className="mt-1 text-xs/relaxed text-muted-foreground">
              {visibilitySourceLabel(source)}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {updatedAt ? (
          <span className="inline-flex items-center gap-1 text-xs/relaxed text-muted-foreground">
            <RiCheckLine size={14} aria-hidden className="text-success" />
            Atualizado {formatRelativeShort(updatedAt)}
          </span>
        ) : null}
        {canEdit ? (
          <Button
            type="button"
            variant="secondary"
            disabled={collecting}
            onClick={onAnalyze}
          >
            {collecting ? (
              <RiLoader4Line
                data-icon="inline-start"
                aria-hidden
                className="animate-spin"
              />
            ) : (
              <RiRefreshLine data-icon="inline-start" aria-hidden />
            )}
            {updatedAt ? "Atualizar análise" : "Analisar visibilidade"}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
