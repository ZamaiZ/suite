"use client"

import {
  RiCheckLine,
  RiExternalLinkLine,
  RiGlobalLine,
  RiLoader4Line,
  RiRefreshLine,
} from "react-icons/ri"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import { Button } from "@/components/ui/Button"
import { formatRelativeShort } from "@/lib/date-time"

export function LeadWebsiteStepHeader({
  updatedAt,
  siteHref,
  collecting,
  canEdit,
  onAnalyze,
}: {
  updatedAt: string | null
  siteHref: string | null
  collecting: boolean
  canEdit: boolean
  onAnalyze: () => void
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <LeadIconWell icon={RiGlobalLine} />
        <div className="min-w-0">
          <h2 className="font-sans text-caption font-semibold text-fg">
            Website
          </h2>
          <p className="font-sans text-caption text-fg-muted">
            Estrutura, SEO on-page e conversão do site.
          </p>
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
            {updatedAt ? "Atualizar coleta" : "Analisar site"}
          </Button>
        ) : null}
        {siteHref ? (
          <Button
            type="button"
            variant="outline"
            className="border-accent/30 text-accent hover:bg-accent/10"
            trailingIcon={<RiExternalLinkLine size={14} aria-hidden />}
            onClick={() =>
              window.open(siteHref, "_blank", "noopener,noreferrer")
            }
          >
            Abrir site
          </Button>
        ) : null}
      </div>
    </div>
  )
}
