import type { ReactNode } from "react"

export type BriefingSectionCardProps = {
  icon: ReactNode
  title: string
  description: string
  children: ReactNode
  index?: number
  className?: string
}
