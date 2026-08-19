import type { LeadStatus } from "@/lib/leads/status"

export const BOARD_COLUMNS = [
  "new",
  "contacting",
  "follow_up",
  "interested",
  "denied",
] as const

export type BoardColumnId = (typeof BOARD_COLUMNS)[number]

export const BOARD_COLUMN_LABELS: Record<BoardColumnId, string> = {
  new: "Novo",
  contacting: "Em contato",
  follow_up: "Retorno",
  interested: "Oportunidades",
  denied: "Negado",
}

export const BOARD_COLUMN_DOT: Record<BoardColumnId, string> = {
  new: "bg-fg-muted",
  contacting: "bg-accent",
  follow_up: "bg-warning",
  interested: "bg-success",
  denied: "bg-danger",
}

export const BOARD_COLUMN_EMPTY: Record<
  BoardColumnId,
  { title: string; body: string }
> = {
  new: {
    title: "Nenhum lead novo",
    body: "Leads sem responsável aparecem aqui",
  },
  contacting: {
    title: "Nenhum lead em contato",
    body: "Leads reivindicados ficam nesta etapa",
  },
  follow_up: {
    title: "Nenhum retorno agendado",
    body: "Ligar depois aparece aqui, ordenado pelo horário",
  },
  interested: {
    title: "Nenhuma oportunidade",
    body: "Leads com interesse e reunião agendada aparecem aqui",
  },
  denied: {
    title: "Nenhum lead negado",
    body: "Leads que não tiveram interesse aparecerão aqui",
  },
}

export function isBoardColumnId(value: unknown): value is BoardColumnId {
  return (
    typeof value === "string" &&
    (BOARD_COLUMNS as readonly string[]).includes(value)
  )
}

export function columnForStatus(status: LeadStatus): BoardColumnId | null {
  switch (status) {
    case "new":
      return "new"
    case "contacting":
      return "contacting"
    case "follow_up":
      return "follow_up"
    case "interested":
      return "interested"
    case "denied":
      return "denied"
  }
}

export function isLegalBoardMove(
  from: BoardColumnId,
  to: BoardColumnId,
): boolean {
  if (from === to) return false
  if (from === "new") return to === "contacting"
  if (from === "contacting") {
    return to === "follow_up" || to === "denied" || to === "interested"
  }
  if (from === "follow_up") return to === "denied" || to === "interested"
  return false
}

type GroupableLead = {
  status: LeadStatus
  next_follow_up_at: string | null
  last_activity_at: string | null
  created_at: string
  company_name: string
}

function compareByTime<T extends GroupableLead>(
  left: T,
  right: T,
  readTime: (lead: T) => string | null,
): number {
  const leftTime = readTime(left) ?? ""
  const rightTime = readTime(right) ?? ""
  if (leftTime !== rightTime) return leftTime.localeCompare(rightTime)
  return left.company_name.localeCompare(right.company_name, "pt-BR")
}

function recencyOf<T extends GroupableLead>(lead: T): string {
  return lead.last_activity_at ?? lead.created_at
}

function compareRecencyDesc<T extends GroupableLead>(left: T, right: T): number {
  const leftTime = recencyOf(left)
  const rightTime = recencyOf(right)
  if (leftTime !== rightTime) return rightTime.localeCompare(leftTime)
  return left.company_name.localeCompare(right.company_name, "pt-BR")
}

export function groupLeadsByColumn<T extends GroupableLead>(
  leads: T[],
): Record<BoardColumnId, T[]> {
  const grouped: Record<BoardColumnId, T[]> = {
    new: [],
    contacting: [],
    follow_up: [],
    interested: [],
    denied: [],
  }

  for (const lead of leads) {
    const column = columnForStatus(lead.status)
    if (!column) continue
    grouped[column].push(lead)
  }

  grouped.follow_up.sort((left, right) =>
    compareByTime(left, right, (lead) => lead.next_follow_up_at),
  )
  grouped.new.sort(compareRecencyDesc)
  grouped.contacting.sort(compareRecencyDesc)
  grouped.interested.sort(compareRecencyDesc)
  grouped.denied.sort(compareRecencyDesc)

  return grouped
}
