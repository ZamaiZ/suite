export default function ProtectedLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-[var(--page-padding-x)] py-8">
      <span className="h-3 w-24 animate-pulse rounded-md bg-hover" />
      <span
        className="h-8 w-48 animate-pulse rounded-md bg-hover"
        style={{ animationDelay: "40ms" }}
      />
      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
        <span
          className="h-10 w-full max-w-xl animate-pulse rounded-md bg-hover"
          style={{ animationDelay: "80ms" }}
        />
        <span
          className="h-40 w-full animate-pulse rounded-xl bg-hover"
          style={{ animationDelay: "120ms" }}
        />
        <span
          className="h-40 w-full animate-pulse rounded-xl bg-hover"
          style={{ animationDelay: "160ms" }}
        />
      </div>
    </div>
  )
}
