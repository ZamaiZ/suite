"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  RiCalendarEventLine,
  RiCloseLine,
  RiFilter3Line,
  RiSearchLine,
  RiUser3Line,
} from "react-icons/ri"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ClientCloserOption } from "@/app/actions/clients"
import { clientsListHref, type ClientsListParams } from "@/lib/clients/href"
import { CLIENT_KICKOFF_STAGE_LABELS } from "@/lib/clients/kickoff"

const BRIEFING_ITEMS = [
  { value: "in_progress", label: "Em andamento" },
  { value: "finalized", label: "Finalizado" },
  { value: "edited_after_submit", label: "Editado após envio" },
]

const KICKOFF_ITEMS = Object.entries(
  CLIENT_KICKOFF_STAGE_LABELS,
).map(([value, label]) => ({
  value,
  label: label || "Sem kickoff",
}))

type ClientsListToolbarProps = {
  listParams: ClientsListParams
  closerOptions: ClientCloserOption[]
  clientId?: string | null
}

export function ClientsListToolbar({
  listParams,
  closerOptions,
  clientId,
}: ClientsListToolbarProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [draft, setDraft] = useState(listParams.q)

  useEffect(() => {
    setDraft(listParams.q)
  }, [listParams.q])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draft === listParams.q) return

      startTransition(() => {
        router.replace(
          clientsListHref({
            ...listParams,
            q: draft,
            client: clientId ?? undefined,
          }),
          { scroll: false },
        )
      })
    }, 300)

    return () => window.clearTimeout(timer)
  }, [draft, listParams, clientId, router])

  function replace(next: Partial<ClientsListParams>) {
    startTransition(() => {
      router.replace(
        clientsListHref({
          ...listParams,
          ...next,
          client: clientId ?? undefined,
        }),
        { scroll: false },
      )
    })
  }

  const hasFilters = Boolean(
    listParams.q ||
      listParams.briefing ||
      listParams.kickoff ||
      listParams.closer,
  )
  const closerItems = closerOptions.map((closer) => ({
    value: closer.id,
    label: closer.name,
  }))

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface/80 p-3 shadow-card sm:flex-row sm:items-center">
      <div className="relative min-w-0 flex-1">
        <RiSearchLine
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted"
          size={17}
          aria-hidden
        />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Buscar cliente ou domínio…"
          aria-label="Buscar clientes"
          className="h-10 w-full rounded-lg border border-border-subtle bg-canvas pl-9 pr-10 font-sans text-body-sm text-fg outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
        />
        {pending ? (
          <span
            className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-accent/25 border-t-accent"
            aria-label="Buscando"
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="hidden items-center gap-1 font-sans text-caption font-medium text-fg-muted md:inline-flex">
          <RiFilter3Line size={14} aria-hidden />
          Filtros
        </span>
        <div className="w-40 shrink-0">
          <Select value={listParams.briefing ?? "all"} onValueChange={(value) => replace({ briefing: (value === "all" ? null : String(value)) as ClientsListParams["briefing"] })}><SelectTrigger id="clients-briefing-filter" className="h-10 w-full"><SelectValue /></SelectTrigger><SelectContent align="start"><SelectItem value="all">Todos os briefings</SelectItem>{BRIEFING_ITEMS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="w-40 shrink-0">
          <Select value={listParams.kickoff ?? "all"} onValueChange={(value) => replace({ kickoff: (value === "all" ? null : String(value)) as ClientsListParams["kickoff"] })}><SelectTrigger id="clients-kickoff-filter" className="h-10 w-full"><RiCalendarEventLine size={16} aria-hidden /><SelectValue /></SelectTrigger><SelectContent align="start"><SelectItem value="all">Todos os kickoffs</SelectItem>{KICKOFF_ITEMS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="w-40 shrink-0">
          <Select value={listParams.closer ?? "all"} onValueChange={(value) => replace({ closer: value === "all" ? null : String(value) })}><SelectTrigger id="clients-closer-filter" className="h-10 w-full"><RiUser3Line size={16} aria-hidden /><SelectValue /></SelectTrigger><SelectContent align="start"><SelectItem value="all">Todos os closers</SelectItem>{closerItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
        </div>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setDraft("")
              replace({ q: "", briefing: null, kickoff: null, closer: null })
            }}
            className="inline-flex size-9 items-center justify-center rounded-lg text-fg-muted transition hover:bg-hover hover:text-fg"
            aria-label="Limpar filtros"
          >
            <RiCloseLine size={17} />
          </button>
        ) : null}
      </div>
    </div>
  )
}
