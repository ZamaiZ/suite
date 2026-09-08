"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { RiAddLine } from "react-icons/ri"
import { listLeadSegments } from "@/app/actions/leads"
import { cn } from "cn"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  normalizeSegmentName,
  segmentSlug,
  type LeadSegment,
} from "@/lib/leads/segments"
import type { LeadSegmentFieldProps } from "./LeadSegmentField.types"

const CREATE_VALUE = "__create__"

type SegmentOption = {
  value: string
  label: string
  create?: boolean
}

function isOptionEqual(a: SegmentOption, b: SegmentOption) {
  return a.value === b.value
}

export function LeadSegmentField({
  id,
  value,
  onValueChange,
  label,
  error,
  disabled,
  onBlur,
}: LeadSegmentFieldProps) {
  const fieldRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [catalog, setCatalog] = useState<LeadSegment[]>([])
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const errorId = `${id}-error`

  useEffect(() => {
    let cancelled = false
    void listLeadSegments().then((segments) => {
      if (!cancelled) setCatalog(segments)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const trimmedQuery = query.trim()
  const querySlug = segmentSlug(trimmedQuery)
  const normalizedQuery = normalizeSegmentName(trimmedQuery)
  const catalogMatch = catalog.find(
    (item) => segmentSlug(item.name) === querySlug,
  )
  const selectedItem = useMemo<SegmentOption | null>(() => {
    if (!value) return null
    const slug = segmentSlug(value)
    const match = catalog.find((item) => segmentSlug(item.name) === slug)
    return {
      value: slug || value,
      label: match?.name ?? value,
    }
  }, [catalog, value])

  const canCreate = Boolean(
    normalizedQuery &&
    querySlug &&
    !catalogMatch &&
    segmentSlug(value) !== querySlug,
  )

  const suggestionItems = useMemo<SegmentOption[]>(() => {
    const filtered = trimmedQuery
      ? catalog.filter((item) => {
          const name = item.name.toLocaleLowerCase("pt-BR")
          const needle = trimmedQuery.toLocaleLowerCase("pt-BR")
          return (
            name.includes(needle) || segmentSlug(item.name).includes(querySlug)
          )
        })
      : catalog
    const items: SegmentOption[] = filtered.map((item) => ({
      value: segmentSlug(item.name) || item.id,
      label: item.name,
    }))
    if (canCreate && normalizedQuery) {
      items.unshift({
        value: CREATE_VALUE,
        label: normalizedQuery,
        create: true,
      })
    }
    return items
  }, [canCreate, catalog, normalizedQuery, querySlug, trimmedQuery])

  function handleValueChange(next: SegmentOption | SegmentOption[] | null) {
    const item = Array.isArray(next) ? next[0] : next
    if (!item) {
      onValueChange("")
      return
    }
    if (item.value === CREATE_VALUE && normalizedQuery) {
      onValueChange(normalizedQuery)
      setQuery("")
      return
    }
    onValueChange(item.label)
    setQuery("")
  }

  return (
    <Field data-invalid={Boolean(error)}>
      <Combobox
        items={suggestionItems}
        value={selectedItem}
        onValueChange={(next) => {
          handleValueChange(next as SegmentOption | null)
        }}
        isItemEqualToValue={isOptionEqual}
        itemToStringLabel={(item) => item.label}
        disabled={disabled}
        autoHighlight
        modal={false}
        open={open && !disabled}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setQuery("")
        }}
        inputValue={open ? query : (selectedItem?.label ?? query)}
        onInputValueChange={setQuery}
      >
        {label ? (
          <FieldLabel htmlFor={id} className={cn(error && "text-destructive")}>
            {label}
          </FieldLabel>
        ) : null}

        <div ref={fieldRef} className="w-full">
          <ComboboxInput
            ref={inputRef}
            id={id}
            disabled={disabled}
            placeholder="Selecionar segmento"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onFocus={() => {
              if (!disabled) setOpen(true)
            }}
            onBlur={onBlur}
            className="w-full"
          />
        </div>

        <ComboboxContent anchor={fieldRef}>
          <ComboboxEmpty>Nenhum segmento</ComboboxEmpty>
          <ComboboxList>
            {(item: SegmentOption) => (
              <ComboboxItem
                key={item.value}
                value={item}
                className="cursor-pointer"
              >
                {item.create ? (
                  <>
                    <RiAddLine aria-hidden className="shrink-0 text-primary" />
                    <span>Criar «{item.label}»</span>
                  </>
                ) : (
                  <span className="truncate">{item.label}</span>
                )}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      <FieldError id={errorId}>{error}</FieldError>
    </Field>
  )
}
