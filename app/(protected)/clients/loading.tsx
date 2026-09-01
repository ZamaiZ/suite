export default function ClientsLoading() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-[var(--page-padding-x)] py-4">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <span className="h-8 w-40 animate-pulse rounded-md bg-hover" />
        <span
          className="h-4 w-72 animate-pulse rounded-md bg-hover"
          style={{ animationDelay: "40ms" }}
        />
        <span
          className="mt-2 h-16 animate-pulse rounded-xl bg-hover"
          style={{ animationDelay: "80ms" }}
        />
        <span
          className="h-16 animate-pulse rounded-xl bg-hover"
          style={{ animationDelay: "120ms" }}
        />
        <span
          className="h-16 animate-pulse rounded-xl bg-hover"
          style={{ animationDelay: "160ms" }}
        />
      </div>
    </div>
  )
}
