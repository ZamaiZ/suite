export function ClientsListSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
      <div className="h-14 border-b border-border/70 bg-background/60" />
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-b border-border/70 px-4 py-4 last:border-0"
        >
          <span className="size-9 rounded-full bg-border/70" />
          <span className="flex-1 space-y-2">
            <span className="block h-3 w-1/3 rounded bg-border/70" />
            <span className="block h-2.5 w-1/2 rounded bg-border/70" />
          </span>
        </div>
      ))}
    </div>
  )
}
