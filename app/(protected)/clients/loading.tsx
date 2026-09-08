export default function ClientsLoading() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-[var(--page-padding-x)] py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 animate-pulse">
        <div>
          <span className="block h-3 w-28 rounded bg-accent" />
          <span className="mt-3 block h-9 w-48 rounded bg-accent" />
          <span className="mt-2 block h-4 w-80 rounded bg-accent" />
        </div>
        <div className="h-16 rounded-xl border border-border/70 bg-accent" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 rounded-xl border border-border/70 bg-accent"
            />
          ))}
        </div>
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-20 border-b border-border/70 bg-accent/60 last:border-0"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
