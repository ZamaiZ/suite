"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import {
  RiChat3Line,
  RiPriceTag3Line,
  RiSearchLine,
  RiTimeLine,
  RiUserLine,
} from "react-icons/ri"
import { LeadImport } from "@/components/custom/LeadImport"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { cn } from "@/lib/cn"
import { leadsListHref, type LeadsListParams } from "@/lib/leads/queues"
import type { LeadTagFilterOption } from "./LeadBoard.types"

const SEARCH_DEBOUNCE_MS = 300

export function LeadBoardToolbar({
  listParams,
  tagOptions,
  dueTodayCount,
  pendingCount,
}: {
  listParams: LeadsListParams
  tagOptions: LeadTagFilterOption[]
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
          ...next,
        }),
        { scroll: false },
      )
    })
  }

  return (
    <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
      <Input
        id="lead-search"
        name="q"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Empresa ou site"
        aria-label="Buscar"
        leadingIcon={<RiSearchLine size={16} aria-hidden />}
        className="min-w-0 w-full sm:w-52 sm:flex-none"
        status={isPending ? "loading" : "idle"}
      />
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        <div className="w-44 shrink-0">
          <Select
            id="lead-scope-filter"
            items={[
              { value: "portfolio", label: "Minha carteira" },
              { value: "team", label: "Todos" },
            ]}
            value={listParams.team ? "team" : "portfolio"}
            onValueChange={(next) => {
              replaceParams({ team: next === "team" })
            }}
            searchable={false}
            leadingIcon={<RiUserLine size={16} aria-hidden />}
          />
        </div>
        <button
          type="button"
          aria-pressed={listParams.today}
          aria-label={
            dueTodayCount > 0
              ? `Ligar hoje, ${dueTodayCount} ${dueTodayCount === 1 ? "retorno" : "retornos"}`
              : "Ligar hoje"
          }
          onClick={() => replaceParams({ today: !listParams.today })}
          className={cn(
            "relative h-[var(--control-height)] rounded-md border px-3",
            "inline-flex items-center gap-1.5 font-sans text-body-sm font-medium",
            "transition-[background-color,border-color,color,transform] duration-150 ease-out",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            "active:scale-[0.97]",
            listParams.today
              ? "border-warning/40 bg-warning/10 text-warning"
              : "border-transparent text-fg-secondary hover:bg-hover hover:text-fg",
          )}
        >
          <RiTimeLine size={16} aria-hidden />
          Ligar hoje
          {dueTodayCount > 0 ? (
            <span
              aria-hidden
              className="absolute top-1 right-1 size-1.5 rounded-full bg-danger"
            />
          ) : null}
        </button>
        <button
          type="button"
          aria-pressed={listParams.pending}
          aria-label={
            pendingCount > 0
              ? `Atividade pendente, ${pendingCount} ${pendingCount === 1 ? "lead" : "leads"}`
              : "Atividade pendente"
          }
          onClick={() => replaceParams({ pending: !listParams.pending })}
          className={cn(
            "relative h-[var(--control-height)] rounded-md border px-3",
            "inline-flex items-center gap-1.5 font-sans text-body-sm font-medium",
            "transition-[background-color,border-color,color,transform] duration-150 ease-out",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            "active:scale-[0.97]",
            listParams.pending
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-transparent text-fg-secondary hover:bg-hover hover:text-fg",
          )}
        >
          <RiChat3Line size={16} aria-hidden />
          Atividade pendente
          {pendingCount > 0 ? (
            <span
              aria-hidden
              className="absolute top-1 right-1 size-1.5 rounded-full bg-danger"
            />
          ) : null}
        </button>
        {tagOptions.length > 0 ? (
          <div className="w-44 shrink-0">
            <Select
              id="lead-tag-filter"
              items={tagOptions.map((option) => ({
                value: option.slug,
                label: option.name,
              }))}
              value={listParams.tag ?? ""}
              onValueChange={(next) => {
                const slug = typeof next === "string" ? next : ""
                replaceParams({ tag: slug || null })
              }}
              searchable
              clearable
              placeholder="Tag"
              leadingIcon={<RiPriceTag3Line size={16} aria-hidden />}
            />
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 sm:ml-auto sm:shrink-0">
        <LeadImport />
      </div>
    </div>
  )
}
