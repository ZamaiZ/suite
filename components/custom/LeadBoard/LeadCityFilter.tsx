"use client"

import { useEffect, useRef, useState } from "react"
import { Combobox } from "@base-ui/react/combobox"
import { RiLoader4Line, RiMapPinLine } from "react-icons/ri"
import { searchLeadCities } from "@/app/actions/leads"
import { cn } from "@/lib/cn"
import type { CitySearchItem } from "@/lib/br-locations"

const DEBOUNCE_MS = 300

type CityOption = CitySearchItem & {
  value: string
}

function isOptionEqual(a: CityOption, b: CityOption) {
  return a.value === b.value
}

function cityValue(item: CitySearchItem) {
  return `${item.stateCode}|${item.name}`
}

export function LeadCityFilter({
  id,
  value,
  onValueChange,
  disabled,
}: {
  id: string
  value: { city: string | null; state: string | null }
  onValueChange: (next: { city: string | null; state: string | null }) => void
  disabled?: boolean
}) {
  const fieldRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const requestIdRef = useRef(0)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<CityOption[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const selectedItem = value.city && value.state
    ? {
        name: value.city,
        stateCode: value.state,
        label: `${value.city} · ${value.state}`,
        value: `${value.state}|${value.city}`,
      }
    : null

  useEffect(() => {
    if (!open) return
    const trimmed = query.trim()
    const requestId = ++requestIdRef.current
    setLoading(true)
    const timer = window.setTimeout(() => {
      void searchLeadCities({ q: trimmed, offset: 0 }).then((result) => {
        if (requestId !== requestIdRef.current) return
        setLoading(false)
        if (result.status === "error") {
          setItems([])
          setHasMore(false)
          return
        }
        setOffset(result.result.items.length)
        setHasMore(result.result.hasMore)
        setItems(
          result.result.items.map((item) => ({
            ...item,
            value: cityValue(item),
          })),
        )
      })
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [open, query])

  async function loadMore() {
    if (loading || !hasMore) return
    setLoading(true)
    const result = await searchLeadCities({ q: query.trim(), offset })
    setLoading(false)
    if (result.status === "error") return
    setOffset((current) => current + result.result.items.length)
    setHasMore(result.result.hasMore)
    setItems((current) => [
      ...current,
      ...result.result.items.map((item) => ({
        ...item,
        value: cityValue(item),
      })),
    ])
  }

  return (
    <Combobox.Root
      items={items}
      value={selectedItem}
      onValueChange={(next) => {
        const item = Array.isArray(next) ? next[0] : next
        if (!item) {
          onValueChange({ city: null, state: null })
          return
        }
        onValueChange({ city: item.name, state: item.stateCode })
        setQuery("")
        setOpen(false)
      }}
      isItemEqualToValue={isOptionEqual}
      itemToStringLabel={(item) => item.label}
      disabled={disabled}
      modal={false}
      open={open && !disabled}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery("")
      }}
      inputValue={open ? query : (selectedItem?.label ?? query)}
      onInputValueChange={setQuery}
    >
      <div
        ref={fieldRef}
        onClick={() => {
          if (!disabled) inputRef.current?.focus()
        }}
        className={cn(
          "flex h-[var(--control-height)] w-full items-center gap-1.5 rounded-md border border-input-border bg-input px-2.5",
          "transition-[background-color,border-color,color,opacity] duration-150 ease-out",
          "focus-within:border-accent",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <RiMapPinLine size={16} aria-hidden className="shrink-0 text-fg-muted" />
        <Combobox.Input
          ref={inputRef}
          id={id}
          disabled={disabled}
          placeholder="Cidade"
          aria-label="Filtrar por cidade"
          onFocus={() => {
            if (!disabled) setOpen(true)
          }}
          className="min-w-0 flex-1 bg-transparent py-2 font-sans text-body-sm text-fg outline-none placeholder:text-fg-muted"
        />
        {loading ? (
          <RiLoader4Line size={16} aria-hidden className="animate-spin text-fg-muted" />
        ) : null}
      </div>

      <Combobox.Portal>
        <Combobox.Positioner
          className="z-50 outline-none"
          sideOffset={4}
          align="start"
          anchor={fieldRef}
        >
          <Combobox.Popup className="pointer-events-auto w-[var(--anchor-width)] rounded-md border border-popover-border bg-popover shadow-raised">
            <div className="max-h-[min(16rem,var(--available-height))] overflow-y-auto overscroll-contain p-1">
              <Combobox.Empty className="px-2 py-2.5 font-sans text-body-sm text-fg-muted">
                Nenhuma cidade
              </Combobox.Empty>
              <Combobox.List>
                {(item: CityOption) => (
                  <Combobox.Item
                    key={item.value}
                    value={item}
                    className="flex min-h-9 cursor-pointer items-center rounded-md px-2 py-1.5 font-sans text-body-sm text-fg outline-none select-none data-highlighted:bg-hover"
                  >
                    {item.label}
                  </Combobox.Item>
                )}
              </Combobox.List>
              {hasMore ? (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  className="mt-1 w-full rounded-md px-2 py-2 font-sans text-body-sm text-accent hover:bg-hover"
                >
                  Carregar mais
                </button>
              ) : null}
            </div>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
