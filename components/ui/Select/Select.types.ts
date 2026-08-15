import type { ReactNode } from "react"

export type SelectItem = {
  value: string
  label: string
  icon?: ReactNode
  description?: string
  disabled?: boolean
}

export type SelectProps = {
  id: string
  items: SelectItem[]
  value?: string | string[]
  onValueChange?: (value: string | string[]) => void
  multiple?: boolean
  searchable?: boolean
  clearable?: boolean
  label?: string
  placeholder?: string
  error?: string
  disabled?: boolean
  loading?: boolean
  leadingIcon?: ReactNode
  maxVisibleChips?: number
  className?: string
  onBlur?: () => void
}
