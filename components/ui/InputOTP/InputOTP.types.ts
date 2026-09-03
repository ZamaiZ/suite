import type React from "react"

export type InputOTPVariant = "number" | "text" | "mixed"

export type InputOTPProps = {
  maxLength: number
  variant?: InputOTPVariant
  value?: string
  onChange?: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
  id?: string
  name?: string
  error?: boolean
  label?: string
  className?: string
  containerClassName?: string
  children: React.ReactNode
}

export type InputOTPGroupProps = React.ComponentProps<"div">

export type InputOTPSlotProps = React.ComponentProps<"div"> & {
  index: number
}

export type InputOTPSeparatorProps = React.ComponentProps<"div">
