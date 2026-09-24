type LocalizedCategory = {
  label: string
  aliases: readonly string[]
}

const LOCALIZED_CATEGORIES: Record<string, LocalizedCategory> = {
  construction_company: {
    label: "Empresa de construção civil",
    aliases: [
      "construção civil",
      "construtora",
      "empresa de construção",
    ],
  },
  demolition_contractor: {
    label: "Empreiteiro de demolição",
    aliases: [
      "demolição",
      "demolições",
      "empresa de demolição",
      "empreiteiro de demolição",
      "serviços de demolição",
    ],
  },
}

export function foldCategorySearch(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()
}

export function categoryLabel(name: string): string {
  const localized = LOCALIZED_CATEGORIES[name]
  if (localized) return localized.label

  return name
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ")
}

export function localizedCategoryNames(query: string): string[] {
  const needle = foldCategorySearch(query)
  if (!needle) return []

  return Object.entries(LOCALIZED_CATEGORIES).flatMap(([name, metadata]) => {
    const searchable = foldCategorySearch(
      [name, metadata.label, ...metadata.aliases].join(" "),
    )
    return searchable.includes(needle) ? [name] : []
  })
}

export function categorySearchToken(query: string): string {
  return foldCategorySearch(query)
    .replace(/[^a-z0-9\s_-]/g, " ")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
}
