import type React from "react"

export type ClientPortalShellVariant = "gate" | "workspace"

export type ClientPortalShellProps = {
  title: string
  description: string
  children: React.ReactNode
  variant?: ClientPortalShellVariant
}
