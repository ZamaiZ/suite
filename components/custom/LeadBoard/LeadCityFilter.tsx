"use client"

import { useEffect, useRef, useState } from "react"
import { RiLoader4Line, RiMapPinLine } from "react-icons/ri"
import { searchLeadCities } from "@/app/actions/leads"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { InputGroupAddon } from "@/components/ui/input-group"
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
    <Combobox
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
      <ComboboxInput
          ref={inputRef}
          id={id}
          disabled={disabled}
          placeholder="Cidade"
          aria-label="Filtrar por cidade"
          onFocus={() => {
            if (!disabled) setOpen(true)
          }}
          showTrigger={false}
          className="h-[var(--control-height)]"
        >
        <InputGroupAddon align="inline-start"><RiMapPinLine size={16} aria-hidden /></InputGroupAddon>
        {loading ? (
          <InputGroupAddon align="inline-end"><RiLoader4Line size={16} aria-hidden className="animate-spin" /></InputGroupAddon>
        ) : null}
      </ComboboxInput>

      <ComboboxContent>
            <div className="max-h-[min(16rem,var(--available-height))] overflow-y-auto overscroll-contain p-1">
              <ComboboxEmpty className="px-2 py-2.5 font-sans text-body-sm text-fg-muted">
                Nenhuma cidade
              </ComboboxEmpty>
              <ComboboxList>
                {(item: CityOption) => (
                  <ComboboxItem
                    key={item.value}
                    value={item}
                    className="flex min-h-9 cursor-pointer items-center rounded-md px-2 py-1.5 font-sans text-body-sm text-fg outline-none select-none data-highlighted:bg-hover"
                  >
                    {item.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
              {hasMore ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void loadMore()}
                  className="mt-1 h-9 w-full px-2 font-sans text-body-sm text-primary hover:bg-accent"
                >
                  Carregar mais
                </Button>
              ) : null}
            </div>
      </ComboboxContent>
    </Combobox>
  )
}
