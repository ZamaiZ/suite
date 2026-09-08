"use client"

import { useEffect, useState } from "react"
import { RiCheckLine, RiLoader4Line } from "react-icons/ri"
import { LeadGbpCard } from "./LeadGbpCard"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/cn"
import { GBP_NOTES_MAX } from "@/lib/leads/gbp"

export type GbpNotesStatus = "idle" | "saving" | "saved" | "error"

export function LeadGbpNotesCard({
  id,
  profileId,
  initialValue,
  canEdit,
  status,
  errorMessage,
  onDraftChange,
  onRetry,
  className,
  placeholder = "Posts, Q&A, respostas, ranking — o que a API não vê",
  title = "Notas da etapa",
}: {
  id: string
  profileId: string
  initialValue: string
  canEdit: boolean
  status: GbpNotesStatus
  errorMessage: string | null
  onDraftChange: (value: string) => void
  onRetry: () => void
  className?: string
  placeholder?: string
  title?: string
}) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [profileId])

  function handleChange(next: string) {
    setValue(next)
    onDraftChange(next)
  }

  if (!canEdit) {
    return (
      <LeadGbpCard title={title} className={className}>
        {initialValue ? (
          <p className="whitespace-pre-wrap font-sans text-caption text-fg-secondary">
            {initialValue}
          </p>
        ) : (
          <p className="font-sans text-caption text-fg-muted">
            Nada registrado nesta etapa.
          </p>
        )}
      </LeadGbpCard>
    )
  }

  return (
    <LeadGbpCard title={title} className={className}>
      <label htmlFor={id} className="sr-only">
        {title}
      </label>
      <textarea
        id={id}
        value={value}
        maxLength={GBP_NOTES_MAX}
        rows={6}
        onChange={(event) => handleChange(event.target.value)}
        className={cn(
          "w-full resize-y rounded-md border border-input-border bg-input px-3 py-2",
          "font-sans text-body-sm text-fg outline-none",
          "placeholder:text-fg-muted",
          "focus-visible:border-accent",
        )}
        placeholder={placeholder}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-sans text-caption tabular-nums text-fg-muted">
          {value.length}/{GBP_NOTES_MAX}
        </p>
        <div className="flex items-center gap-2">
          {status === "saving" ? (
            <span
              className="inline-flex items-center gap-1 font-sans text-caption text-fg-muted"
              aria-live="polite"
            >
              <RiLoader4Line size={14} aria-hidden className="animate-spin" />
              Salvando…
            </span>
          ) : null}
          {status === "saved" ? (
            <span
              className="inline-flex items-center gap-1 font-sans text-caption text-success"
              aria-live="polite"
            >
              <RiCheckLine size={14} aria-hidden />
              Salvo agora
            </span>
          ) : null}
          {status === "error" ? (
            <>
              <span role="alert" className="font-sans text-caption text-danger">
                {errorMessage ?? "Não foi possível salvar."}
              </span>
              <Button type="button" variant="ghost" onClick={onRetry}>
                Salvar notas
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </LeadGbpCard>
  )
}
