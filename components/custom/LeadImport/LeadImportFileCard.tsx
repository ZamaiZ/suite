"use client"

import { Menu } from "@base-ui/react/menu"
import {
  RiDeleteBinLine,
  RiEditLine,
  RiFileExcel2Line,
  RiLoader4Line,
  RiMore2Line,
} from "react-icons/ri"
import { cn } from "@/lib/cn"
import { formatDateTimeShort } from "@/lib/date-time"
import { summarizeEvaluatedRows } from "@/lib/leads/spreadsheet-model"
import type { ImportFileEntry } from "./LeadImport.types"

const MENU_ITEM = cn(
  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5",
  "font-sans text-body-sm text-fg outline-none",
  "data-highlighted:bg-hover",
  "data-disabled:pointer-events-none data-disabled:opacity-50",
)

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
      <p className="font-sans text-caption text-fg-muted">{label}</p>
      <p
        className={cn(
          "font-sans text-body-sm font-semibold tabular-nums",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          !tone && "text-fg",
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
    ? "bg-danger"
    : ready && summary.problems > 0
      ? "bg-warning"
      : ready
        ? "bg-success"
        : "bg-accent"

  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-elevated",
      )}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span
          aria-hidden
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-md",
            failed
              ? "bg-danger/10 text-danger"
              : analyzing || queued
                ? "bg-hover text-accent"
                : "bg-success/10 text-success",
          )}
        >
          {analyzing || queued ? (
            <RiLoader4Line size={16} className="animate-spin" />
          ) : (
            <RiFileExcel2Line size={16} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-sans text-body-sm font-semibold text-fg">
            {entry.name}
          </p>
          <p className="font-sans text-caption text-fg-muted">
            Enviado {formatDateTimeShort(entry.uploadedAt)}
          </p>
        </div>
        {queued ? (
          <p className="min-w-32 font-sans text-caption font-medium text-fg-muted">
            Na fila
          </p>
        ) : null}
        {analyzing ? (
          <div className="min-w-40 max-w-56 flex-1">
            <p className="font-sans text-caption font-medium text-fg">
              Analisando… {entry.stageLabel}
            </p>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-hover">
              <div
                className="h-full origin-left rounded-full bg-accent transition-transform duration-200 ease-linear motion-reduce:transition-none"
                style={{ transform: `scaleX(${Math.max(entry.progress, 4) / 100})` }}
              />
            </div>
          </div>
        ) : null}
        {failed ? (
          <p className="max-w-56 font-sans text-caption text-danger">
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
                "inline-flex items-center gap-1.5 rounded-full bg-hover px-2 py-0.5",
                "font-sans text-caption font-semibold",
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
        <Menu.Root>
          <Menu.Trigger
            aria-label={`Ações de ${entry.name}`}
            className={cn(
              "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md",
              "text-fg-muted transition-[background-color,color,transform] duration-150 ease-out",
              "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-active-bg",
              "[@media(hover:hover)_and_(pointer:fine)]:hover:text-fg",
              "data-popup-open:bg-active-bg data-popup-open:text-fg",
              "active:scale-[0.97]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            )}
          >
            <RiMore2Line size={16} aria-hidden />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner className="z-50 outline-none" sideOffset={4} align="end">
              <Menu.Popup
                className={cn(
                  "pointer-events-auto min-w-40 rounded-md border border-popover-border bg-popover p-1 shadow-raised",
                  "origin-[var(--transform-origin)]",
                  "transition-[transform,opacity] duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
                  "data-starting-style:opacity-0 data-starting-style:scale-[0.96]",
                  "data-ending-style:opacity-0 data-ending-style:scale-[0.96] data-ending-style:duration-[140ms]",
                  "motion-reduce:transition-opacity motion-reduce:duration-150",
                  "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
                )}
              >
                <Menu.Item
                  disabled={!ready}
                  onClick={onEdit}
                  className={MENU_ITEM}
                >
                  <RiEditLine size={16} aria-hidden />
                  Editar
                </Menu.Item>
                <Menu.Item onClick={onRemove} className={MENU_ITEM}>
                  <RiDeleteBinLine size={16} aria-hidden />
                  Remover
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
      <div className={cn("h-0.5", barTone)} />
    </article>
  )
}
