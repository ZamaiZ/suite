"use client"

import {
  RiCheckLine,
  RiExternalLinkLine,
  RiGlobalLine,
  RiRefreshLine,
} from "react-icons/ri"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
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
          <h2 className="font-heading text-sm font-semibold text-foreground">
            Website
          </h2>
          <p className="text-xs/relaxed text-muted-foreground">
            Estrutura, SEO on-page e conversão do site.
          </p>
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
              <Spinner
                data-icon="inline-start"
                aria-hidden
                className="size-3.5"
              />
            ) : (
              <RiRefreshLine data-icon="inline-start" aria-hidden />
            )}
            {updatedAt ? "Atualizar coleta" : "Analisar site"}
          </Button>
        ) : null}
        {siteHref ? (
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
