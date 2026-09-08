"use client"

import {
  RiCheckLine,
  RiExternalLinkLine,
  RiLoader4Line,
  RiMapPin2Line,
  RiRefreshLine,
} from "react-icons/ri"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import { Button } from "@/components/ui/button"
import { formatRelativeShort } from "@/lib/date-time"

export function LeadGbpStepHeader({
  updatedAt,
  mapsHref,
  collecting,
  canEdit,
  onEnrich,
}: {
  updatedAt: string | null
  mapsHref: string | null
  collecting: boolean
  canEdit: boolean
  onEnrich: () => void
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <LeadIconWell icon={RiMapPin2Line} />
        <div className="min-w-0">
          <h2 className="text-xs/relaxed font-semibold text-foreground">
            Perfil no Google
          </h2>
          <p className="text-xs/relaxed text-muted-foreground">
            Presença, reputação e posicionamento local da empresa.
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
            onClick={onEnrich}
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
            Atualizar coleta
          </Button>
        ) : null}
        {mapsHref ? (
          <Button
            type="button"
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
            onClick={() =>
              window.open(mapsHref, "_blank", "noopener,noreferrer")
            }
          >
            Ver no Google
            <RiExternalLinkLine data-icon="inline-end" aria-hidden />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
