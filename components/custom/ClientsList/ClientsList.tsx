"use client"

import { useEffect, useState } from "react"
import { ClientBriefingReviewDialog } from "@/components/custom/ClientBriefingReviewDialog"
import { clientsListHref, isClientId } from "@/lib/clients/href"
import type { ClientsListProps } from "./ClientsList.types"
import { ClientsListToolbar } from "./ClientsListToolbar"
import { ClientsSummary } from "./ClientsSummary"
import { ClientListRow } from "./ClientListRow"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"

function readClientIdFromLocation(): string | null {
  if (typeof window === "undefined") return null
  const value = new URLSearchParams(window.location.search).get("client")
  return isClientId(value) ? value : null
}

export function ClientsList({
  clients,
  initialClientId = null,
  listParams,
  summary,
  closerOptions,
}: ClientsListProps) {
  const [clientId, setClientId] = useState<string | null>(() => {
    if (typeof window !== "undefined") return readClientIdFromLocation()
    return initialClientId ?? null
  })
  const selected = clients.find((item) => item.id === clientId) ?? null
  const dialogOpen = clientId !== null && Boolean(selected?.canViewClient)

  useEffect(() => {
    function onPopState() {
      setClientId(readClientIdFromLocation())
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  // Cliente inacessível é derivado no render; o histórico continua no efeito.
  const visibleClient = clientId
    ? (clients.find((entry) => entry.id === clientId) ?? null)
    : null
  const clientUnavailable = Boolean(
    clientId && (!visibleClient || !visibleClient.canViewClient),
  )
  if (clientUnavailable) setClientId(null)

  useEffect(() => {
    if (!clientUnavailable) return
    window.history.replaceState(null, "", clientsListHref(listParams))
  }, [clientUnavailable, listParams])

  function openClient(id: string) {
    setClientId(id)
    window.history.pushState(
      null,
      "",
      clientsListHref({ ...listParams, client: id }),
    )
  }

  function closeClient() {
    setClientId(null)
    window.history.pushState(null, "", clientsListHref(listParams))
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-[var(--page-padding-x)] py-4">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <header>
            <p className="text-xs/relaxed font-semibold uppercase tracking-[0.18em] text-primary">
              Relacionamento
            </p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">
                  Clientes
                </h1>
                <p className="mt-1 max-w-xl text-xs/relaxed text-muted-foreground">
                  Contas convertidas após assinatura e pagamento.
                </p>
              </div>
              <span className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs/relaxed text-muted-foreground">
                {summary.total} {summary.total === 1 ? "conta" : "contas"}
              </span>
            </div>
          </header>
          <ClientsListToolbar
            listParams={listParams}
            closerOptions={closerOptions}
            clientId={clientId}
          />
          <ClientsSummary summary={summary} />
          {clients.length === 0 ? (
            <Empty className="rounded-xl border border-dashed border-border bg-card py-14 shadow-xs">
              <EmptyHeader>
                <EmptyTitle className="text-lg font-semibold">
                  Nenhum cliente encontrado
                </EmptyTitle>
                <EmptyDescription>
                  Ajuste os filtros ou aguarde novas conversões.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs divide-y">
              {clients.map((client) => (
                <ClientListRow
                  key={client.id}
                  client={client}
                  onOpen={() => openClient(client.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <ClientBriefingReviewDialog
        open={dialogOpen}
        onClose={closeClient}
        clientId={clientId}
        companyName={selected?.company_name}
        readOnly={!selected?.canManagePortal}
      />
    </div>
  )
}
