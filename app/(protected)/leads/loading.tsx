import {
  BOARD_COLUMNS,
  BOARD_COLUMN_DOT,
  BOARD_COLUMN_LABELS,
} from "@/lib/leads/board"
import { cn } from "@/lib/cn"

export default function LeadsLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-[var(--page-padding-x)] py-4">
      <h1 className="sr-only">Leads</h1>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
          <span className="h-[var(--control-height)] w-full animate-pulse rounded-md bg-hover sm:w-52 sm:flex-none" />
          <span
            className="h-[var(--control-height)] w-44 animate-pulse rounded-md bg-hover"
            style={{ animationDelay: "40ms" }}
          />
          <span
            className="h-[var(--control-height)] w-28 animate-pulse rounded-md bg-hover"
            style={{ animationDelay: "80ms" }}
          />
          <span
            className="h-[var(--control-height)] w-40 animate-pulse rounded-md bg-hover"
            style={{ animationDelay: "120ms" }}
          />
          <span
            className="h-[var(--control-height)] w-36 animate-pulse rounded-md bg-hover sm:ml-auto"
            style={{ animationDelay: "160ms" }}
          />
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3">
          <span className="h-3 w-40 animate-pulse rounded-md bg-hover" />
          <span
            className="h-3 w-48 animate-pulse rounded-md bg-hover"
            style={{ animationDelay: "40ms" }}
          />
        </div>
        <div className="flex min-h-0 flex-1 items-stretch gap-3 overflow-x-auto pb-1">
          {BOARD_COLUMNS.map((columnId, index) => (
            <section
              key={columnId}
              className="flex h-full w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-surface"
            >
              <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border-subtle px-3 py-2.5">
                <h2 className="flex items-center gap-2 font-sans text-body-sm font-semibold text-fg">
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      BOARD_COLUMN_DOT[columnId],
                    )}
                  />
                  {BOARD_COLUMN_LABELS[columnId]}
                </h2>
                <span
                  className="h-3 w-6 animate-pulse rounded-md bg-hover"
                  style={{ animationDelay: `${index * 40}ms` }}
                />
              </header>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2">
                {Array.from({ length: 3 }, (_, cardIndex) => (
                  <span
                    key={cardIndex}
                    className="h-[4.5rem] animate-pulse rounded-lg bg-hover"
                    style={{
                      animationDelay: `${index * 40 + cardIndex * 40}ms`,
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
