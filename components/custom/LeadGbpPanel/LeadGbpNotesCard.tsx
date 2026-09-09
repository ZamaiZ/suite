"use client"

import { useEffect, useState } from "react"
import { RiCheckLine } from "react-icons/ri"
import { LeadGbpCard } from "./LeadGbpCard"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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

  // Ajuste de estado quando a prop muda: no render, não em efeito.
  const [syncedProfileId, setSyncedProfileId] = useState(profileId)
  if (syncedProfileId !== profileId) {
    setSyncedProfileId(profileId)
    setValue(initialValue)
  }

  function handleChange(next: string) {
    setValue(next)
    onDraftChange(next)
  }

  if (!canEdit) {
    return (
      <LeadGbpCard title={title} className={className}>
        {initialValue ? (
          <p className="whitespace-pre-wrap text-xs/relaxed text-muted-foreground">
            {initialValue}
          </p>
        ) : (
          <p className="text-xs/relaxed text-muted-foreground">
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
      <Textarea
        id={id}
        value={value}
        maxLength={GBP_NOTES_MAX}
        rows={6}
        onChange={(event) => handleChange(event.target.value)}
        className="min-h-0 resize-y"
        placeholder={placeholder}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs/relaxed tabular-nums text-muted-foreground">
          {value.length}/{GBP_NOTES_MAX}
        </p>
        <div className="flex items-center gap-2">
          {status === "saving" ? (
            <span
              className="inline-flex items-center gap-1 text-xs/relaxed text-muted-foreground"
              aria-live="polite"
            >
              <Spinner aria-hidden className="size-3.5" />
              Salvando…
            </span>
          ) : null}
          {status === "saved" ? (
            <span
              className="inline-flex items-center gap-1 text-xs/relaxed text-success"
              aria-live="polite"
            >
              <RiCheckLine size={14} aria-hidden />
              Salvo agora
            </span>
          ) : null}
          {status === "error" ? (
            <>
              <span role="alert" className="text-xs/relaxed text-destructive">
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
