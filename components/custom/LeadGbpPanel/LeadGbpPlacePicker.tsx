"use client"

import { useState } from "react"
import { RiCheckboxCircleFill, RiSearchLine, RiStarFill } from "react-icons/ri"
import { searchPlaces } from "@/app/actions/leads"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { GBP_SEARCH_MIN_CHARS } from "@/lib/leads/gbp"
import type { GbpPlaceCandidate } from "@/lib/leads/gbp-maps-candidate"

/**
 * Busca explícita, e não mais typeahead.
 *
 * Cada busca é uma requisição paga ao DataForSEO e leva segundos — disparar a
 * cada tecla queimaria dinheiro e devolveria resultado de palavra pela metade.
 *
 * Em troca, a lista deixou de ser nome e endereço: o item do Maps traz
 * categoria, nota, volume de avaliações, domínio e status de reivindicação na
 * mesma resposta paga. É isso que permite escolher entre homônimos sem abrir o
 * Google — o caso em que o vínculo errado acontecia.
 */
export function LeadGbpPlacePicker({
  id,
  leadId,
  disabled,
  onPick,
}: {
  id: string
  leadId: string
  disabled?: boolean
  onPick: (candidate: GbpPlaceCandidate) => void
}) {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [items, setItems] = useState<GbpPlaceCandidate[]>([])

  const canSearch = query.trim().length >= GBP_SEARCH_MIN_CHARS

  function handleSearch() {
    if (!canSearch || loading || disabled) return
    setLoading(true)
    setError(null)
    const formData = new FormData()
    formData.set("lead_id", leadId)
    formData.set("query", query.trim())
    void searchPlaces(formData).then((result) => {
      setLoading(false)
      setSearched(true)
      if (result.status === "error") {
        setItems([])
        setError(result.message)
        return
      }
      setItems(result.candidates)
    })
  }

  const errorId = `${id}-error`

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id} className={cn(error && "text-destructive")}>
        Perfil no Google
      </FieldLabel>
      <div className="flex gap-2">
        <InputGroup className="flex-1">
          <InputGroupAddon align="inline-start">
            <RiSearchLine size={16} aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            id={id}
            value={query}
            placeholder="Nome do estabelecimento"
            disabled={disabled || loading}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setQuery(event.target.value)
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return
              event.preventDefault()
              handleSearch()
            }}
          />
        </InputGroup>
        <Button
          type="button"
          onClick={handleSearch}
          disabled={!canSearch || loading || disabled}
        >
          {loading ? <Spinner aria-hidden className="size-4" /> : "Buscar"}
        </Button>
      </div>

      {loading ? (
        <div className="mt-2 flex flex-col gap-1" aria-hidden>
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-16 rounded-md" />
          ))}
        </div>
      ) : null}

      {!loading && searched && items.length === 0 && !error ? (
        <p className="mt-2 text-xs/relaxed text-muted-foreground">
          Nenhum estabelecimento encontrado. Tente o nome como aparece no
          Google.
        </p>
      ) : null}

      {!loading && items.length > 0 ? (
        <ul className="mt-2 flex max-h-[22.5rem] flex-col gap-1 overflow-y-auto overscroll-contain">
          {items.map((item) => (
            <li key={item.placeId}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(item)}
                className="flex w-full flex-col items-start gap-0.5 rounded-md border border-border/70 px-3 py-2 text-left hover:bg-accent disabled:opacity-60"
              >
                <span className="flex w-full items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {item.title}
                  </span>
                  {item.isClaimed ? (
                    <RiCheckboxCircleFill
                      size={14}
                      aria-label="Perfil reivindicado"
                      className="shrink-0 text-success"
                    />
                  ) : null}
                </span>
                {item.address ? (
                  <span className="w-full truncate text-xs text-muted-foreground">
                    {item.address}
                  </span>
                ) : null}
                <span className="flex w-full flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  {item.category ? <span>{item.category}</span> : null}
                  {item.rating !== null ? (
                    <span className="inline-flex items-center gap-1">
                      <RiStarFill
                        size={12}
                        aria-hidden
                        className="text-warning"
                      />
                      {item.rating.toLocaleString("pt-BR", {
                        minimumFractionDigits: 1,
                      })}
                      {item.votes !== null
                        ? ` (${item.votes.toLocaleString("pt-BR")})`
                        : null}
                    </span>
                  ) : null}
                  {item.domain ? <span>{item.domain}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <FieldError id={errorId}>{error}</FieldError>
    </Field>
  )
}
