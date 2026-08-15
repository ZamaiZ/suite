"use client"

import { useEffect, useRef, useState, useMemo, type MouseEvent } from "react"
import { Combobox } from "@base-ui/react/combobox"
import {
  RiArrowDownSLine,
  RiCheckLine,
  RiCloseLine,
  RiLoader4Line,
  RiSearchLine,
} from "react-icons/ri"
import { cn } from "@/lib/cn"
import { useDialogPortalContainer } from "@/components/ui/Dialog"
import type { SelectItem, SelectProps } from "./Select.types"

const DEFAULT_MAX_VISIBLE_CHIPS = 2
const RESTORE_MS = 120

function isItemEqualToValue(a: SelectItem, b: SelectItem) {
  return a.value === b.value
}

function itemToStringLabel(item: SelectItem) {
  return item.description ? `${item.label} ${item.description}` : item.label
}

export function Select({
  id,
  items,
  value,
  onValueChange,
  multiple = false,
  searchable = true,
  clearable = false,
  label,
  placeholder,
  error,
  disabled,
  loading = false,
  leadingIcon,
  maxVisibleChips = DEFAULT_MAX_VISIBLE_CHIPS,
  className,
  onBlur,
}: SelectProps) {
  const portalContainer = useDialogPortalContainer()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const restoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [listRestoring, setListRestoring] = useState(false)

  const selectedItems = useMemo(() => {
    const current = Array.isArray(value) ? value : value ? [value] : []
    return items.filter((item) => current.includes(item.value))
  }, [items, value])

  const comboboxValue = multiple ? selectedItems : (selectedItems[0] ?? null)
  const visibleChips = multiple ? selectedItems.slice(0, maxVisibleChips) : []
  const hiddenChipCount = multiple
    ? Math.max(0, selectedItems.length - maxVisibleChips)
    : 0
  const hasValue = selectedItems.length > 0
  const hasQuery = query.trim().length > 0
  const errorId = `${id}-error`

  useEffect(() => {
    return () => {
      if (restoreTimer.current) clearTimeout(restoreTimer.current)
    }
  }, [])

  function handleValueChange(next: SelectItem | SelectItem[] | null) {
    if (multiple) {
      onValueChange?.(
        (next as SelectItem[] | null)?.map((item) => item.value) ?? [],
      )
      return
    }
    onValueChange?.((next as SelectItem | null)?.value ?? "")
  }

  function removeChip(itemValue: string, event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    const current = Array.isArray(value) ? value : value ? [value] : []
    onValueChange?.(current.filter((item) => item !== itemValue))
  }

  function flashRestore() {
    setListRestoring(true)
    if (restoreTimer.current) clearTimeout(restoreTimer.current)
    restoreTimer.current = setTimeout(() => {
      setListRestoring(false)
      restoreTimer.current = null
    }, RESTORE_MS)
  }

  function clearQuery(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    setQuery("")
    flashRestore()
    searchInputRef.current?.focus()
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <Combobox.Root
        items={items}
        multiple={multiple}
        value={comboboxValue as never}
        onValueChange={(next) => {
          handleValueChange(next as SelectItem | SelectItem[] | null)
        }}
        isItemEqualToValue={isItemEqualToValue}
        itemToStringLabel={itemToStringLabel}
        disabled={disabled}
        autoHighlight
        modal={false}
        open={open}
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
              disabled ? "opacity-50" : "cursor-pointer",
              error && "text-danger",
            )}
            onClick={() => {
              if (!disabled) setOpen(true)
            }}
          >
            {label}
          </Combobox.Label>
        ) : null}

        <Combobox.Trigger
          id={id}
          disabled={disabled}
          nativeButton={false}
          render={<div />}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          aria-busy={loading || undefined}
          onBlur={onBlur}
          className={cn(
            "group flex w-full items-center gap-2 rounded-md border border-input-border bg-input px-3",
            "font-sans text-body-sm text-fg outline-none",
            "transition-[background-color,border-color,color,opacity,transform,scale] duration-150 ease-out",
            "focus-visible:border-accent",
            "data-popup-open:border-accent",
            "scale-100 active:scale-[0.97] data-pressed:scale-[0.97]",
            "disabled:pointer-events-none disabled:opacity-50",
            "cursor-pointer",
            error &&
              "border-danger focus-visible:border-danger data-popup-open:border-danger",
            multiple
              ? "h-auto min-h-[var(--control-height)] py-1.5"
              : "h-[var(--control-height)] py-0",
            className,
          )}
        >
          {leadingIcon ? (
            <span aria-hidden className="inline-flex shrink-0 text-fg-muted">
              {leadingIcon}
            </span>
          ) : null}

          <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            {multiple && hasValue ? (
              <>
                {visibleChips.map((item) => (
                  <span
                    key={item.value}
                    className="inline-flex max-w-[9rem] items-center gap-1 rounded-md border border-border bg-elevated py-0.5 pr-1 pl-1.5 font-sans text-caption text-fg"
                  >
                    {item.icon ? (
                      <span aria-hidden className="inline-flex shrink-0">
                        {item.icon}
                      </span>
                    ) : null}
                    <span className="truncate">{item.label}</span>
                    <button
                      type="button"
                      aria-label={`Remover ${item.label}`}
                      onClick={(event) => removeChip(item.value, event)}
                      className="inline-flex size-4 shrink-0 items-center justify-center rounded text-fg-muted hover:text-fg"
                    >
                      <RiCloseLine size={12} aria-hidden />
                    </button>
                  </span>
                ))}
                {hiddenChipCount > 0 ? (
                  <span className="shrink-0 font-sans text-caption font-medium text-fg-muted">
                    +{hiddenChipCount}
                  </span>
                ) : null}
              </>
            ) : hasValue && selectedItems[0] ? (
              <span className="flex min-w-0 items-center gap-2">
                {selectedItems[0].icon ? (
                  <span aria-hidden className="inline-flex shrink-0">
                    {selectedItems[0].icon}
                  </span>
                ) : null}
                <span className="truncate">{selectedItems[0].label}</span>
              </span>
            ) : (
              <span className="truncate text-fg-muted">{placeholder ?? ""}</span>
            )}
          </span>

          {clearable && hasValue && !disabled ? (
            <Combobox.Clear
              aria-label="Limpar seleção"
              className="inline-flex size-6 shrink-0 items-center justify-center rounded text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            >
              <RiCloseLine size={16} aria-hidden />
            </Combobox.Clear>
          ) : null}

          {loading ? (
            <RiLoader4Line
              size={16}
              aria-hidden
              className="shrink-0 animate-spin text-fg-muted"
            />
          ) : (
            <Combobox.Icon className="inline-flex shrink-0 text-fg-muted transition-transform duration-150 ease-out group-data-[popup-open]:rotate-180">
              <RiArrowDownSLine size={16} aria-hidden />
            </Combobox.Icon>
          )}
        </Combobox.Trigger>

        <Combobox.Portal container={portalContainer ?? undefined}>
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
              {searchable ? (
                <div className="border-b border-border-subtle p-1.5">
                  <div className="relative flex items-center">
                    <RiSearchLine
                      size={14}
                      aria-hidden
                      className="pointer-events-none absolute left-2.5 text-fg-muted"
                    />
                    <Combobox.Input
                      ref={searchInputRef}
                      placeholder="Pesquisar"
                      aria-label="Pesquisar"
                      className={cn(
                        "h-8 w-full rounded-md border border-input-border bg-input py-0 pl-8",
                        "font-sans text-body-sm text-fg outline-none",
                        "placeholder:text-fg-muted",
                        "focus-visible:border-accent",
                        hasQuery ? "pr-8" : "pr-2.5",
                      )}
                    />
                    {hasQuery ? (
                      <button
                        type="button"
                        aria-label="Limpar pesquisa"
                        onClick={clearQuery}
                        className="absolute right-1 inline-flex size-6 items-center justify-center rounded text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                      >
                        <RiCloseLine size={14} aria-hidden />
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div
                className={cn(
                  "max-h-[min(22.5rem,var(--available-height))] overflow-y-auto overscroll-contain p-1",
                  "transition-[filter] duration-100 ease-[cubic-bezier(0.23,1,0.32,1)]",
                  listRestoring ? "blur-[1px]" : "blur-0",
                  "motion-reduce:blur-0 motion-reduce:transition-none",
                )}
              >
                {loading ? (
                  <div className="flex flex-col gap-1 p-1" aria-hidden>
                    {[0, 1, 2].map((row) => (
                      <div
                        key={row}
                        className="h-8 animate-pulse rounded-md bg-hover"
                      />
                    ))}
                  </div>
                ) : (
                  <>
                    <Combobox.Empty
                      className={cn(
                        "px-2 py-2.5 font-sans text-body-sm text-fg-muted",
                        "transition-opacity duration-100 ease-[cubic-bezier(0.23,1,0.32,1)]",
                        "data-starting-style:opacity-0",
                        "motion-reduce:transition-none",
                      )}
                    >
                      Nenhum resultado
                    </Combobox.Empty>
                    <Combobox.List>
                      {(item: SelectItem) => (
                        <Combobox.Item
                          key={item.value}
                          value={item}
                          disabled={item.disabled}
                          className={cn(
                            "flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5",
                            "font-sans text-body-sm text-fg outline-none select-none",
                            "data-disabled:pointer-events-none data-disabled:opacity-50",
                            "data-highlighted:bg-hover",
                            "transition-[opacity,transform] ease-[cubic-bezier(0.23,1,0.32,1)]",
                            listRestoring ? "duration-[120ms]" : "duration-100",
                            "data-starting-style:opacity-0 data-starting-style:translate-y-0.5",
                            "motion-reduce:transition-opacity motion-reduce:duration-75",
                            "motion-reduce:data-starting-style:translate-y-0",
                          )}
                        >
                          {item.icon ? (
                            <span
                              aria-hidden
                              className="inline-flex shrink-0 text-fg-muted"
                            >
                              {item.icon}
                            </span>
                          ) : null}
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate">{item.label}</span>
                            {item.description ? (
                              <span className="truncate font-sans text-caption text-fg-muted">
                                {item.description}
                              </span>
                            ) : null}
                          </span>
                          <Combobox.ItemIndicator className="inline-flex shrink-0 text-fg">
                            <RiCheckLine size={16} aria-hidden />
                          </Combobox.ItemIndicator>
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
