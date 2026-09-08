import type React from "react"

type ShowcaseSectionProps = {
  title: string
  description: string
  documentationHref: string
  composition: string
  children: React.ReactNode
  notes?: string
}

export function ShowcaseSection({
  title,
  description,
  documentationHref,
  composition,
  children,
  notes,
}: ShowcaseSectionProps) {
  return (
    <section
      className="scroll-mt-6 rounded-xl border border-border bg-card p-4 shadow-xs"
      aria-labelledby={`showcase-${title}`}
    >
      <div className="mb-4 flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id={`showcase-${title}`}
            className="font-heading text-xl font-semibold text-foreground"
          >
            {title}
          </h2>
          <p className="mt-1 max-w-3xl text-xs/relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        <a
          className="text-xs/relaxed font-medium text-primary underline-offset-4 hover:underline"
          href={documentationHref}
          target="_blank"
          rel="noreferrer"
        >
          Documentação
        </a>
      </div>
      <div className="rounded-lg border border-dashed border-border bg-background p-4">
        {children}
      </div>
      <div className="mt-3 grid gap-2 text-xs/relaxed text-muted-foreground sm:grid-cols-2">
        <p>
          <span className="font-medium text-foreground">Composição: </span>
          {composition}
        </p>
        <p>
          <span className="font-medium text-foreground">Tokens: </span>usa os
          tokens shadcn globais de cor, superfície e foco.
        </p>
      </div>
      {notes ? (
        <p className="mt-2 text-xs/relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Acessibilidade: </span>
          {notes}
        </p>
      ) : null}
    </section>
  )
}
