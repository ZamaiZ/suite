"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, useTransition } from "react"
import {
  RiChat3Line,
  RiPriceTag3Line,
  RiSearchEyeLine,
  RiSearchLine,
  RiStore2Line,
  RiTimeLine,
  RiUserLine,
} from "react-icons/ri"
import { LeadImport } from "@/components/custom/LeadImport"
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
import { leadsListHref, type LeadsListParams } from "@/lib/leads/queues"
import { LeadCityFilter } from "./LeadCityFilter"
import { LeadBoardToolbarToggle } from "./LeadBoardToolbarToggle"
import type {
  LeadSegmentFilterOption,
  LeadTagFilterOption,
} from "./LeadBoard.types"

const SEARCH_DEBOUNCE_MS = 300

export function LeadBoardToolbar({
  listParams,
  tagOptions,
  segmentOptions,
  canViewTeamLeads,
  dueTodayCount,
  pendingCount,
}: {
  listParams: LeadsListParams
  tagOptions: LeadTagFilterOption[]
  segmentOptions: LeadSegmentFilterOption[]
  canViewTeamLeads: boolean
  dueTodayCount: number
  pendingCount: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [draft, setDraft] = useState(listParams.q)

  // Ajuste de estado quando a prop muda: no render, não em efeito.
  const [syncedQuery, setSyncedQuery] = useState(listParams.q)
  if (syncedQuery !== listParams.q) {
    setSyncedQuery(listParams.q)
    setDraft(listParams.q)
  }

  useEffect(() => {
    const next = draft.trim()
    const current = listParams.q.trim()
    if (next === current) return
    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.replace(
          leadsListHref({
            q: next,
            team: listParams.team,
            today: listParams.today,
            pending: listParams.pending,
            tag: listParams.tag,
            segment: listParams.segment,
            city: listParams.city,
            state: listParams.state,
          }),
          { scroll: false },
        )
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [
    draft,
    listParams.q,
    listParams.team,
    listParams.today,
    listParams.pending,
    listParams.tag,
    listParams.segment,
    listParams.city,
    listParams.state,
    router,
  ])

  function replaceParams(next: Partial<LeadsListParams>) {
    startTransition(() => {
      router.replace(
        leadsListHref({
          q: listParams.q,
          team: listParams.team,
          today: listParams.today,
          pending: listParams.pending,
          tag: listParams.tag,
          segment: listParams.segment,
          city: listParams.city,
          state: listParams.state,
          ...next,
        }),
        { scroll: false },
      )
    })
  }

  const hasCatalogFilters = Boolean(
    listParams.segment || listParams.city || listParams.tag,
  )

  // `items` é o que faz o <SelectValue> renderizar o rótulo em vez do valor
  // cru. Mantido como fonte única: as opções do popup saem daqui também.
  const scopeItems = useMemo(
    () => [
      { value: "portfolio", label: "Minha carteira" },
      ...(canViewTeamLeads ? [{ value: "team", label: "Todos" }] : []),
    ],
    [canViewTeamLeads],
  )

  const segmentItems = useMemo(
    () => [
      { value: "all", label: "Todos os segmentos" },
      ...segmentOptions.map((option) => ({
        value: option.slug,
        label: option.name,
      })),
    ],
    [segmentOptions],
  )

  const tagItems = useMemo(
    () => [
      { value: "all", label: "Todas as tags" },
      ...tagOptions.map((option) => ({
        value: option.slug,
        label: option.name,
      })),
    ],
    [tagOptions],
  )

  return (
    <div className="flex min-w-0 shrink-0 flex-col gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border/70 pb-2">
        <InputGroup className="min-w-0 flex-1 basis-48 max-w-xs">
          <InputGroupAddon>
            <RiSearchLine size={16} aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            id="lead-search"
            name="q"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Empresa, site ou telefone"
            aria-label="Buscar"
            aria-busy={isPending}
          />
        </InputGroup>
        <div className="flex shrink-0 items-center gap-2">
          <div className="w-40 shrink-0">
            <Select
              items={scopeItems}
              value={listParams.team ? "team" : "portfolio"}
              onValueChange={(next) => replaceParams({ team: next === "team" })}
            >
              <SelectTrigger id="lead-scope-filter" className="w-full">
                <RiUserLine size={16} aria-hidden />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {scopeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <LeadBoardToolbarToggle
            pressed={listParams.today}
            badgeCount={dueTodayCount}
            label="Ligar hoje"
            ariaLabel={
              dueTodayCount > 0
                ? `Ligar hoje, ${dueTodayCount} ${dueTodayCount === 1 ? "retorno" : "retornos"}`
                : "Ligar hoje"
            }
            icon={<RiTimeLine size={16} aria-hidden />}
            onClick={() => replaceParams({ today: !listParams.today })}
          />
          <LeadBoardToolbarToggle
            pressed={listParams.pending}
            badgeCount={pendingCount}
            label="Atividade pendente"
            ariaLabel={
              pendingCount > 0
                ? `Atividade pendente, ${pendingCount} ${pendingCount === 1 ? "lead" : "leads"}`
                : "Atividade pendente"
            }
            icon={<RiChat3Line size={16} aria-hidden />}
            onClick={() => replaceParams({ pending: !listParams.pending })}
          />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => startTransition(() => router.push("/prospecting"))}
            disabled={isPending}
          >
            <RiSearchEyeLine aria-hidden />
            Prospectar
          </Button>
          <LeadImport />
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {segmentOptions.length > 0 ? (
          <div className="w-40 shrink-0">
            <Select
              items={segmentItems}
              value={listParams.segment ?? "all"}
              onValueChange={(next) =>
                replaceParams({ segment: next === "all" ? null : String(next) })
              }
            >
              <SelectTrigger id="lead-segment-filter" className="w-full">
                <RiStore2Line size={16} aria-hidden />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {segmentItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="w-40 shrink-0">
          <LeadCityFilter
            id="lead-city-filter"
            value={{ city: listParams.city, state: listParams.state }}
            onValueChange={(next) => {
              replaceParams({ city: next.city, state: next.state })
            }}
            disabled={isPending}
          />
        </div>
        {tagOptions.length > 0 ? (
          <div className="w-40 shrink-0">
            <Select
              items={tagItems}
              value={listParams.tag ?? "all"}
              onValueChange={(next) =>
                replaceParams({ tag: next === "all" ? null : String(next) })
              }
            >
              <SelectTrigger id="lead-tag-filter" className="w-full">
                <RiPriceTag3Line size={16} aria-hidden />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {tagItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {hasCatalogFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() =>
              replaceParams({
                segment: null,
                city: null,
                state: null,
                tag: null,
              })
            }
            className="ml-auto h-7 shrink-0 px-3 text-xs/relaxed text-muted-foreground"
          >
            Limpar filtros
          </Button>
        ) : null}
      </div>
    </div>
  )
}
