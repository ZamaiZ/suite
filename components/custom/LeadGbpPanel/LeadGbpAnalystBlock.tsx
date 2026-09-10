"use client"

import { useEffect, useRef, useState } from "react"
import { RiArrowDownSLine, RiArrowUpSLine } from "react-icons/ri"
import { LeadGbpNotesCard } from "./LeadGbpNotesCard"
import type { GbpProfileController } from "./use-gbp-profile-controller"
import { Button } from "@/components/ui/button"
import { cn } from "cn"

type Field = "notes" | "reputation"

const BLOCK_ID = "gbp-analyst-block"

/**
 * Os dois campos ficam **montados** o tempo todo; o inativo recebe `hidden`.
 * `LeadGbpNotesCard` guarda o valor em `useState(initialValue)` e só
 * re-sincroniza quando o perfil muda — desmontar o inativo devolveria o
 * textarea ao valor do servidor, e o texto digitado dentro dos 800ms de
 * debounce, ou depois de um erro de salvamento, voltaria atrás na tela.
 *
 * O mesmo vale para o colapso do bloco inteiro: fechar esconde, nunca desmonta.
 */
export function LeadGbpAnalystBlock({
  controller,
  open,
  onOpenChange,
  focusSignal,
}: {
  controller: GbpProfileController
  open: boolean
  onOpenChange: (next: boolean) => void
  /**
   * Contador que o rail incrementa quando o lápis pede foco aqui. O efeito só
   * chama `focus()` — abrir o bloco é responsabilidade de quem pediu, senão
   * seria `setState` síncrono dentro de efeito.
   */
  focusSignal: number
}) {
  const [field, setField] = useState<Field>("notes")
  const bodyRef = useRef<HTMLDivElement>(null)
  const { profile, canEdit, notesStatus, error } = controller
  const errorMessage = notesStatus === "error" ? error : null

  useEffect(() => {
    if (focusSignal === 0) return
    // Um frame depois do `hidden` sair, senão o `focus()` cai num elemento que
    // ainda não é focável.
    const raf = requestAnimationFrame(() => {
      bodyRef.current?.querySelector("textarea")?.focus()
    })
    return () => cancelAnimationFrame(raf)
  }, [focusSignal])

  const dirtyHint =
    !open && (profile.notes || profile.reputation_note) ? "preenchido" : null

  return (
    <div className="border-t border-border/70 bg-popover px-4 pt-3 pb-4">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Bloco do analista
        </p>
        {dirtyHint ? (
          <span className="text-[10px] text-muted-foreground">{dirtyHint}</span>
        ) : null}
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
                ["reputation", "Leitura da reputação"],
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
          <LeadGbpNotesCard
            variant="rail"
            hidden={canEdit && field !== "notes"}
            id={`gbp-notes-${profile.id}`}
            profileId={profile.id}
            initialValue={profile.notes ?? ""}
            canEdit={canEdit}
            status={notesStatus}
            errorMessage={errorMessage}
            onDraftChange={controller.handleDraftChange}
            onRetry={() => {
              void controller.persistNotes()
            }}
          />
          <LeadGbpNotesCard
            variant="rail"
            hidden={canEdit && field !== "reputation"}
            id={`gbp-reputation-${profile.id}`}
            profileId={profile.id}
            initialValue={profile.reputation_note ?? ""}
            canEdit={canEdit}
            status={notesStatus}
            errorMessage={errorMessage}
            onDraftChange={controller.handleReputationDraftChange}
            onRetry={() => {
              void controller.persistNotes()
            }}
            title="Leitura da reputação"
            placeholder="Sentimento das avaliações, temas recorrentes, o que os números não contam"
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
