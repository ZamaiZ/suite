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
            <span
              className="h-3 w-16 animate-pulse rounded-md bg-accent"
              style={{ animationDelay: "40ms" }}
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
                <span
                  className="size-9 shrink-0 animate-pulse rounded-full bg-accent"
                  style={{ animationDelay: `${index * 40}ms` }}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <span
                    className="block h-3.5 w-36 animate-pulse rounded-md bg-accent"
                    style={{ animationDelay: `${index * 40}ms` }}
                  />
                  <span
                    className="block h-2.5 w-48 animate-pulse rounded-md bg-accent"
                    style={{ animationDelay: `${index * 40 + 40}ms` }}
                  />
                </div>
                <span
                  className="hidden h-6 w-28 animate-pulse rounded-md bg-accent sm:block"
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
