import { Skeleton } from "@/components/ui/skeleton"
export default function ProtectedLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-[var(--page-padding-x)] py-8">
      <Skeleton className="h-3 w-24 rounded-md" />
      <Skeleton
        className="h-8 w-48 rounded-md"
        style={{ animationDelay: " 40ms" }}
      />
      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
        <Skeleton
          className="h-10 w-full max-w-xl rounded-md"
          style={{ animationDelay: " 80ms" }}
        />
        <Skeleton
          className="h-40 w-full rounded-xl"
          style={{ animationDelay: " 120ms" }}
        />
        <Skeleton
          className="h-40 w-full rounded-xl"
          style={{ animationDelay: " 160ms" }}
        />
      </div>
    </div>
  )
}
