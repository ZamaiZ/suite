"use client"

import { useState } from "react"
import { LeadGbpNotesCard } from "./LeadGbpNotesCard"
import type { GbpProfileController } from "./use-gbp-profile-controller"
import { cn } from "cn"

type Field = "notes" | "reputation"

/**
 * Os dois campos ficam **montados** o tempo todo; o inativo recebe `hidden`.
 * `LeadGbpNotesCard` guarda o valor em `useState(initialValue)` e só
 * re-sincroniza quando o perfil muda — desmontar o inativo devolveria o
 * textarea ao valor do servidor, e o texto digitado dentro dos 800ms de
 * debounce, ou depois de um erro de salvamento, voltaria atrás na tela.
 */
export function LeadGbpAnalystBlock({
  controller,
}: {
  controller: GbpProfileController
}) {
  const [field, setField] = useState<Field>("notes")
  const { profile, canEdit, notesStatus, error } = controller
  const errorMessage = notesStatus === "error" ? error : null

  return (
    <div className="border-t border-border/70 bg-popover px-4 pt-3 pb-4">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        Bloco do analista
      </p>

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
  )
}
