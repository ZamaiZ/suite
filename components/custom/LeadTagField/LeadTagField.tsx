"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { RiAddLine, RiCloseLine } from "react-icons/ri"
import { listLeadTags } from "@/app/actions/leads"
import { cn } from "cn"
import {
  Combobox,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
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
  const queryMatchesSelected = Boolean(
    querySlug && selectedSlugs.has(querySlug),
  )
  const catalogMatch = catalog.find((tag) => tagSlug(tag.name) === querySlug)
  const canCreate = Boolean(
    normalizedQuery &&
    querySlug &&
    !queryMatchesSelected &&
    !catalogMatch &&
    !atLimit,
  )

  const suggestionItems = useMemo<TagOption[]>(() => {
    const unused = catalog.filter(
      (tag) => !selectedSlugs.has(tagSlug(tag.name)),
    )
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
    <Field data-invalid={Boolean(error)}>
      <Combobox
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
          <FieldLabel htmlFor={id} className={cn(error && "text-destructive")}>
            {label}
          </FieldLabel>
        ) : null}

        <div
          ref={fieldRef}
          onClick={() => {
            if (!disabled) inputRef.current?.focus()
          }}
          className={cn(
            "flex min-h-7 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-background bg-clip-padding px-1.5 py-0.5 text-xs/relaxed shadow-xs transition-colors",
            "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
            disabled && "pointer-events-none opacity-50",
            error &&
              "border-destructive ring-2 ring-destructive/20 focus-within:border-destructive focus-within:ring-destructive/20",
          )}
        >
          {selectedItems.map((item) => (
            <span
              key={item.value}
              className="inline-flex h-[calc(--spacing(4.75))] max-w-full items-center gap-1 rounded-[calc(var(--radius-sm)-2px)] bg-muted-foreground/10 pr-0 pl-1.5 text-xs/relaxed font-medium whitespace-nowrap text-foreground"
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
                className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm opacity-50 transition-opacity hover:opacity-100"
              >
                <RiCloseLine size={10} aria-hidden />
              </button>
            </span>
          ))}
          <ComboboxChipsInput
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
            className="min-w-[7rem] flex-1 bg-transparent placeholder:text-muted-foreground"
          />
        </div>

        <ComboboxContent anchor={fieldRef}>
          <ComboboxEmpty>
            {atLimit ? "Limite de 8 tags." : "Nenhuma tag"}
          </ComboboxEmpty>
          <ComboboxList>
            {(item: TagOption) => (
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
