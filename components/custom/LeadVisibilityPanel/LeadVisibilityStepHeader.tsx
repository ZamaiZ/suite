"use client"

import {
  RiBarChartBoxLine,
  RiCheckLine,
  RiLoader4Line,
  RiRefreshLine,
} from "react-icons/ri"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import { Button } from "@/components/ui/Button"
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
          <h2 className="font-sans text-caption font-semibold text-fg">
            Visibilidade
          </h2>
          <p className="font-sans text-caption text-fg-muted">
            Keywords orgânicas, páginas ranqueadas e veredito comercial.
          </p>
          {source ? (
            <p className="mt-1 font-sans text-caption text-fg-secondary">
              {visibilitySourceLabel(source)}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {updatedAt ? (
          <span className="inline-flex items-center gap-1 font-sans text-caption text-fg-muted">
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
            leadingIcon={
              collecting ? (
                <RiLoader4Line size={16} aria-hidden className="animate-spin" />
              ) : (
                <RiRefreshLine size={16} aria-hidden />
              )
            }
          >
            {updatedAt ? "Atualizar análise" : "Analisar visibilidade"}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
