import {
  BOARD_COLUMNS,
  BOARD_COLUMN_DOT,
  BOARD_COLUMN_LABELS,
} from "@/lib/leads/board"
import { cn } from "cn"
import { Skeleton } from "@/components/ui/skeleton"

export default function LeadsLoading() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-[var(--page-padding-x)] py-4">
      <h1 className="sr-only">Leads</h1>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <div className="flex min-w-0 shrink-0 flex-col gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border/70 pb-2">
            <Skeleton className="h-7 min-w-0 flex-1 basis-48 max-w-xs rounded-md" />
            <Skeleton
              className="h-7 w-40 shrink-0 rounded-md"
              style={{ animationDelay: " 40ms" }}
            />
            <Skeleton
              className="h-7 w-28 shrink-0 rounded-md"
              style={{ animationDelay: " 80ms" }}
            />
            <Skeleton
              className="h-7 w-40 shrink-0 rounded-md"
              style={{ animationDelay: " 120ms" }}
            />
            <Skeleton
              className="ml-auto h-7 w-36 shrink-0 rounded-md"
              style={{ animationDelay: " 160ms" }}
            />
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Skeleton
              className="h-7 w-40 shrink-0 rounded-md"
              style={{ animationDelay: " 200ms" }}
            />
            <Skeleton
              className="h-7 w-40 shrink-0 rounded-md"
              style={{ animationDelay: " 240ms" }}
            />
            <Skeleton
              className="h-7 w-40 shrink-0 rounded-md"
              style={{ animationDelay: " 280ms" }}
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3">
          <Skeleton className="h-3 w-40 rounded-md" />
          <Skeleton
            className="h-3 w-48 rounded-md"
            style={{ animationDelay: " 40ms" }}
          />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 items-stretch gap-3 overflow-x-auto overflow-y-hidden pb-1">
          {BOARD_COLUMNS.map((columnId, index) => (
            <section
              key={columnId}
              className="flex h-full w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card"
            >
              <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/70 px-3 py-2.5">
                <h2 className="font-heading flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      BOARD_COLUMN_DOT[columnId],
                    )}
                  />
                  {BOARD_COLUMN_LABELS[columnId]}
                </h2>
                <Skeleton
                  className="h-3 w-6 rounded-md"
                  style={{ animationDelay: `${index * 40}ms` }}
                />
              </header>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2">
                {Array.from({ length: 3 }, (_, cardIndex) => (
                  <Skeleton
                    key={cardIndex}
                    className="h-[4.5rem] rounded-lg"
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
