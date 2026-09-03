import type React from "react"

export type TextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "className"
> & {
  id: string
  label?: string
  error?: string
  className?: string
}
