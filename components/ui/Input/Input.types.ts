import type React from "react"

export type InputVariant =
  | "text"
  | "email"
  | "password"
  | "number"
  | "cpf"
  | "cnpj"
  | "cep"
  | "currency"
  | "phone"

export type InputStatus = "idle" | "loading" | "success" | "error"

export type InputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "className" | "type"
> & {
  id: string
  variant?: InputVariant
  label?: string
  error?: string
  leadingIcon?: React.ReactNode
  status?: InputStatus
  className?: string
}
