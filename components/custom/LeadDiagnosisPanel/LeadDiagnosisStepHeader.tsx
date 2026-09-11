"use client"

import {
  RiCheckLine,
  RiExternalLinkLine,
  RiFileList3Line,
  RiRefreshLine,
} from "react-icons/ri"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { formatRelativeShort } from "@/lib/date-time"

export function LeadDiagnosisStepHeader({
  updatedAt,
  hasExport,
  stale,
  unlocked,
  compiling,
  exporting,
  canEdit,
  onCompile,
  onExport,
  onOpenPdf,
}: {
  updatedAt: string | null
  hasExport: boolean
  stale: boolean
  unlocked: boolean
  compiling: boolean
  exporting: boolean
  canEdit: boolean
  onCompile: () => void
  onExport: () => void
  onOpenPdf: () => void
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <LeadIconWell icon={RiFileList3Line} />
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-semibold text-foreground">
            Diagnóstico
          </h2>
          <p className="text-xs/relaxed text-muted-foreground">
            Compila as cinco etapas em um relatório editável e PDF para a
            reunião.
          </p>
          {stale ? (
            <p className="mt-1 text-xs/relaxed text-warning">
              As coletas mudaram — recompile os fatos (o texto editado é
              preservado).
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
        {hasExport ? (
          <Button type="button" variant="ghost" onClick={onOpenPdf}>
            <RiExternalLinkLine data-icon="inline-start" aria-hidden />
            Abrir PDF
          </Button>
        ) : null}
        {canEdit && unlocked ? (
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={compiling || exporting}
              onClick={onCompile}
            >
              {compiling ? (
                <Spinner
                  data-icon="inline-start"
                  aria-hidden
                  className="size-3.5"
                />
              ) : (
                <RiRefreshLine data-icon="inline-start" aria-hidden />
              )}
              {updatedAt ? "Recompilar fatos" : "Montar diagnóstico"}
            </Button>
            {updatedAt ? (
              <Button
                type="button"
                disabled={compiling || exporting}
                onClick={onExport}
              >
                {exporting ? (
                  <Spinner
                    data-icon="inline-start"
                    aria-hidden
                    className="size-3.5"
                  />
                ) : null}
                Exportar PDF
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
