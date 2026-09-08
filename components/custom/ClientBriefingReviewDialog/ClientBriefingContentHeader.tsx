"use client"

import { RiArrowLeftLine, RiPencilLine } from "react-icons/ri"
import type { StaffBriefingOverview } from "@/app/actions/briefing"
import { Button } from "@/components/ui/button"
import { formatDateTimeShort } from "@/lib/date-time"
import type { ClientBriefingArea } from "./ClientBriefingNavigationRail"

const STATE_LABEL: Record<string, string> = {
  empty: "Não iniciado",
  in_progress: "Em andamento",
  completed: "Concluído",
}

export function ClientBriefingContentHeader({
  area,
  step,
  editing,
  editAvailable,
  busy,
  onBackToOverview,
  onEditToggle,
}: {
  area: ClientBriefingArea
  step?: StaffBriefingOverview["steps"][number]
  editing: boolean
  editAvailable: boolean
  busy: boolean
  onBackToOverview: () => void
  onEditToggle: () => void
}) {
  const stepDetail = area === "briefing" && step

  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-popover/70 px-4 py-3 sm:px-5">
      <div className="min-w-0">
        {stepDetail ? (
          <div className="flex items-start gap-2">
            <Button
              type="button"
              variant="ghost"
              aria-label="Voltar ao briefing"
              disabled={busy}
              onClick={onBackToOverview}
              size="icon-lg"
              className="mt-0.5 shrink-0"
            >
              <RiArrowLeftLine size={18} aria-hidden />
            </Button>
            <div className="min-w-0">
              <p className="text-xs/relaxed font-medium tracking-wide text-muted-foreground uppercase">
                Briefing / etapa
              </p>
              <h3 className="truncate font-heading text-xl font-semibold text-foreground">
                {step.label}
              </h3>
              <p className="mt-1 text-xs/relaxed text-muted-foreground">
                {STATE_LABEL[step.state]}
                {step.updatedAt
                  ? ` · ${formatDateTimeShort(step.updatedAt)}`
                  : ""}
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs/relaxed font-medium tracking-wide text-muted-foreground uppercase">
              {area === "contact" ? "Contato e kickoff" : "Briefing"}
            </p>
            <h3 className="font-heading text-xl font-semibold text-foreground">
              {area === "contact"
                ? "Gestão do kickoff"
                : "Acompanhamento do briefing"}
            </h3>
            <p className="mt-1 text-xs/relaxed text-muted-foreground">
              {area === "contact"
                ? "Histórico, agenda e próximos passos do cliente."
                : "Etapas, respostas e materiais registrados pelo cliente."}
            </p>
          </>
        )}
      </div>

      {stepDetail && editAvailable ? (
        <Button
          type="button"
          variant={editing ? "secondary" : "ghost"}
          disabled={busy}
          onClick={onEditToggle}
          className="shrink-0"
        >
          {!editing ? (
            <RiPencilLine size={16} aria-hidden data-icon="inline-start" />
          ) : null}
          {editing ? "Concluir edição" : "Editar"}
        </Button>
      ) : null}
    </header>
  )
}
