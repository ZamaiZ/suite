import type React from "react"

export type ShowcaseCategoryId =
  | "actions"
  | "forms"
  | "navigation"
  | "overlays"
  | "content"
  | "messaging"

export type ShowcaseCategory = {
  id: ShowcaseCategoryId
  label: string
  description: string
  href: string
  componentCount: number
  icon: React.ElementType
}
