"use client"

import {
  RiCheckLine,
  RiErrorWarningLine,
  RiFileExcel2Line,
  RiUserLine,
} from "react-icons/ri"
import { formatPhone } from "@/lib/br-documents"
import { cn } from "cn"
import {
  SPREADSHEET_FIELD_LABELS,
  type SpreadsheetValueKey,
} from "@/lib/leads/spreadsheet-model"
import type {
  ImportIssueItem,
  ImportPreviewRow,
  ImportTotals,
} from "./LeadImport.types"

function fieldLabel(field: string | null): string | null {
  if (!field) return null
  if (field in SPREADSHEET_FIELD_LABELS) {
    return SPREADSHEET_FIELD_LABELS[field as SpreadsheetValueKey]
  }
  return field
}

function BigNumber({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  icon: typeof RiCheckLine
  tone: "success" | "warning" | "muted" | "accent"
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "accent"
          ? "text-primary"
          : "text-muted-foreground"

  return (
    <div className="rounded-lg border border-border/70 bg-popover p-2.5">
      <div className="flex items-center gap-2">
        <Icon size={14} className={color} aria-hidden />
        <div className="min-w-0">
          <p className={cn("text-xl font-semibold tabular-nums", color)}>
            {value}
          </p>
          <p className="text-xs/relaxed text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  )
}

function PreviewSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className="h-7 animate-pulse rounded-md bg-accent motion-reduce:animate-none"
          style={{ animationDelay: `${index * 40}ms` }}
        />
      ))}
    </div>
  )
}

export function LeadImportOverview({
  totals,
  previewRows,
  issues,
  issuesExpanded,
  onToggleIssues,
  analyzing,
}: {
  totals: ImportTotals
  previewRows: ImportPreviewRow[]
  issues: ImportIssueItem[]
  issuesExpanded: boolean
  onToggleIssues: () => void
  analyzing: boolean
}) {
  const visibleIssues = issuesExpanded ? issues : issues.slice(0, 8)

  return (
    <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4">
      <p className="text-xs/relaxed font-semibold text-foreground">
        Visão geral da importação
      </p>
      <div className="grid grid-cols-2 gap-2">
        <BigNumber
          label="Válidos"
          value={analyzing ? "—" : String(totals.valid)}
          icon={RiCheckLine}
          tone="success"
        />
        <BigNumber
          label="Com problemas"
          value={analyzing ? "—" : String(totals.problems)}
          icon={RiErrorWarningLine}
          tone={totals.problems > 0 ? "warning" : "success"}
        />
        <BigNumber
          label="Arquivos"
          value={String(totals.files)}
          icon={RiFileExcel2Line}
          tone="muted"
        />
        <BigNumber
          label="Leads totais"
          value={analyzing ? "—" : String(totals.found)}
          icon={RiUserLine}
          tone="accent"
        />
      </div>

      <div className="flex min-h-0 flex-col gap-2">
        <p className="text-xs/relaxed font-semibold text-foreground">
          Pré-visualização dos leads
        </p>
        {analyzing && previewRows.length === 0 ? (
          <PreviewSkeleton />
        ) : previewRows.length === 0 ? (
          <p className="text-xs/relaxed text-muted-foreground">
            Nenhuma linha válida ainda.
          </p>
        ) : (
          <div className="max-h-56 overflow-auto rounded-lg border border-border">
            <table className="w-full min-w-[32rem] border-collapse text-left">
              <thead className="sticky top-0 bg-popover">
                <tr className="border-b border-border/70">
                  {["Nome", "Site", "Contato", "Telefone", "E-mail"].map(
                    (header) => (
                      <th
                        key={header}
                        className="px-2 py-1.5 text-xs/relaxed font-medium text-muted-foreground"
                      >
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr
                    key={`${row.fileId}-${row.row}`}
                    className="border-b border-border/70 last:border-b-0"
                  >
                    <td className="truncate px-2 py-1.5 text-xs/relaxed text-foreground">
                      {row.company_name}
                    </td>
                    <td className="truncate px-2 py-1.5 text-xs/relaxed text-muted-foreground">
                      {row.website}
                    </td>
                    <td className="truncate px-2 py-1.5 text-xs/relaxed text-foreground">
                      {row.contact_name || "—"}
                    </td>
                    <td className="truncate px-2 py-1.5 text-xs/relaxed tabular-nums text-foreground">
                      {row.phone ? formatPhone(row.phone) : "—"}
                    </td>
                    <td className="truncate px-2 py-1.5 text-xs/relaxed text-foreground">
                      {row.email || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {previewRows.length > 0 ? (
          <p className="text-xs/relaxed text-muted-foreground">
            Primeiras 50 linhas válidas. O restante entra no envio, não na
            tabela.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs/relaxed font-semibold text-foreground">
          Problemas encontrados
        </p>
        {analyzing && issues.length === 0 ? (
          <PreviewSkeleton />
        ) : issues.length === 0 ? (
          <p className="text-xs/relaxed text-muted-foreground">
            Nenhum problema.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {visibleIssues.map((item) => (
              <li
                key={`${item.fileId}-${item.issue.row}-${item.issue.field}-${item.issue.message}`}
                className="flex items-start gap-2"
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    item.issue.kind === "conflict"
                      ? "bg-warning"
                      : "bg-destructive",
                  )}
                />
                <div className="min-w-0">
                  <p className="text-xs/relaxed text-foreground">
                    Linha {item.issue.row}
                    {fieldLabel(item.issue.field)
                      ? ` · ${fieldLabel(item.issue.field)}`
                      : ""}{" "}
                    — {item.issue.message}
                  </p>
                  <p className="truncate text-xs/relaxed text-muted-foreground">
                    {item.fileName}
                    {item.issue.kind === "conflict"
                      ? " · conflito"
                      : " · problema"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {issues.length > 8 ? (
          <button
            type="button"
            onClick={onToggleIssues}
            className="self-start text-xs/relaxed font-medium text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
          >
            {issuesExpanded
              ? "Ver menos"
              : `Ver todos os ${issues.length} problemas`}
          </button>
        ) : null}
      </div>
    </div>
  )
}
