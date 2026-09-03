import type React from "react"

export type RadioGroupProps = {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  name?: string
  disabled?: boolean
  required?: boolean
  error?: boolean
  label?: string
  orientation?: "vertical" | "horizontal"
  className?: string
  children: React.ReactNode
}

export type RadioProps = {
  value: string
  disabled?: boolean
  label?: string
  id?: string
  className?: string
}
