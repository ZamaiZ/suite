export default function ProspectingDetailLoading() {
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-[var(--page-padding-x)] py-[var(--page-padding-y)]">
      <div className="mx-auto flex h-full w-full max-w-[96rem] animate-pulse flex-col gap-4">
        <div className="shrink-0 border-b border-border pb-4">
          <span className="block h-6 w-24 rounded-md bg-accent" />
          <span className="mt-3 block h-8 w-80 max-w-full rounded-md bg-accent" />
          <span className="mt-2 block h-3 w-48 rounded-sm bg-accent" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-20 rounded-lg border border-border bg-card"
              />
            ))}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <span className="block h-7 w-full max-w-sm rounded-md bg-accent" />
          <span className="block h-7 w-40 rounded-md bg-accent" />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card">
          <div className="h-10 border-b border-border bg-accent/60" />
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="h-14 border-b border-border last:border-0"
            />
          ))}
        </div>
      </div>
    </main>
  )
}
