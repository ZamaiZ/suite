"use client"

import { useEffect, useRef, useState } from "react"
import { RiLoader4Line, RiSearchLine } from "react-icons/ri"
import { suggestPlaces } from "@/app/actions/leads"
import { cn } from "@/lib/cn"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxRootLabel,
} from "@/components/ui/combobox"
import { InputGroupAddon } from "@/components/ui/input-group"
import { PLACES_SUGGEST_MIN_CHARS } from "@/lib/places"
import type { PlaceSuggestion } from "@/lib/places"

const DEBOUNCE_MS = 300

function newSessionToken() {
  return crypto.randomUUID()
}

export function LeadGbpPlacePicker({
  id,
  disabled,
  locationHint,
  onPick,
}: {
  id: string
  disabled?: boolean
  locationHint?: string | null
  onPick: (placeId: string, sessionToken: string) => void
}) {
  const sessionTokenRef = useRef(newSessionToken())
  const requestIdRef = useRef(0)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<PlaceSuggestion[]>([])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < PLACES_SUGGEST_MIN_CHARS) {
      setItems([])
      setLoading(false)
      setError(null)
      return
    }

    const requestId = ++requestIdRef.current
    setLoading(true)
    const timer = window.setTimeout(() => {
      const formData = new FormData()
      formData.set("query", trimmed)
      formData.set("session_token", sessionTokenRef.current)
      if (locationHint) {
        formData.set("location_hint", locationHint)
      }
      void suggestPlaces(formData).then((result) => {
        if (requestId !== requestIdRef.current) return
        setLoading(false)
        if (result.status === "error") {
          setItems([])
          setError(result.message)
          return
        }
        setError(null)
        setItems(result.suggestions)
      })
    }, DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [query, locationHint])

  function handlePick(item: PlaceSuggestion | null) {
    if (!item) return
    const token = sessionTokenRef.current
    sessionTokenRef.current = newSessionToken()
    setQuery("")
    setItems([])
    setOpen(false)
    onPick(item.placeId, token)
  }

  const errorId = `${id}-error`
  const canSearch = query.trim().length >= PLACES_SUGGEST_MIN_CHARS

  return (
    <div className="flex w-full flex-col gap-1.5">
      <Combobox<PlaceSuggestion>
        items={items}
        value={null}
        onValueChange={(next) => {
          handlePick(next)
        }}
        isItemEqualToValue={(left, right) =>
          Boolean(left && right && left.placeId === right.placeId)
        }
        itemToStringLabel={(item) =>
          item.address ? `${item.name} ${item.address}` : item.name
        }
        filter={null}
        disabled={disabled}
        autoHighlight
        modal={false}
        open={open}
        onOpenChange={setOpen}
        inputValue={query}
        onInputValueChange={(value) => {
          setQuery(value)
          if (!open && value.trim().length > 0) setOpen(true)
        }}
      >
        <ComboboxRootLabel
          className={cn(
            "font-sans text-body-sm font-medium text-fg-secondary",
            disabled ? "opacity-50" : "cursor-text",
            error && "text-danger",
          )}
        >
          Perfil no Google
        </ComboboxRootLabel>
        <ComboboxInput
            id={id}
            placeholder="Buscar estabelecimento"
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            aria-busy={loading || undefined}
            showTrigger={false}
            className={cn("h-[var(--control-height)]", error && "border-danger")}
          >
          <InputGroupAddon align="inline-start"><RiSearchLine size={16} aria-hidden /></InputGroupAddon>
          {loading ? (
            <InputGroupAddon align="inline-end"><RiLoader4Line size={16} aria-hidden className="animate-spin" /></InputGroupAddon>
          ) : null}
        </ComboboxInput>

        <ComboboxContent>
              <div className="max-h-[min(22.5rem,var(--available-height))] overflow-y-auto overscroll-contain p-1">
                {loading ? (
                  <div className="flex flex-col gap-1 p-1" aria-hidden>
                    {[0, 1, 2].map((row) => (
                      <div
                        key={row}
                        className="h-10 animate-pulse rounded-md bg-hover"
                      />
                    ))}
                  </div>
                ) : (
                  <>
                    <ComboboxEmpty
                      className="px-2 py-2.5 font-sans text-body-sm text-fg-muted"
                    >
                      {canSearch
                        ? "Nenhum estabelecimento encontrado"
                        : `Digite pelo menos ${PLACES_SUGGEST_MIN_CHARS} caracteres`}
                    </ComboboxEmpty>
                    <ComboboxList>
                      {(item: PlaceSuggestion) => (
                        <ComboboxItem
                          key={item.placeId}
                          value={item}
                          className={cn(
                            "flex min-h-10 cursor-pointer flex-col justify-center rounded-md px-2 py-1.5",
                            "font-sans text-body-sm text-fg outline-none select-none",
                            "data-highlighted:bg-hover",
                          )}
                        >
                          <span className="truncate">{item.name}</span>
                          {item.address ? (
                            <span className="truncate font-sans text-caption text-fg-muted">
                              {item.address}
                            </span>
                          ) : null}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </>
                )}
              </div>
        </ComboboxContent>
      </Combobox>
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="font-sans text-body-sm text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
