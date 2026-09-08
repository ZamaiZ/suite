"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import {
  RiChat3Line,
  RiPriceTag3Line,
  RiSearchLine,
  RiStore2Line,
  RiTimeLine,
  RiUserLine,
} from "react-icons/ri"
import { LeadImport } from "@/components/custom/LeadImport"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
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
import type { LeadSegmentFilterOption, LeadTagFilterOption } from "./LeadBoard.types"

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

  useEffect(() => {
    setDraft(listParams.q)
  }, [listParams.q])

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

  return (
    <div className="flex min-w-0 shrink-0 flex-col gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border-subtle pb-2">
        <InputGroup className="h-10 min-w-0 flex-1 basis-48 max-w-xs"><InputGroupAddon><RiSearchLine size={16} aria-hidden /></InputGroupAddon><InputGroupInput id="lead-search" name="q" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Empresa ou site" aria-label="Buscar" aria-busy={isPending} /></InputGroup>
        <div className="flex shrink-0 items-center gap-2">
          <div className="w-40 shrink-0">
            <Select value={listParams.team ? "team" : "portfolio"} onValueChange={(next) => replaceParams({ team: next === "team" })}><SelectTrigger id="lead-scope-filter" className="h-10 w-full"><RiUserLine size={16} aria-hidden /><SelectValue /></SelectTrigger><SelectContent align="start"><SelectItem value="portfolio">Minha carteira</SelectItem>{canViewTeamLeads ? <SelectItem value="team">Todos</SelectItem> : null}</SelectContent></Select>
          </div>
          <LeadBoardToolbarToggle
            pressed={listParams.today}
            activeTone="warning"
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
            activeTone="accent"
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
        <div className="ml-auto shrink-0">
          <LeadImport />
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {segmentOptions.length > 0 ? (
          <div className="w-40 shrink-0">
            <Select value={listParams.segment ?? "all"} onValueChange={(next) => replaceParams({ segment: next === "all" ? null : String(next) })}><SelectTrigger id="lead-segment-filter" className="h-10 w-full"><RiStore2Line size={16} aria-hidden /><SelectValue /></SelectTrigger><SelectContent align="start"><SelectItem value="all">Todos os segmentos</SelectItem>{segmentOptions.map((option) => <SelectItem key={option.slug} value={option.slug}>{option.name}</SelectItem>)}</SelectContent></Select>
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
            <Select value={listParams.tag ?? "all"} onValueChange={(next) => replaceParams({ tag: next === "all" ? null : String(next) })}><SelectTrigger id="lead-tag-filter" className="h-10 w-full"><RiPriceTag3Line size={16} aria-hidden /><SelectValue /></SelectTrigger><SelectContent align="start"><SelectItem value="all">Todas as tags</SelectItem>{tagOptions.map((option) => <SelectItem key={option.slug} value={option.slug}>{option.name}</SelectItem>)}</SelectContent></Select>
          </div>
        ) : null}
        {hasCatalogFilters ? (
          <button
            type="button"
            onClick={() =>
              replaceParams({
                segment: null,
                city: null,
                state: null,
                tag: null,
              })
            }
            className="ml-auto h-[var(--control-height)] shrink-0 rounded-md px-3 font-sans text-body-sm font-medium text-fg-secondary transition-[background-color,color,transform] duration-150 ease-out hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.97]"
          >
            Limpar filtros
          </button>
        ) : null}
      </div>
    </div>
  )
}
