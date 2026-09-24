export default function ProspectingLoading() {
  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-hidden px-[var(--page-padding-x)] py-[var(--page-padding-y)]">
      <div className="mx-auto flex w-full max-w-7xl animate-pulse flex-col gap-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="block h-3 w-12 rounded-sm bg-accent" />
            <span className="mt-3 block h-9 w-44 rounded-md bg-accent" />
            <span className="mt-2 block h-4 w-96 max-w-full rounded-sm bg-accent" />
          </div>
          <span className="block h-7 w-28 rounded-md bg-accent" />
        </div>
        <div className="h-14 rounded-lg border border-border bg-card" />
        <div className="grid gap-3">
          <div className="flex justify-between">
            <span className="block h-4 w-20 rounded-sm bg-accent" />
            <span className="block h-3 w-16 rounded-sm bg-accent" />
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="h-10 border-b border-border bg-accent/60" />
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-14 border-b border-border bg-card last:border-0"
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
