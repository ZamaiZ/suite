import { Skeleton } from "@/components/ui/skeleton"
export default function ToolsSettingsLoading() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-[var(--page-padding-x)] py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <p className="text-xs/relaxed font-medium uppercase tracking-widest text-muted-foreground">
            Configurações
          </p>
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Ferramentas
          </h1>
          <p className="max-w-3xl text-xs/relaxed text-muted-foreground">
            Fonte dos dados de análise do Google Business Profile. Só
            administradores alteram.
          </p>
        </header>
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-6">
          <Skeleton className="block h-10 w-full max-w-sm rounded-md" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Skeleton className="block h-10 rounded-md" />
            <Skeleton className="block h-10 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  )
}
