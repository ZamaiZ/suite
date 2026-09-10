"use client"

import { useState } from "react"
import { RiCheckLine } from "react-icons/ri"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export type StepNotesStatus = "idle" | "saving" | "saved" | "error"

/**
 * Campo livre do analista com autosave, usado no pé da coluna de oportunidades
 * das etapas. Nasceu como `LeadGbpNotesCard`; a variante `card`, que embrulhava
 * o campo num cartão próprio, morreu sem uso quando o bloco do analista ganhou
 * moldura — e saiu junto com o nome de GBP.
 */
export function StepNotesField({
  id,
  syncKey,
  initialValue,
  canEdit,
  status,
  errorMessage,
  maxLength,
  onDraftChange,
  onRetry,
  className,
  placeholder,
  title,
  hidden = false,
}: {
  id: string
  /**
   * Muda quando o registro editado muda — perfil, canal. É o que re-sincroniza
   * o valor local com o do servidor, e só então.
   */
  syncKey: string
  initialValue: string
  canEdit: boolean
  status: StepNotesStatus
  errorMessage: string | null
  maxLength: number
  onDraftChange: (value: string) => void
  onRetry: () => void
  className?: string
  placeholder: string
  title: string
  /**
   * Esconde sem desmontar. O valor vive num `useState` local: desmontar
   * devolveria o textarea ao valor do servidor e comeria o rascunho.
   */
  hidden?: boolean
}) {
  const [value, setValue] = useState(initialValue)

  // Ajuste de estado quando a prop muda: no render, não em efeito.
  const [syncedFrom, setSyncedFrom] = useState(syncKey)
  if (syncedFrom !== syncKey) {
    setSyncedFrom(syncKey)
    setValue(initialValue)
  }

  function handleChange(next: string) {
    setValue(next)
    onDraftChange(next)
  }

  if (!canEdit) {
    return (
      <div hidden={hidden} className={className}>
        <p className="mb-1 text-[11px] font-medium text-muted-foreground">
          {title}
        </p>
        {initialValue ? (
          <p className="whitespace-pre-wrap text-xs/relaxed text-muted-foreground">
            {initialValue}
          </p>
        ) : (
          <p className="text-xs/relaxed text-muted-foreground">
            Nada registrado nesta etapa.
          </p>
        )}
      </div>
    )
  }

  return (
    <div hidden={hidden} className={className}>
      <label htmlFor={id} className="sr-only">
        {title}
      </label>
      <Textarea
        id={id}
        value={value}
        maxLength={maxLength}
        rows={4}
        onChange={(event) => handleChange(event.target.value)}
        className="h-24 min-h-0 resize-none rounded-lg bg-background text-xs/[1.6]"
        placeholder={placeholder}
      />
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] tabular-nums text-muted-foreground">
          {value.length}/{maxLength}
        </p>
        <div className="flex items-center gap-2">
          {status === "saving" ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
              aria-live="polite"
            >
              <Spinner aria-hidden className="size-3" />
              Salvando…
            </span>
          ) : null}
          {status === "saved" ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] text-success"
              aria-live="polite"
            >
              <RiCheckLine size={12} aria-hidden />
              Salvo agora
            </span>
          ) : null}
          {status === "error" ? (
            <>
              <span role="alert" className="text-[11px] text-destructive">
                {errorMessage ?? "Não foi possível salvar."}
              </span>
              <Button
                type="button"
                variant="ghost"
                className="h-6 px-1.5 text-[11px]"
                onClick={onRetry}
              >
                Salvar notas
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
