"use client"

import Link from "next/link"
import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiFilter3Line,
  RiSearchLine,
} from "react-icons/ri"
import { ProspectingCreateDialog } from "./ProspectingCreateDialog"
import { ProspectingRunTable } from "./ProspectingRunTable"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import type { LeadSegment } from "@/lib/leads/segments"
import type { ProspectingRunPage } from "@/lib/prospecting/reads"
import type { ProspectingRunStatus } from "@/lib/prospecting/types"

export type ProspectingRunFilters = {
  q: string
  status: "all" | ProspectingRunStatus
  page: number
}

const STATUS_ITEMS: Array<{
  value: ProspectingRunFilters["status"]
  label: string
}> = [
  { value: "all", label: "Todos os status" },
  { value: "draft", label: "Rascunho" },
  { value: "collecting", label: "Coletando" },
  { value: "paused", label: "Pausada" },
  { value: "completed", label: "Concluída" },
  { value: "failed", label: "Falhou" },
  { value: "cancelled", label: "Cancelada" },
]

function prospectingHref(filters: ProspectingRunFilters) {
  const params = new URLSearchParams()
  const query = filters.q.trim()
  if (query) params.set("q", query)
  if (filters.status !== "all") params.set("status", filters.status)
  if (filters.page > 1) params.set("page", String(filters.page))
  const search = params.toString()
  return search ? `/prospecting?${search}` : "/prospecting"
}

export function ProspectingRunsPage({
  result,
  filters,
  segments,
}: {
  result: ProspectingRunPage
  filters: ProspectingRunFilters
  segments: LeadSegment[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [query, setQuery] = useState(filters.q)
  const [syncedQuery, setSyncedQuery] = useState(filters.q)
  if (syncedQuery !== filters.q) {
    setSyncedQuery(filters.q)
    setQuery(filters.q)
  }

  useEffect(() => {
    if (query.trim() === filters.q.trim()) return
    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.replace(
          prospectingHref({ ...filters, q: query.trim(), page: 1 }),
          { scroll: false },
        )
      })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [filters.page, filters.q, filters.status, query, router])

  function replace(next: Partial<ProspectingRunFilters>) {
    startTransition(() => {
      router.replace(prospectingHref({ ...filters, ...next }), {
        scroll: false,
      })
    })
  }

  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize))
  const previousHref = prospectingHref({
    ...filters,
    page: Math.max(1, filters.page - 1),
  })
  const nextHref = prospectingHref({
    ...filters,
    page: Math.min(pageCount, filters.page + 1),
  })

  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-[var(--page-padding-x)] py-[var(--page-padding-y)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium text-primary">CRM</p>
            <h1 className="mt-1 text-3xl font-semibold">Prospecção</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Encontre empresas por segmento e cidade e revise os resultados
              antes de criar leads.
            </p>
          </div>
          <div className="shrink-0">
            <ProspectingCreateDialog segments={segments} />
          </div>
        </header>

        <section
          aria-label="Filtros de pesquisas"
          className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center"
        >
          <InputGroup className="min-w-0 flex-1 sm:max-w-sm">
            <InputGroupAddon>
              <RiSearchLine aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar segmento ou cidade"
              aria-label="Buscar pesquisas"
              aria-busy={pending}
            />
            {pending ? (
              <InputGroupAddon align="inline-end">
                <Spinner className="size-3 text-primary" aria-label="Buscando" />
              </InputGroupAddon>
            ) : null}
          </InputGroup>
          <div className="flex items-center gap-2">
            <RiFilter3Line
              className="hidden text-muted-foreground sm:block"
              aria-hidden
            />
            <Select
              items={STATUS_ITEMS}
              value={filters.status}
              onValueChange={(next) =>
                replace({
                  status: String(next) as ProspectingRunFilters["status"],
                  page: 1,
                })
              }
            >
              <SelectTrigger className="w-44" aria-label="Filtrar por status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {STATUS_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <section aria-labelledby="prospecting-runs-heading" className="grid gap-3">
          <div className="flex items-center justify-between gap-4">
            <h2 id="prospecting-runs-heading" className="text-sm font-semibold">
              Pesquisas
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {result.total.toLocaleString("pt-BR")}{" "}
              {result.total === 1 ? "pesquisa" : "pesquisas"}
            </span>
          </div>
          <ProspectingRunTable runs={result.items} />
        </section>

        {result.total > result.pageSize ? (
          <nav
            aria-label="Paginar pesquisas"
            className="flex items-center justify-between gap-4"
          >
            {filters.page > 1 ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={previousHref} />}
              >
                <RiArrowLeftSLine aria-hidden />
                Anterior
              </Button>
            ) : (
              <Button variant="outline" disabled>
                <RiArrowLeftSLine aria-hidden />
                Anterior
              </Button>
            )}
            <span className="text-xs text-muted-foreground tabular-nums">
              Página {Math.min(filters.page, pageCount)} de {pageCount}
            </span>
            {filters.page < pageCount ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={nextHref} />}
              >
                Próxima
                <RiArrowRightSLine aria-hidden />
              </Button>
            ) : (
              <Button variant="outline" disabled>
                Próxima
                <RiArrowRightSLine aria-hidden />
              </Button>
            )}
          </nav>
        ) : null}
      </div>
    </main>
  )
}
