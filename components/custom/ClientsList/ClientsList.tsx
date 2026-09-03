"use client"

import { useEffect, useState, type MouseEvent } from "react"
import { ClientBriefingReviewDialog } from "@/components/custom/ClientBriefingReviewDialog"
import { ClientCardMenu } from "@/components/custom/ClientCardMenu"
import { getLeadInitials } from "@/components/custom/LeadBoard/LeadBoardCardFace"
import { clientsListHref, isClientId } from "@/lib/clients/href"
import { cn } from "@/lib/cn"
import { formatDateTimeShort } from "@/lib/date-time"
import type { ClientsListProps } from "./ClientsList.types"

function readClientIdFromLocation(): string | null {
  if (typeof window === "undefined") return null
  const value = new URLSearchParams(window.location.search).get("client")
  return isClientId(value) ? value : null
}

function isModifiedClick(event: MouseEvent) {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
}

export function ClientsList({
  clients,
  initialClientId = null,
}: ClientsListProps) {
  const [clientId, setClientId] = useState<string | null>(() => {
    if (typeof window !== "undefined") return readClientIdFromLocation()
    return initialClientId ?? null
  })
  const selected = clients.find((item) => item.id === clientId) ?? null
  const dialogOpen =
    clientId !== null && Boolean(selected?.canManagePortal)

  useEffect(() => {
    function onPopState() {
      setClientId(readClientIdFromLocation())
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  useEffect(() => {
    if (!clientId) return
    const item = clients.find((entry) => entry.id === clientId)
    if (!item || !item.canManagePortal) {
      setClientId(null)
      window.history.replaceState(null, "", clientsListHref())
    }
  }, [clientId, clients])

  function openClient(id: string) {
    setClientId(id)
    window.history.pushState(null, "", clientsListHref({ client: id }))
  }

  function closeClient() {
    setClientId(null)
    window.history.pushState(null, "", clientsListHref())
  }

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
              {clients.map((client) => {
                const interactive = client.canManagePortal
                const face = (
                  <>
                    <span
                      aria-hidden
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-success/10 font-sans text-caption font-semibold text-success"
                    >
                      {getLeadInitials(client.company_name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate font-sans text-body-sm font-semibold text-fg">
                          {client.company_name}
                        </span>
                        <span className="inline-flex shrink-0 rounded-md bg-success/10 px-2 py-0.5 font-sans text-caption font-medium text-success">
                          Início
                        </span>
                        <span
                          className={
                            client.briefingStatus === "finalized"
                              ? "inline-flex shrink-0 rounded-md bg-success/10 px-2 py-0.5 font-sans text-caption font-medium text-success"
                              : client.briefingStatus === "edited_after_submit"
                                ? "inline-flex shrink-0 rounded-md bg-warning/10 px-2 py-0.5 font-sans text-caption font-medium text-warning"
                                : "inline-flex shrink-0 rounded-md bg-fg-muted/10 px-2 py-0.5 font-sans text-caption font-medium text-fg-muted"
                          }
                        >
                          {client.briefingStatusLabel}
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
                  </>
                )

                return (
                  <li key={client.id}>
                    <div
                      className={cn(
                        "flex w-full min-w-0 items-start gap-1 rounded-xl bg-surface shadow-card",
                        interactive &&
                          "transition-colors duration-150 ease-out hover:bg-hover",
                        clientId === client.id && interactive && "bg-hover",
                      )}
                    >
                      {interactive ? (
                        <a
                          href={clientsListHref({ client: client.id })}
                          onClick={(event) => {
                            if (isModifiedClick(event)) return
                            event.preventDefault()
                            openClient(client.id)
                          }}
                          className={cn(
                            "flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left",
                            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                            "active:scale-[0.99]",
                          )}
                        >
                          {face}
                        </a>
                      ) : (
                        <div className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3">
                          {face}
                        </div>
                      )}
                      {interactive ? (
                        <div className="shrink-0 self-center pr-2">
                          <ClientCardMenu clientId={client.id} />
                        </div>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <ClientBriefingReviewDialog
        open={dialogOpen}
        onClose={closeClient}
        clientId={clientId}
        companyName={selected?.company_name}
      />
    </div>
  )
}
