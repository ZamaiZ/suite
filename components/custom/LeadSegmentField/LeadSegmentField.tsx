"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Combobox } from "@base-ui/react/combobox"
import { RiAddLine } from "react-icons/ri"
import { listLeadSegments } from "@/app/actions/leads"
import { useDialogPortalContainer } from "@/components/ui/Dialog"
import { cn } from "@/lib/cn"
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
  const portalContainer = useDialogPortalContainer()
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
  const catalogMatch = catalog.find((item) => segmentSlug(item.name) === querySlug)
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
          return name.includes(needle) || segmentSlug(item.name).includes(querySlug)
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
    <div className="flex w-full flex-col gap-1.5">
      <Combobox.Root
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
          <Combobox.Label
            className={cn(
              "font-sans text-body-sm font-medium text-fg-secondary",
              disabled ? "opacity-50" : "cursor-text",
              error && "text-danger",
            )}
            onClick={() => {
              if (!disabled) inputRef.current?.focus()
            }}
          >
            {label}
          </Combobox.Label>
        ) : null}

        <div
          ref={fieldRef}
          onClick={() => {
            if (!disabled) inputRef.current?.focus()
          }}
          className={cn(
            "flex w-full items-center rounded-md border border-input-border bg-input px-2.5",
            "min-h-[var(--control-height)]",
            "transition-[background-color,border-color,color,opacity] duration-150 ease-out",
            "focus-within:border-accent",
            disabled && "pointer-events-none opacity-50",
            error && "border-danger focus-within:border-danger",
          )}
        >
          <Combobox.Input
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
            className={cn(
              "w-full bg-transparent py-2 font-sans text-body-sm text-fg outline-none",
              "placeholder:text-fg-muted",
            )}
          />
        </div>

        <Combobox.Portal container={portalContainer ?? undefined}>
          <Combobox.Positioner
            className="z-50 outline-none"
            sideOffset={4}
            align="start"
            anchor={fieldRef}
          >
            <Combobox.Popup
              className={cn(
                "pointer-events-auto w-[var(--anchor-width)] max-w-[var(--available-width)]",
                "origin-[var(--transform-origin)] rounded-md border border-popover-border bg-popover shadow-raised",
              )}
            >
              <div className="max-h-[min(16rem,var(--available-height))] overflow-y-auto overscroll-contain p-1">
                <Combobox.Empty className="px-2 py-2.5 font-sans text-body-sm text-fg-muted">
                  Nenhum segmento
                </Combobox.Empty>
                <Combobox.List>
                  {(item: SegmentOption) => (
                    <Combobox.Item
                      key={item.value}
                      value={item}
                      className={cn(
                        "flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5",
                        "font-sans text-body-sm text-fg outline-none select-none",
                        "data-highlighted:bg-hover",
                      )}
                    >
                      {item.create ? (
                        <>
                          <RiAddLine
                            size={14}
                            aria-hidden
                            className="shrink-0 text-accent"
                          />
                          <span>Criar «{item.label}»</span>
                        </>
                      ) : (
                        <span className="truncate">{item.label}</span>
                      )}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </div>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>

      {error ? (
        <p id={errorId} role="alert" className="font-sans text-body-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
