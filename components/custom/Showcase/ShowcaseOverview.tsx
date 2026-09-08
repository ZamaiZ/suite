import Link from "next/link"
import { SHOWCASE_CATEGORIES, SHOWCASE_COMPONENT_TOTAL } from "./showcase-registry"

export function ShowcaseOverview() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-[var(--page-padding-x)] py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="max-w-3xl">
          <p className="text-caption font-semibold tracking-widest text-primary uppercase">Sistema de interface</p>
          <h1 className="mt-2 font-display text-display-lg font-semibold text-foreground">Showcase shadcn</h1>
          <p className="mt-3 text-body text-muted-foreground">Referência protegida dos {SHOWCASE_COMPONENT_TOTAL} módulos shadcn em minúsculas instalados neste projeto. Os previews preservam o tema shadcn gerado e não usam os wrappers PascalCase do produto.</p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {SHOWCASE_CATEGORIES.map((category) => {
            const Icon = category.icon
            return <Link key={category.id} href={category.href} className="group rounded-xl border border-border bg-card p-5 shadow-card transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <Icon aria-hidden className="size-5 text-primary" />
              <h2 className="mt-6 font-display text-title font-semibold text-foreground">{category.label}</h2>
              <p className="mt-1 text-body-sm text-muted-foreground">{category.description}</p>
              <p className="mt-5 text-caption font-semibold text-primary">{category.componentCount} componentes</p>
            </Link>
          })}
        </div>
      </div>
    </div>
  )
}
