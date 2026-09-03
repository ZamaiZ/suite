import type React from "react"

export type BriefingChoiceCardProps = {
  value: string
  title: string
  description?: string
  disabled?: boolean
  id?: string
  className?: string
}

export type BriefingChoiceCardGroupProps = {
  value?: string
  onValueChange?: (value: string) => void
  name?: string
  disabled?: boolean
  label?: string
  className?: string
  contentClassName?: string
  children: React.ReactNode
}
