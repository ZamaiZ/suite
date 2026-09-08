import {
  RiCalendarCheckLine,
  RiEditLine,
  RiFileList3Line,
  RiLoader4Line,
} from "react-icons/ri"
import type { ClientsSummary as Summary } from "@/app/actions/clients"
export function ClientsSummary({ summary }: { summary: Summary }) {
  const items = [
    {
      label: "Clientes",
      value: summary.total,
      icon: RiFileList3Line,
      tone: "text-primary",
    },
    {
      label: "Em andamento",
      value: summary.inProgress,
      icon: RiLoader4Line,
      tone: "text-warning",
    },
    {
      label: "Editados",
      value: summary.edited,
      icon: RiEditLine,
      tone: "text-destructive",
    },
    {
      label: "Kickoff pendente",
      value: summary.kickoffPending,
      icon: RiCalendarCheckLine,
      tone: "text-success",
    },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(({ label, value, icon: Icon, tone }) => (
        <div
          key={label}
          className="rounded-xl border border-border/70 bg-card px-4 py-3 shadow-xs"
        >
          <div
            className={`mb-2 inline-flex size-8 items-center justify-center rounded-lg bg-background ${tone}`}
          >
            <Icon size={16} aria-hidden />
          </div>
          <p className="font-heading text-xl font-semibold text-foreground">
            {value}
          </p>
          <p className="text-xs/relaxed text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  )
}
