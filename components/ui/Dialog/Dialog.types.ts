import type { ReactNode } from "react"

export type DialogSize = "default" | "lg" | "xl"

export type DialogProps = {
  open: boolean
  onClose: () => void
  onExited?: () => void
  title: string
  description?: string
  header?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
  bodyClassName?: string
  size?: DialogSize
}
