"use client"

import { useMemo, useRef, useState } from "react"
import { formatPhone } from "@/lib/br-documents"
import { cn } from "@/lib/cn"
import {
  SPREADSHEET_FIELD_LABELS,
  SPREADSHEET_VALUE_KEYS,
  type SpreadsheetValueKey,
} from "@/lib/leads/spreadsheet-model"
import type { SpreadsheetEvaluatedRow } from "@/lib/leads/types"

const ROW_HEIGHT = 34
const HEADER_HEIGHT = 34
const OVERSCAN = 8
const VIRTUALIZE_AFTER = 100
const COLUMN_COUNT = SPREADSHEET_VALUE_KEYS.length + 1

function fieldIssueKind(
  row: SpreadsheetEvaluatedRow,
  field: SpreadsheetValueKey,
) {
  const matches = row.issues.filter((issue) => issue.field === field)
  if (matches.some((issue) => issue.kind === "problem")) return "problem"
  if (matches.some((issue) => issue.kind === "conflict")) return "conflict"
  return null
}

export function LeadImportEditGrid({
  fileName,
  rows,
  pending,
  onChange,
  onBlurRow,
}: {
  fileName: string
  rows: SpreadsheetEvaluatedRow[]
  pending: boolean
  onChange: (row: number, field: SpreadsheetValueKey, value: string) => void
  onBlurRow: (row: number) => void
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const virtualize = rows.length > VIRTUALIZE_AFTER

  const { start, end, padTop, padBottom } = useMemo(() => {
    if (!virtualize) {
      return { start: 0, end: rows.length, padTop: 0, padBottom: 0 }
    }
    const viewport = scrollerRef.current?.clientHeight ?? 320
    const visible = Math.ceil((viewport - HEADER_HEIGHT) / ROW_HEIGHT)
    const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
    const last = Math.min(rows.length, first + visible + OVERSCAN * 2)
    return {
      start: first,
      end: last,
      padTop: first * ROW_HEIGHT,
      padBottom: (rows.length - last) * ROW_HEIGHT,
    }
  }, [rows.length, scrollTop, virtualize])

  const slice = rows.slice(start, end)
  const problemCount = rows.filter((row) => row.issues.length > 0).length

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      <div>
        <p className="font-sans text-body-sm font-semibold text-fg">
          Editando {fileName}
        </p>
        <p className="mt-1 font-sans text-caption text-fg-muted">
          Células marcadas precisam ser corrigidas. Reavaliar consulta o CRM de
          novo e volta à visão geral.
        </p>
        {problemCount > 0 ? (
          <p className="mt-1 font-sans text-caption text-warning">
            {problemCount} {problemCount === 1 ? "linha" : "linhas"} com problema
            ou conflito.
          </p>
        ) : (
          <p className="mt-1 font-sans text-caption text-success">
            Nenhuma linha marcada. Reavalie para confirmar.
          </p>
        )}
      </div>
      <div
        ref={scrollerRef}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        className="min-h-0 flex-1 overflow-auto rounded-lg border border-border"
      >
        <table className="w-full min-w-[80rem] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-elevated">
            <tr className="border-b border-border-subtle">
              <th className="w-14 px-2 py-1.5 font-sans text-caption font-medium text-fg-muted">
                Linha
              </th>
              {SPREADSHEET_VALUE_KEYS.map((key) => (
                <th
                  key={key}
                  className="px-2 py-1.5 font-sans text-caption font-medium text-fg-muted"
                >
                  {SPREADSHEET_FIELD_LABELS[key]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {padTop > 0 ? (
              <tr>
                <td colSpan={COLUMN_COUNT} style={{ height: padTop }} />
              </tr>
            ) : null}
            {slice.map((row) => (
              <tr
                key={row.row}
                className="border-b border-border-subtle last:border-b-0"
              >
                <td className="px-2 py-1 font-sans text-caption tabular-nums text-fg-muted">
                  {row.row}
                </td>
                {SPREADSHEET_VALUE_KEYS.map((key) => {
                  const kind = fieldIssueKind(row, key)
                  const isPhone = key === "phone"
                  return (
                    <td key={key} className="px-1 py-0.5">
                      <input
                        value={
                          isPhone
                            ? formatPhone(row.values[key])
                            : row.values[key]
                        }
                        disabled={pending}
                        inputMode={isPhone ? "tel" : undefined}
                        autoComplete={isPhone ? "tel" : undefined}
                        onChange={(event) =>
                          onChange(
                            row.row,
                            key,
                            isPhone
                              ? formatPhone(event.target.value)
                              : event.target.value,
                          )
                        }
                        onBlur={() => onBlurRow(row.row)}
                        aria-invalid={kind !== null}
                        className={cn(
                          "h-8 w-full rounded-md border bg-transparent px-2",
                          "font-sans text-caption text-fg outline-none",
                          "transition-[border-color,background-color] duration-150 ease-out",
                          "focus:bg-hover",
                          kind === "problem" && "border-danger",
                          kind === "conflict" && "border-warning",
                          !kind && "border-transparent",
                        )}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
            {padBottom > 0 ? (
              <tr>
                <td colSpan={COLUMN_COUNT} style={{ height: padBottom }} />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
