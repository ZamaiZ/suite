"use client"

import {
  RiCheckLine,
  RiExternalLinkLine,
  RiFileList3Line,
  RiLoader4Line,
  RiRefreshLine,
} from "react-icons/ri"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
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
          <h2 className="font-sans text-caption font-semibold text-fg">
            Diagnóstico
          </h2>
          <p className="font-sans text-caption text-fg-muted">
            Compila as quatro etapas em um relatório editável e PDF para a
            reunião.
          </p>
          {stale ? (
            <p className="mt-1 font-sans text-caption text-warning">
              As coletas mudaram — recompile os fatos (o texto editado é
              preservado).
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
        {hasExport ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onOpenPdf}
          >
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
                <RiLoader4Line
                  data-icon="inline-start"
                  aria-hidden
                  className="animate-spin"
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
                  <RiLoader4Line
                    data-icon="inline-start"
                    aria-hidden
                    className="animate-spin"
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
