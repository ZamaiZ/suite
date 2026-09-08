"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { Combobox } from "@base-ui/react/combobox"
import { RiAddLine, RiCloseLine } from "react-icons/ri"
import { listLeadTags } from "@/app/actions/leads"
import { cn } from "@/lib/cn"
import {
  normalizeTagName,
  parseTagNames,
  TAGS_PER_LEAD_MAX,
  tagSlug,
  type LeadTag,
} from "@/lib/leads/tags"
import type { LeadTagFieldProps } from "./LeadTagField.types"

const CREATE_VALUE = "__create__"

type TagOption = {
  value: string
  label: string
  create?: boolean
}

function isOptionEqual(a: TagOption, b: TagOption) {
  return a.value === b.value
}

export function LeadTagField({
  id,
  value,
  onValueChange,
  label,
  error,
  disabled,
  onBlur,
}: LeadTagFieldProps) {
  const fieldRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [catalog, setCatalog] = useState<LeadTag[]>([])
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const errorId = `${id}-error`
  const atLimit = value.length >= TAGS_PER_LEAD_MAX

  useEffect(() => {
    let cancelled = false
    void listLeadTags().then((tags) => {
      if (!cancelled) setCatalog(tags)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const selectedSlugs = useMemo(
    () => new Set(value.map((name) => tagSlug(name)).filter(Boolean)),
    [value],
  )

  const selectedItems = useMemo<TagOption[]>(
    () =>
      value.map((name) => ({
        value: tagSlug(name) || name,
        label: name,
      })),
    [value],
  )

  const trimmedQuery = query.trim()
  const querySlug = tagSlug(trimmedQuery)
  const normalizedQuery = normalizeTagName(trimmedQuery)
  const queryMatchesSelected = Boolean(querySlug && selectedSlugs.has(querySlug))
  const catalogMatch = catalog.find((tag) => tagSlug(tag.name) === querySlug)
  const canCreate = Boolean(
    normalizedQuery &&
      querySlug &&
      !queryMatchesSelected &&
      !catalogMatch &&
      !atLimit,
  )

  const suggestionItems = useMemo<TagOption[]>(() => {
    const unused = catalog.filter((tag) => !selectedSlugs.has(tagSlug(tag.name)))
    const filtered = trimmedQuery
      ? unused.filter((tag) => {
          const name = tag.name.toLocaleLowerCase("pt-BR")
          const needle = trimmedQuery.toLocaleLowerCase("pt-BR")
          return name.includes(needle) || tagSlug(tag.name).includes(querySlug)
        })
      : unused
    const items: TagOption[] = filtered.map((tag) => ({
      value: tagSlug(tag.name) || tag.id,
      label: tag.name,
    }))
    if (canCreate && normalizedQuery && items.length === 0) {
      items.push({
        value: CREATE_VALUE,
        label: normalizedQuery,
        create: true,
      })
    }
    return items
  }, [
    canCreate,
    catalog,
    normalizedQuery,
    querySlug,
    selectedSlugs,
    trimmedQuery,
  ])

  function commitNames(names: string[]) {
    onValueChange(parseTagNames(names))
    setQuery("")
  }

  function addName(raw: string) {
    if (atLimit) return
    const name = normalizeTagName(raw)
    if (!name || !tagSlug(name)) return
    commitNames([...value, name])
  }

  function removeName(name: string) {
    const slug = tagSlug(name)
    commitNames(value.filter((item) => tagSlug(item) !== slug))
  }

  function handleValueChange(next: TagOption | TagOption[] | null) {
    const list = Array.isArray(next) ? next : next ? [next] : []
    const created = list.find((item) => item.value === CREATE_VALUE)
    const added = list
      .filter((item) => item.value !== CREATE_VALUE)
      .map((item) => item.label)
      .filter((name) => !selectedSlugs.has(tagSlug(name)))
    const names = [...value, ...added]
    if (created && normalizedQuery) names.push(normalizedQuery)
    commitNames(names)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && query.length === 0 && value.length > 0) {
      event.preventDefault()
      removeName(value[value.length - 1] ?? "")
      return
    }
    if (event.key === "," || event.key === ";") {
      event.preventDefault()
      if (trimmedQuery) addName(trimmedQuery)
      return
    }
    if (event.key === "Tab" && trimmedQuery) {
      event.preventDefault()
      if (catalogMatch) {
        addName(catalogMatch.name)
        return
      }
      addName(trimmedQuery)
    }
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <Combobox.Root
        items={suggestionItems}
        multiple
        value={selectedItems}
        onValueChange={(next) => {
          handleValueChange(next as TagOption[] | null)
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
        inputValue={query}
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
            "flex w-full flex-wrap items-center gap-1.5 rounded-md border border-input-border bg-input px-2 py-1.5",
            "min-h-[var(--control-height)]",
            "transition-[background-color,border-color,color,opacity] duration-150 ease-out",
            "focus-within:border-accent",
            disabled && "pointer-events-none opacity-50",
            error && "border-danger focus-within:border-danger",
          )}
        >
          {selectedItems.map((item) => (
            <span
              key={item.value}
              className="inline-flex max-w-full items-center gap-1 rounded-md bg-hover py-0.5 pr-1 pl-1.5 font-sans text-caption text-fg"
            >
              <span className="truncate">{item.label}</span>
              <button
                type="button"
                aria-label={`Remover ${item.label}`}
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation()
                  removeName(item.label)
                }}
                className="inline-flex size-4 shrink-0 items-center justify-center rounded text-fg-muted hover:text-fg"
              >
                <RiCloseLine size={12} aria-hidden />
              </button>
            </span>
          ))}
          <Combobox.Input
            ref={inputRef}
            id={id}
            disabled={disabled || atLimit}
            placeholder={value.length === 0 ? "Adicionar tag" : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onFocus={() => {
              if (!disabled) setOpen(true)
            }}
            onBlur={onBlur}
            onKeyDown={handleKeyDown}
            className={cn(
              "min-w-[7rem] flex-1 bg-transparent py-0.5 font-sans text-body-sm text-fg outline-none",
              "placeholder:text-fg-muted",
            )}
          />
        </div>

        <Combobox.Portal>
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
                "transition-[transform,opacity] duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
                "data-starting-style:opacity-0 data-starting-style:scale-[0.96]",
                "data-ending-style:opacity-0 data-ending-style:scale-[0.96] data-ending-style:duration-[140ms]",
                "motion-reduce:transition-opacity motion-reduce:duration-150",
                "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
              )}
            >
              <div className="max-h-[min(16rem,var(--available-height))] overflow-y-auto overscroll-contain p-1">
                <Combobox.Empty className="px-2 py-2.5 font-sans text-body-sm text-fg-muted">
                  {atLimit ? "Limite de 8 tags." : "Nenhuma tag"}
                </Combobox.Empty>
                <Combobox.List>
                  {(item: TagOption) => (
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
