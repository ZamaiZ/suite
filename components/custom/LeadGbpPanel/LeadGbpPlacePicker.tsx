"use client"

import { useEffect, useRef, useState } from "react"
import { RiSearchLine } from "react-icons/ri"
import { suggestPlaces } from "@/app/actions/leads"
import { cn } from "cn"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
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

  // Reset e flag de carregamento derivados no render; efeito só para o async.
  const trimmedQuery = query.trim()
  const canSearch = trimmedQuery.length >= PLACES_SUGGEST_MIN_CHARS
  const [syncedQuery, setSyncedQuery] = useState(trimmedQuery)
  if (syncedQuery !== trimmedQuery) {
    setSyncedQuery(trimmedQuery)
    setError(null)
    if (canSearch) {
      setLoading(true)
    } else {
      setItems([])
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!canSearch) return
    const trimmed = trimmedQuery
    const requestId = ++requestIdRef.current
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
  }, [trimmedQuery, canSearch, locationHint])

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

  return (
    <Field data-invalid={Boolean(error)}>
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
        <FieldLabel htmlFor={id} className={cn(error && "text-destructive")}>
          Perfil no Google
        </FieldLabel>
        <ComboboxInput
          id={id}
          placeholder="Buscar estabelecimento"
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          aria-busy={loading || undefined}
          showTrigger={false}
          className="w-full"
        >
          <InputGroupAddon align="inline-start">
            <RiSearchLine size={16} aria-hidden />
          </InputGroupAddon>
          {loading ? (
            <InputGroupAddon align="inline-end">
              <Spinner aria-hidden className="size-4" />
            </InputGroupAddon>
          ) : null}
        </ComboboxInput>

        <ComboboxContent>
          <div className="max-h-[min(22.5rem,var(--available-height))] overflow-y-auto overscroll-contain p-1">
            {loading ? (
              <div className="flex flex-col gap-1 p-1" aria-hidden>
                {[0, 1, 2].map((row) => (
                  <Skeleton key={row} className="h-10 rounded-md" />
                ))}
              </div>
            ) : (
              <>
                <ComboboxEmpty className="px-2 py-2">
                  {canSearch
                    ? "Nenhum estabelecimento encontrado"
                    : `Digite pelo menos ${PLACES_SUGGEST_MIN_CHARS} caracteres`}
                </ComboboxEmpty>
                <ComboboxList>
                  {(item: PlaceSuggestion) => (
                    <ComboboxItem
                      key={item.placeId}
                      value={item}
                      className="cursor-pointer flex-col items-start justify-center"
                    >
                      <span className="truncate">{item.name}</span>
                      {item.address ? (
                        <span className="w-full truncate text-muted-foreground">
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
      <FieldError id={errorId}>{error}</FieldError>
    </Field>
  )
}
