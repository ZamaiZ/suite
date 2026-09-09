"use client"

import { useEffect, useRef, useState } from "react"
import { RiSearchLine } from "react-icons/ri"
import { suggestBriefingAddresses } from "@/app/actions/briefing"
import { useBriefingWriterClientId } from "@/components/custom/BriefingWriter"
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
import { InputGroupAddon } from "@/components/ui/input-group"
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
  const writerClientId = useBriefingWriterClientId()
  const sessionTokenRef = useRef(newSessionToken())
  const requestIdRef = useRef(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [items, setItems] = useState<PlaceSuggestion[]>([])

  // O reset e o flag de carregamento são derivados da busca no render; o efeito
  // fica só com a parte assíncrona.
  const trimmedValue = value.trim()
  const canSearch = trimmedValue.length >= PLACES_SUGGEST_MIN_CHARS
  const [syncedValue, setSyncedValue] = useState(trimmedValue)
  if (syncedValue !== trimmedValue) {
    setSyncedValue(trimmedValue)
    setLookupError(null)
    if (canSearch) {
      setLoading(true)
    } else {
      setItems([])
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!canSearch) return
    const trimmed = trimmedValue
    const requestId = ++requestIdRef.current
    const timer = window.setTimeout(() => {
      void suggestBriefingAddresses({
        query: trimmed,
        sessionToken: sessionTokenRef.current,
        clientId: writerClientId ?? undefined,
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
  }, [trimmedValue, canSearch, writerClientId])

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

  return (
    <div className="flex w-full flex-col gap-1.5">
      <Combobox<PlaceSuggestion>
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
            "text-xs/relaxed font-medium text-muted-foreground",
            disabled ? "opacity-50" : "cursor-text",
            shownError && "text-destructive",
          )}
        >
          Rua ou estabelecimento
        </label>
        <ComboboxInput
          id={id}
          placeholder="Buscar endereço"
          disabled={disabled}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={shownError ? errorId : undefined}
          aria-busy={loading || undefined}
          showTrigger={false}
          className={cn("h-7", shownError && "border-destructive")}
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
                <ComboboxEmpty className="px-2 py-2.5 text-xs/relaxed text-muted-foreground">
                  {canSearch
                    ? "Nenhum endereço encontrado"
                    : `Digite pelo menos ${PLACES_SUGGEST_MIN_CHARS} caracteres`}
                </ComboboxEmpty>
                <ComboboxList>
                  {(item: PlaceSuggestion) => (
                    <ComboboxItem
                      key={item.placeId}
                      value={item}
                      className={cn(
                        "flex min-h-10 cursor-pointer flex-col justify-center rounded-md px-2 py-1.5",
                        "text-xs/relaxed text-foreground outline-none select-none",
                        "data-highlighted:bg-accent",
                      )}
                    >
                      <span className="truncate">{item.name}</span>
                      {item.address ? (
                        <span className="truncate text-xs/relaxed text-muted-foreground">
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
      {shownError ? (
        <p
          id={errorId}
          role="alert"
          className="text-xs/relaxed text-destructive"
        >
          {shownError}
        </p>
      ) : null}
    </div>
  )
}
