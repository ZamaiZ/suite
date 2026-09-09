"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  RiCalendarEventLine,
  RiCloseLine,
  RiFilter3Line,
  RiSearchLine,
  RiUser3Line,
} from "react-icons/ri"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import type { ClientCloserOption } from "@/app/actions/clients"
import { clientsListHref, type ClientsListParams } from "@/lib/clients/href"
import { CLIENT_KICKOFF_STAGE_LABELS } from "@/lib/clients/kickoff"

const BRIEFING_ITEMS = [
  { value: "all", label: "Todos os briefings" },
  { value: "in_progress", label: "Em andamento" },
  { value: "finalized", label: "Finalizado" },
  { value: "edited_after_submit", label: "Editado após envio" },
]

const KICKOFF_ITEMS = [
  { value: "all", label: "Todos os kickoffs" },
  ...Object.entries(CLIENT_KICKOFF_STAGE_LABELS).map(([value, label]) => ({
    value,
    label: label || "Sem kickoff",
  })),
]

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
  const closerItems = useMemo(
    () => [
      { value: "all", label: "Todos os closers" },
      ...closerOptions.map((closer) => ({
        value: closer.id,
        label: closer.name,
      })),
    ],
    [closerOptions],
  )

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/80 p-3 shadow-xs sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <InputGroup className="rounded-lg bg-background">
          <InputGroupAddon>
            <RiSearchLine size={17} aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Buscar cliente ou domínio…"
            aria-label="Buscar clientes"
          />
          {pending ? (
            <InputGroupAddon align="inline-end">
              <Spinner
                className="size-3.5 text-primary"
                aria-label="Buscando"
              />
            </InputGroupAddon>
          ) : null}
        </InputGroup>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="hidden items-center gap-1 text-xs/relaxed font-medium text-muted-foreground md:inline-flex">
          <RiFilter3Line size={14} aria-hidden />
          Filtros
        </span>
        <div className="w-40 shrink-0">
          <Select
            items={BRIEFING_ITEMS}
            value={listParams.briefing ?? "all"}
            onValueChange={(value) =>
              replace({
                briefing: (value === "all"
                  ? null
                  : String(value)) as ClientsListParams["briefing"],
              })
            }
          >
            <SelectTrigger id="clients-briefing-filter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {BRIEFING_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40 shrink-0">
          <Select
            items={KICKOFF_ITEMS}
            value={listParams.kickoff ?? "all"}
            onValueChange={(value) =>
              replace({
                kickoff: (value === "all"
                  ? null
                  : String(value)) as ClientsListParams["kickoff"],
              })
            }
          >
            <SelectTrigger id="clients-kickoff-filter" className="w-full">
              <RiCalendarEventLine size={16} aria-hidden />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {KICKOFF_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40 shrink-0">
          <Select
            items={closerItems}
            value={listParams.closer ?? "all"}
            onValueChange={(value) =>
              replace({ closer: value === "all" ? null : String(value) })
            }
          >
            <SelectTrigger id="clients-closer-filter" className="w-full">
              <RiUser3Line size={16} aria-hidden />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {closerItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hasFilters ? (
          <Button
            type="button"
            onClick={() => {
              setDraft("")
              replace({ q: "", briefing: null, kickoff: null, closer: null })
            }}
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label="Limpar filtros"
          >
            <RiCloseLine size={17} />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
