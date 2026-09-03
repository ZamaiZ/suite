"use client"

import { useEffect, useRef, useState } from "react"
import { Combobox } from "@base-ui/react/combobox"
import { RiLoader4Line, RiSearchLine } from "react-icons/ri"
import { suggestBriefingAddresses } from "@/app/actions/briefing"
import { cn } from "@/lib/cn"
import { PLACES_SUGGEST_MIN_CHARS, type PlaceSuggestion } from "@/lib/places"
import type { BriefingAddressSearchProps } from "./BriefingAddressSearch.types"

const DEBOUNCE_MS = 300

function newSessionToken() {
  return crypto.randomUUID()
}

export function BriefingAddressSearch({
  id,
  value,
  onValueChange,
  onPick,
  disabled,
  error,
}: BriefingAddressSearchProps) {
  const sessionTokenRef = useRef(newSessionToken())
  const requestIdRef = useRef(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [items, setItems] = useState<PlaceSuggestion[]>([])

  useEffect(() => {
    const trimmed = value.trim()
    if (trimmed.length < PLACES_SUGGEST_MIN_CHARS) {
      setItems([])
      setLoading(false)
      setLookupError(null)
      return
    }

    const requestId = ++requestIdRef.current
    setLoading(true)
    const timer = window.setTimeout(() => {
      void suggestBriefingAddresses({
        query: trimmed,
        sessionToken: sessionTokenRef.current,
      }).then((result) => {
        if (requestId !== requestIdRef.current) return
        setLoading(false)
        if (result.status === "error") {
          setItems([])
          setLookupError(result.message)
          return
        }
        if (result.status === "unauthenticated") {
          setItems([])
          setLookupError("Sessão expirada. Atualize a página.")
          return
        }
        setLookupError(null)
        setItems(result.suggestions)
      })
    }, DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [value])

  function handlePick(item: PlaceSuggestion | null) {
    if (!item) return
    const token = sessionTokenRef.current
    sessionTokenRef.current = newSessionToken()
    setItems([])
    setOpen(false)
    onPick(item, token)
  }

  const errorId = `${id}-error`
  const shownError = error ?? lookupError
  const canSearch = value.trim().length >= PLACES_SUGGEST_MIN_CHARS

  return (
    <div className="flex w-full flex-col gap-1.5">
      <Combobox.Root<PlaceSuggestion>
        items={items}
        value={null}
        onValueChange={(next) => handlePick(next)}
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
        inputValue={value}
        onInputValueChange={(next) => {
          onValueChange(next)
          if (!open && next.trim().length > 0) setOpen(true)
        }}
      >
        <label
          htmlFor={id}
          className={cn(
            "font-sans text-body-sm font-medium text-fg-secondary",
            disabled ? "opacity-50" : "cursor-text",
            shownError && "text-danger",
          )}
        >
          Rua ou estabelecimento
        </label>
        <div className="relative flex items-center">
          <RiSearchLine
            size={16}
            aria-hidden
            className="pointer-events-none absolute left-3 text-fg-muted"
          />
          <Combobox.Input
            id={id}
            placeholder="Buscar endereço"
            disabled={disabled}
            aria-invalid={shownError ? true : undefined}
            aria-describedby={shownError ? errorId : undefined}
            aria-busy={loading || undefined}
            className={cn(
              "h-[var(--control-height)] w-full rounded-md border border-input-border bg-input py-0 pl-9 pr-10",
              "font-sans text-body-sm text-fg outline-none",
              "placeholder:text-fg-muted",
              "transition-[background-color,border-color,color,opacity] duration-150 ease-out",
              "focus-visible:border-accent",
              "disabled:pointer-events-none disabled:opacity-50",
              shownError && "border-danger focus-visible:border-danger",
            )}
          />
          {loading ? (
            <RiLoader4Line
              size={16}
              aria-hidden
              className="absolute right-3 animate-spin text-fg-muted"
            />
          ) : null}
        </div>

        <Combobox.Portal>
          <Combobox.Positioner
            className="z-50 outline-none"
            sideOffset={4}
            align="start"
          >
            <Combobox.Popup
              className={cn(
                "pointer-events-auto w-[var(--anchor-width)] max-w-[var(--available-width)]",
                "origin-[var(--transform-origin)] rounded-md border border-popover-border bg-popover shadow-raised",
                "transition-[transform,opacity] duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
                "data-starting-style:opacity-0 data-starting-style:scale-[0.96]",
                "data-ending-style:opacity-0 data-ending-style:scale-[0.96] data-ending-style:duration-[140ms]",
                "motion-reduce:transition-opacity motion-reduce:duration-150",
                "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
              )}
            >
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
                    <Combobox.Empty className="px-2 py-2.5 font-sans text-body-sm text-fg-muted">
                      {canSearch
                        ? "Nenhum endereço encontrado"
                        : `Digite pelo menos ${PLACES_SUGGEST_MIN_CHARS} caracteres`}
                    </Combobox.Empty>
                    <Combobox.List>
                      {(item: PlaceSuggestion) => (
                        <Combobox.Item
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
                        </Combobox.Item>
                      )}
                    </Combobox.List>
                  </>
                )}
              </div>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      {shownError ? (
        <p id={errorId} role="alert" className="font-sans text-body-sm text-danger">
          {shownError}
        </p>
      ) : null}
    </div>
  )
}
