export default function ToolsSettingsLoading() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-[var(--page-padding-x)] py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <p className="font-sans text-caption font-medium uppercase tracking-widest text-fg-muted">
            Configurações
          </p>
          <h1 className="font-display text-display font-semibold text-fg">
            Ferramentas
          </h1>
          <p className="max-w-3xl font-sans text-body-sm text-fg-secondary">
            Fonte dos dados de análise do Google Business Profile. Só
            administradores alteram.
          </p>
        </header>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-card sm:p-6">
          <span className="block h-10 w-full max-w-sm animate-pulse rounded-md bg-hover" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <span className="block h-10 animate-pulse rounded-md bg-hover" />
            <span className="block h-10 animate-pulse rounded-md bg-hover" />
          </div>
        </div>
      </div>
    </div>
  )
}
