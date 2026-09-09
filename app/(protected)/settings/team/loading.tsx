import { Skeleton } from "@/components/ui/skeleton"
export default function TeamSettingsLoading() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-[var(--page-padding-x)] py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <p className="text-xs/relaxed font-medium uppercase tracking-widest text-muted-foreground">
            Configurações
          </p>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="font-heading text-2xl font-semibold text-foreground">
              Equipe
            </h1>
            <Skeleton
              className="h-3 w-16 rounded-md"
              style={{ animationDelay: " 40ms" }}
            />
          </div>
          <p className="max-w-3xl text-xs/relaxed text-muted-foreground">
            Papéis definem o acesso. Só administradores alteram.
          </p>
        </header>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <ul className="divide-y divide-border/70">
            {Array.from({ length: 5 }, (_, index) => (
              <li key={index} className="flex items-center gap-3 px-4 py-3">
                <Skeleton
                  className="size-9 shrink-0 rounded-full"
                  style={{ animationDelay: `${index * 40}ms` }}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton
                    className="block h-3.5 w-36 rounded-md"
                    style={{ animationDelay: `${index * 40}ms` }}
                  />
                  <Skeleton
                    className="block h-2.5 w-48 rounded-md"
                    style={{ animationDelay: `${index * 40 + 40}ms` }}
                  />
                </div>
                <Skeleton
                  className="hidden h-6 w-28 rounded-md sm:block"
                  style={{ animationDelay: `${index * 40 + 80}ms` }}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
