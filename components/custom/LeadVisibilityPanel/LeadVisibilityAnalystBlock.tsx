"use client"

import { useEffect, useRef, useState } from "react"
import { RiArrowDownSLine, RiArrowUpSLine } from "react-icons/ri"
import { StepNotesField } from "@/components/custom/LeadStepShell"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { cn } from "cn"
import {
  VISIBILITY_NOTES_MAX,
  VISIBILITY_REVIEW_NOTE_MAX,
  VISIBILITY_REVIEW_CATALOG,
} from "@/lib/leads/visibility-review"
import type { VisibilityController } from "./use-visibility-controller"

const BLOCK_ID = "visibility-analyst-block"

const FIELDS = [
  ["notes", "Notas da etapa"],
  ["finding", "Outro achado"],
] as const

type Field = (typeof FIELDS)[number][0]

const OTHER = VISIBILITY_REVIEW_CATALOG.find((item) => item.id === "other")!

/**
 * Os dois campos ficam **montados** o tempo todo; o inativo recebe `hidden`.
 * `StepNotesField` guarda o valor em `useState(initialValue)` e só
 * re-sincroniza quando o lead muda — desmontar o inativo devolveria o textarea
 * ao valor do servidor, e o texto digitado dentro dos 800ms de debounce, ou
 * depois de um erro de salvamento, voltaria atrás na tela.
 */
export function LeadVisibilityAnalystBlock({
  controller,
  readingMode,
  open,
  onOpenChange,
  focusSignal,
}: {
  controller: VisibilityController
  readingMode: boolean
  open: boolean
  onOpenChange: (next: boolean) => void
  /**
   * Contador que o rail incrementa quando o lápis pede foco aqui. O efeito só
   * chama `focus()` — abrir o bloco é responsabilidade de quem pediu.
   */
  focusSignal: number
}) {
  const [field, setField] = useState<Field>("notes")
  const bodyRef = useRef<HTMLDivElement>(null)
  const { canEdit, saveStatus, saveError, review, notes, leadId } = controller
  const editable = canEdit && !readingMode
  const errorMessage = saveStatus === "error" ? saveError : null
  const finding = review.other.note

  useEffect(() => {
    if (focusSignal === 0) return
    // Um frame depois do `hidden` sair, senão o `focus()` cai num elemento que
    // ainda não é focável.
    const raf = requestAnimationFrame(() => {
      bodyRef.current?.querySelector("textarea")?.focus()
    })
    return () => cancelAnimationFrame(raf)
  }, [focusSignal])

  const dirtyHint = !open && (notes || finding) ? "preenchido" : null

  function setOtherNote(next: string) {
    controller.handleReviewDraftChange({
      ...review,
      other: { ...review.other, note: next },
    })
  }

  return (
    <div className="border-t border-border/70 bg-popover px-4 pt-3 pb-4">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Bloco do analista
        </p>
        {dirtyHint ? (
          <span className="text-[10px] text-muted-foreground">{dirtyHint}</span>
        ) : null}
        <Kbd className="text-[10px]">Ctrl E</Kbd>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-expanded={open}
          aria-controls={BLOCK_ID}
          aria-label={
            open ? "Recolher bloco do analista" : "Abrir bloco do analista"
          }
          className="shrink-0 text-muted-foreground"
          onClick={() => onOpenChange(!open)}
        >
          {open ? (
            <RiArrowDownSLine size={14} aria-hidden />
          ) : (
            <RiArrowUpSLine size={14} aria-hidden />
          )}
        </Button>
      </div>

      <div
        id={BLOCK_ID}
        ref={bodyRef}
        // Fechar esconde, nunca desmonta: o rascunho vive no estado do campo.
        hidden={!open}
        className="mt-2.5"
      >
        <div className="mb-2 flex gap-1">
          {FIELDS.map(([id, label]) => (
            <Button
              key={id}
              type="button"
              variant={field === id ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "flex-1 text-[11px]",
                field === id ? "" : "text-muted-foreground",
              )}
              onClick={() => setField(id)}
            >
              {label}
            </Button>
          ))}
        </div>

        <StepNotesField
          hidden={field !== "notes"}
          id={`visibility-notes-${leadId}`}
          syncKey={leadId}
          initialValue={notes}
          canEdit={editable}
          status={saveStatus}
          errorMessage={errorMessage}
          maxLength={VISIBILITY_NOTES_MAX}
          onDraftChange={controller.handleNotesDraftChange}
          onRetry={controller.retrySave}
          placeholder="O que esta coleta diz sobre o negócio?"
          title="Notas da etapa"
        />
        <StepNotesField
          hidden={field !== "finding"}
          id={`visibility-finding-${leadId}`}
          syncKey={leadId}
          initialValue={finding}
          canEdit={editable}
          status={saveStatus}
          errorMessage={errorMessage}
          maxLength={VISIBILITY_REVIEW_NOTE_MAX}
          onDraftChange={setOtherNote}
          onRetry={controller.retrySave}
          placeholder={OTHER.placeholder}
          title="Outro achado"
        />
      </div>
    </div>
  )
}
