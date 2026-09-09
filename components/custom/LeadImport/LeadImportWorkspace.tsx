"use client"

import { RiDownloadLine, RiFileExcel2Line } from "react-icons/ri"
import Link from "next/link"
import { LeadImportDropzone } from "./LeadImportDropzone"
import { LeadImportFileCard } from "./LeadImportFileCard"
import type { ImportFileEntry, ImportTotals } from "./LeadImport.types"
import { Button } from "@/components/ui/button"

export function LeadImportWorkspace({
  files,
  totals,
  notice,
  dropDisabled,
  onFiles,
  onEdit,
  onRemove,
}: {
  files: ImportFileEntry[]
  totals: ImportTotals
  notice: string | null
  dropDisabled: boolean
  onFiles: (files: File[]) => void
  onEdit: (id: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-primary/5 px-3 py-2.5">
        <span
          aria-hidden
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-accent text-primary"
        >
          <RiFileExcel2Line size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs/relaxed font-semibold text-foreground">
            Modelo oficial
          </p>
          <p className="text-xs/relaxed text-muted-foreground">
            Use o modelo para garantir as 7 colunas. Sem isso a análise recusa o
            arquivo.
          </p>
        </div>
        <Button
          variant="outline"
          className="shrink-0 px-4 font-semibold"
          render={<Link href="/leads/template" />}
        >
          <RiDownloadLine data-icon="inline-start" aria-hidden />
          Baixar template
        </Button>
      </div>

      <LeadImportDropzone disabled={dropDisabled} onFiles={onFiles} />

      {notice ? (
        <p role="status" className="text-xs/relaxed text-warning">
          {notice}
        </p>
      ) : null}

      {files.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs/relaxed font-semibold text-foreground">
            Arquivos enviados
          </p>
          {files.map((entry) => (
            <LeadImportFileCard
              key={entry.id}
              entry={entry}
              onEdit={() => onEdit(entry.id)}
              onRemove={() => onRemove(entry.id)}
            />
          ))}
        </div>
      ) : null}

      {files.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs/relaxed font-semibold text-foreground">
            Resumo da importação
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryStat label="Arquivos" value={totals.files} />
            <SummaryStat label="Linhas encontradas" value={totals.found} />
            <SummaryStat label="Válidos" value={totals.valid} tone="success" />
            <SummaryStat
              label="Com problemas"
              value={totals.problems}
              tone={totals.problems > 0 ? "warning" : "success"}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: "success" | "warning"
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-popover px-3 py-2">
      <p className="text-xs/relaxed text-muted-foreground">{label}</p>
      <p
        className={
          tone === "success"
            ? "text-xl font-semibold tabular-nums text-success"
            : tone === "warning"
              ? "text-xl font-semibold tabular-nums text-warning"
              : "text-xl font-semibold tabular-nums text-foreground"
        }
      >
        {value}
      </p>
    </div>
  )
}
