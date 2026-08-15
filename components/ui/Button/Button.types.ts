import type React from "react"

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "outline"
  | "success"
  | "warning"
  | "danger"
  | "soft"

export type ButtonTone = "primary" | "secondary" | "success" | "warning" | "danger"

export type ButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "disabled"
> & {
  variant?: ButtonVariant
  tone?: ButtonTone
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
  disabled?: boolean
  className?: string
  children?: React.ReactNode
}
