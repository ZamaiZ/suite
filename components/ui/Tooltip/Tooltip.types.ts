import type React from "react"

export type TooltipSide = "top" | "right" | "bottom" | "left"

export type TooltipTone = "accent" | "danger" | "success" | "warning"

export type TooltipProps = {
  content: string
  side?: TooltipSide
  arrow?: boolean
  tone?: TooltipTone
  wrapperClassName?: string
  className?: string
  children: React.ReactElement
}
