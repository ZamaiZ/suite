"use client"

import {
  RiDeleteBinLine,
  RiEditLine,
  RiFileExcel2Line,
  RiMore2Line,
} from "react-icons/ri"
import { cn } from "cn"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatDateTimeShort } from "@/lib/date-time"
import { summarizeEvaluatedRows } from "@/lib/leads/spreadsheet-model"
import type { ImportFileEntry } from "./LeadImport.types"

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: "success" | "warning"
}) {
  return (
    <div className="min-w-12">
      <p className="text-xs/relaxed text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-xs/relaxed font-semibold tabular-nums",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          !tone && "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  )
}

export function LeadImportFileCard({
  entry,
  onEdit,
  onRemove,
}: {
  entry: ImportFileEntry
  onEdit: () => void
  onRemove: () => void
}) {
  const analyzing = entry.status === "analyzing"
  const queued = entry.status === "queued"
  const failed = entry.status === "failed"
  const ready = entry.status === "ready"
  const summary = summarizeEvaluatedRows(entry.rows)
  const barTone = failed
    ? "bg-destructive"
    : ready && summary.problems > 0
      ? "bg-warning"
      : ready
        ? "bg-success"
        : "bg-primary"

  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-popover",
      )}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span
          aria-hidden
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-md",
            failed
              ? "bg-destructive/10 text-destructive"
              : analyzing || queued
                ? "bg-accent text-primary"
                : "bg-success/10 text-success",
          )}
        >
          {analyzing || queued ? (
            <Spinner className="size-4" />
          ) : (
            <RiFileExcel2Line size={16} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs/relaxed font-semibold text-foreground">
            {entry.name}
          </p>
          <p className="text-xs/relaxed text-muted-foreground">
            Enviado {formatDateTimeShort(entry.uploadedAt)}
          </p>
        </div>
        {queued ? (
          <p className="min-w-32 text-xs/relaxed font-medium text-muted-foreground">
            Na fila
          </p>
        ) : null}
        {analyzing ? (
          <div className="min-w-40 max-w-56 flex-1">
            <p className="text-xs/relaxed font-medium text-foreground">
              Analisando… {entry.stageLabel}
            </p>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-accent">
              <div
                className="h-full origin-left rounded-full bg-primary transition-transform duration-200 ease-linear motion-reduce:transition-none"
                style={{
                  transform: `scaleX(${Math.max(entry.progress, 4) / 100})`,
                }}
              />
            </div>
          </div>
        ) : null}
        {failed ? (
          <p className="max-w-56 text-xs/relaxed text-destructive">
            {entry.failureMessage}
          </p>
        ) : null}
        {ready ? (
          <div className="hidden items-center gap-4 sm:flex">
            <Metric label="Encontrados" value={summary.found} />
            <Metric label="Válidos" value={summary.valid} tone="success" />
            <Metric
              label="Com problemas"
              value={summary.problems}
              tone={summary.problems > 0 ? "warning" : "success"}
            />
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full bg-accent px-2 py-0.5",
                "text-xs/relaxed font-semibold",
                summary.problems > 0 ? "text-warning" : "text-success",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  summary.problems > 0 ? "bg-warning" : "bg-success",
                )}
              />
              {summary.problems > 0 ? "Com problemas" : "Concluído"}
            </span>
          </div>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon" />}
            aria-label={`Ações de ${entry.name}`}
          >
            <RiMore2Line size={16} aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            <DropdownMenuItem disabled={!ready} onClick={onEdit}>
              <RiEditLine size={16} aria-hidden />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRemove} variant="destructive">
              <RiDeleteBinLine size={16} aria-hidden />
              Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className={cn("h-0.5", barTone)} />
    </article>
  )
}
