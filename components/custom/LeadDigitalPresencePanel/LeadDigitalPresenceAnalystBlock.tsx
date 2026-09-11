"use client"

import { useEffect, useRef, useState } from "react"
import { RiArrowDownSLine, RiArrowUpSLine } from "react-icons/ri"
import { StepNotesField } from "@/components/custom/LeadStepShell"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { cn } from "cn"
import {
  DIGITAL_PRESENCE_NOTES_MAX,
  DIGITAL_PRESENCE_REVIEW_NOTE_MAX,
} from "@/lib/leads/digital-presence-review"
import type { DigitalPresenceController } from "./use-digital-presence-controller"

type Field = "notes" | "brand"

const BLOCK_ID = "presence-analyst-block"

/**
 * Os dois campos ficam **montados** o tempo todo; o inativo recebe `hidden`.
 * `StepNotesField` guarda o valor em `useState(initialValue)` e só
 * re-sincroniza quando a chave muda — desmontar o inativo devolveria o textarea
 * ao valor do servidor e comeria o texto digitado dentro dos 800ms de debounce,
 * ou depois de um erro de salvamento.
 */
export function LeadDigitalPresenceAnalystBlock({
  controller,
  canEdit,
  open,
  onOpenChange,
  focusSignal,
}: {
  controller: DigitalPresenceController
  /** Decidido pela view: é `canEdit` do controller menos o modo reunião. */
  canEdit: boolean
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
  const { saveStatus, saveError, review, syncKey } = controller
  const errorMessage = saveStatus === "error" ? saveError : null
  const brand = review.identity.note

  useEffect(() => {
    if (focusSignal === 0) return
    // Um frame depois do `hidden` sair, senão o `focus()` cai num elemento que
    // ainda não é focável.
    const raf = requestAnimationFrame(() => {
      bodyRef.current?.querySelector("textarea")?.focus()
    })
    return () => cancelAnimationFrame(raf)
  }, [focusSignal])

  const dirtyHint = !open && (review.notes || brand) ? "preenchido" : null

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
          aria-label={
            open ? "Recolher bloco do analista" : "Abrir bloco do analista"
          }
          aria-expanded={open}
          aria-controls={BLOCK_ID}
          onClick={() => onOpenChange(!open)}
        >
          {open ? (
            <RiArrowDownSLine size={14} aria-hidden />
          ) : (
            <RiArrowUpSLine size={14} aria-hidden />
          )}
        </Button>
      </div>

      <div id={BLOCK_ID} ref={bodyRef} hidden={!open}>
        {canEdit ? (
          <div className="mt-2 flex rounded-lg bg-border/60 p-[3px]">
            {(
              [
                ["notes", "Notas da etapa"],
                ["brand", "Achado de marca"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setField(id)}
                aria-pressed={field === id}
                className={cn(
                  "h-6.5 flex-1 cursor-pointer rounded-md text-[11px] font-semibold transition-colors",
                  field === id
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-2">
          <StepNotesField
            hidden={canEdit && field !== "notes"}
            id={`presence-notes-${syncKey}`}
            syncKey={syncKey}
            initialValue={review.notes}
            canEdit={canEdit}
            status={saveStatus}
            errorMessage={errorMessage}
            maxLength={DIGITAL_PRESENCE_NOTES_MAX}
            title="Notas da etapa"
            placeholder="Contexto das redes, histórico com a agência, o que a coleta não vê"
            onDraftChange={controller.handleNotesDraftChange}
            onRetry={controller.retrySave}
          />
          {/*
            O "Achado de marca" é a nota do veredito de identidade: ela já
            persistia, mas só existia dentro do card no fim do scroll.
          */}
          <StepNotesField
            hidden={canEdit && field !== "brand"}
            id={`presence-brand-${syncKey}`}
            syncKey={syncKey}
            initialValue={brand}
            canEdit={canEdit}
            status={saveStatus}
            errorMessage={errorMessage}
            maxLength={DIGITAL_PRESENCE_REVIEW_NOTE_MAX}
            title="Achado de marca"
            placeholder="Logo, foto e cores das redes estão consistentes com a marca?"
            onDraftChange={(note) =>
              controller.handleReviewChange({
                ...review,
                identity: { ...review.identity, note },
              })
            }
            onRetry={controller.retrySave}
          />
        </div>

        {canEdit ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Salva automaticamente enquanto você digita.
          </p>
        ) : null}
      </div>
    </div>
  )
}
