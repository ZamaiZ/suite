import { CheckIcon } from "lucide-react"

export function CatalogRoster({ names }: { names: string[] }) {
  return <ul className="grid gap-2 text-body-sm sm:grid-cols-2 lg:grid-cols-3">{names.map((name) => <li key={name} className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-foreground"><CheckIcon aria-hidden className="size-3.5 text-primary" />{name}</li>)}</ul>
}
