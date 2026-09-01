"use client"

import { useState } from "react"
import { LeadDetailDialog } from "@/components/custom/LeadDetailDialog"
import { getLeadInitials } from "@/components/custom/LeadBoard/LeadBoardCardFace"
import { formatDateTimeShort } from "@/lib/date-time"
import type { ClientsListProps } from "./ClientsList.types"

export function ClientsList({ clients }: ClientsListProps) {
  const [leadId, setLeadId] = useState<string | null>(null)
  const selected = clients.find((item) => item.lead_id === leadId) ?? null

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-[var(--page-padding-x)] py-4">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
          <div>
            <h1 className="font-display text-title font-semibold text-fg">
              Clientes
            </h1>
            <p className="mt-1 font-sans text-body-sm text-fg-secondary">
              Contas convertidas após assinatura e pagamento.
            </p>
          </div>

          {clients.length === 0 ? (
            <p className="rounded-xl bg-surface px-4 py-8 text-center font-sans text-body-sm text-fg-muted shadow-card">
              Nenhum cliente consolidado ainda.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {clients.map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    onClick={() => setLeadId(client.lead_id)}
                    className="flex w-full min-w-0 items-start gap-3 rounded-xl bg-surface px-4 py-3 text-left shadow-card transition-colors duration-150 ease-out hover:bg-hover"
                  >
                    <span
                      aria-hidden
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-success/10 font-sans text-caption font-semibold text-success"
                    >
                      {getLeadInitials(client.company_name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-sans text-body-sm font-semibold text-fg">
                          {client.company_name}
                        </span>
                        <span className="inline-flex shrink-0 rounded-md bg-success/10 px-2 py-0.5 font-sans text-caption font-medium text-success">
                          Início
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate font-sans text-caption text-fg-muted">
                        {client.closer_name
                          ? `Closer · ${client.closer_name}`
                          : "Sem closer"}
                        {" · "}
                        {formatDateTimeShort(client.converted_at)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <LeadDetailDialog
        open={leadId !== null}
        onClose={() => setLeadId(null)}
        leadId={leadId}
        preview={
          selected
            ? {
                company_name: selected.company_name,
                website_domain: "",
                status: "converted",
                next_follow_up_at: null,
                activity_count: 0,
                assignee_name: selected.closer_name,
              }
            : null
        }
      />
    </div>
  )
}
