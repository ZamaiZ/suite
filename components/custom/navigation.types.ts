import type React from "react"

export type NavLeaf = {
  kind: "leaf"
  label: string
  href: string
  icon?: React.ElementType
  description?: string
  disabled?: boolean
}

export type NavGroup = {
  kind: "group"
  id: string
  label: string
  icon: React.ElementType
  description?: string
  children: NavLeaf[]
}

export type NavItem = NavLeaf | NavGroup
