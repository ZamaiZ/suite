"use client"

import { useState } from "react"
import { RiCloseLine } from "react-icons/ri"
import { cn } from "@/lib/cn"
import type { BriefingChipFieldProps } from "./BriefingChipField.types"

function splitTokens(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

export function BriefingChipField({
  id,
  label,
  values,
  onChange,
  placeholder = "Digite e pressione Enter",
  disabled,
}: BriefingChipFieldProps) {
  const [draft, setDraft] = useState("")

  function addTokens(raw: string) {
    const next = splitTokens(raw)
    if (next.length === 0) return
    const merged = [...values]
    for (const token of next) {
      if (!merged.some((item) => item.toLowerCase() === token.toLowerCase())) {
        merged.push(token)
      }
    }
    onChange(merged)
    setDraft("")
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label
        htmlFor={id}
        className={cn(
          "font-sans text-body-sm font-medium text-fg-secondary",
          disabled ? "opacity-50" : "cursor-text",
        )}
      >
        {label}
      </label>
      <div
        className={cn(
          "flex min-h-[var(--control-height)] flex-wrap items-center gap-1.5 rounded-md border border-input-border bg-input px-2 py-1.5",
          "transition-[border-color] duration-150 ease-out",
          "focus-within:border-accent",
          disabled && "opacity-50",
        )}
      >
        {values.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 font-sans text-caption font-medium text-accent"
          >
            {item}
            <button
              type="button"
              disabled={disabled}
              aria-label={`Remover ${item}`}
              onClick={() => onChange(values.filter((value) => value !== item))}
              className="inline-flex size-4 items-center justify-center rounded-sm text-accent/70 transition-colors hover:text-accent"
            >
              <RiCloseLine size={12} aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          disabled={disabled}
          placeholder={values.length === 0 ? placeholder : undefined}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault()
              addTokens(draft)
            }
            if (event.key === "Backspace" && draft.length === 0 && values.length > 0) {
              onChange(values.slice(0, -1))
            }
          }}
          onBlur={() => {
            if (draft.trim()) addTokens(draft)
          }}
          className="min-w-28 flex-1 bg-transparent py-0.5 font-sans text-body-sm text-fg outline-none placeholder:text-fg-muted"
        />
      </div>
    </div>
  )
}
