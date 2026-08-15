import type { LeadStatus } from "@/lib/leads/status"

export const BOARD_COLUMNS = [
  "new",
  "contacting",
  "follow_up",
  "denied",
] as const

export type BoardColumnId = (typeof BOARD_COLUMNS)[number]

export const BOARD_COLUMN_LABELS: Record<BoardColumnId, string> = {
  new: "Novo",
  contacting: "Em contato",
  follow_up: "Retorno",
  denied: "Negado",
}

export const BOARD_COLUMN_DOT: Record<BoardColumnId, string> = {
  new: "bg-fg-muted",
  contacting: "bg-accent",
  follow_up: "bg-warning",
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
    case "denied":
      return "denied"
    case "interested":
      return null
  }
}

export function isLegalBoardMove(
  from: BoardColumnId,
  to: BoardColumnId,
): boolean {
  if (from === to) return false
  if (from === "new") return to === "contacting"
  if (from === "contacting") return to === "follow_up" || to === "denied"
  if (from === "follow_up") return to === "denied"
  return false
}

type GroupableLead = {
  status: LeadStatus
  next_follow_up_at: string | null
  created_at: string
  company_name: string
}

function compareFollowUp<T extends GroupableLead>(left: T, right: T): number {
  const leftTime = left.next_follow_up_at ?? ""
  const rightTime = right.next_follow_up_at ?? ""
  if (leftTime !== rightTime) return leftTime.localeCompare(rightTime)
  return left.company_name.localeCompare(right.company_name, "pt-BR")
}

function compareCreatedDesc<T extends GroupableLead>(left: T, right: T): number {
  if (left.created_at !== right.created_at) {
    return right.created_at.localeCompare(left.created_at)
  }
  return left.company_name.localeCompare(right.company_name, "pt-BR")
}

export function groupLeadsByColumn<T extends GroupableLead>(
  leads: T[],
): Record<BoardColumnId, T[]> {
  const grouped: Record<BoardColumnId, T[]> = {
    new: [],
    contacting: [],
    follow_up: [],
    denied: [],
  }

  for (const lead of leads) {
    const column = columnForStatus(lead.status)
    if (!column) continue
    grouped[column].push(lead)
  }

  grouped.follow_up.sort(compareFollowUp)
  grouped.new.sort(compareCreatedDesc)
  grouped.contacting.sort(compareCreatedDesc)
  grouped.denied.sort(compareCreatedDesc)

  return grouped
}
