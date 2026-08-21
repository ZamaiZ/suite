"use client"

import { useState, useCallback } from "react"
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  useReducedMotion,
} from "motion/react"
import * as m from "motion/react-m"
import {
  RiCheckLine,
  RiCloseLine,
  RiEyeLine,
  RiEyeOffLine,
  RiLoader4Line,
} from "react-icons/ri"
import {
  formatCnpj,
  formatCpf,
  formatPhone,
  formatPostalCode,
} from "@/lib/br-documents"
import { cn } from "@/lib/cn"
import { formatBRLInput } from "@/lib/money"
import type { InputProps, InputStatus, InputVariant } from "./Input.types"

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1]

const VARIANT_FORMATTERS: Partial<
  Record<InputVariant, (value: string) => string>
> = {
  number: (value) => value.replace(/\D/g, ""),
  cpf: formatCpf,
  cnpj: formatCnpj,
  cep: formatPostalCode,
  currency: formatBRLInput,
  phone: formatPhone,
}

const NUMERIC_VARIANTS = new Set<InputVariant>([
  "number",
  "cpf",
  "cnpj",
  "cep",
  "currency",
])

function StatusIcon({ status }: { status: InputStatus }) {
  const reduced = !!useReducedMotion()
  if (status === "idle") return null
  return (
    <span className="pointer-events-none absolute right-2.5 inline-flex size-6 items-center justify-center">
      <AnimatePresence mode="wait" initial={false}>
        <m.span
          key={status}
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.16, ease: EASE }}
          className="absolute inline-flex"
        >
          {status === "loading" ? (
            <RiLoader4Line
              size={16}
              aria-hidden
              className="animate-spin text-fg-muted duration-500"
            />
          ) : null}
          {status === "success" ? (
            <RiCheckLine
              size={16}
              aria-hidden
              className="text-success/50"
            />
          ) : null}
          {status === "error" ? (
            <RiCloseLine size={16} aria-hidden className="text-danger" />
          ) : null}
        </m.span>
      </AnimatePresence>
    </span>
  )
}

export function Input({
  id,
  variant = "text",
  label,
  error,
  leadingIcon,
  status = "idle",
  placeholder,
  className,
  disabled,
  onChange,
  ...props
}: InputProps) {
  const [passwordVisible, setPasswordVisible] = useState(false)

  const isPassword = variant === "password"
  const isEmail = variant === "email"
  const isNumber = variant === "number"
  const isDate = variant === "date"
  const isPhone = variant === "phone"
  const isNumeric = NUMERIC_VARIANTS.has(variant)
  const showStatus = !isPassword && status !== "idle"
  const hasTrailing = isPassword || showStatus
  const formatter = VARIANT_FORMATTERS[variant]
  const formattedValue =
    formatter && typeof props.value === "string"
      ? formatter(props.value)
      : props.value

  const inputType = isPassword
    ? passwordVisible
      ? "text"
      : "password"
    : isEmail
      ? "email"
      : isPhone
        ? "tel"
        : isDate
          ? "date"
          : "text"

  const inputMode = isPhone ? "tel" : isNumeric ? "numeric" : undefined

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatter = VARIANT_FORMATTERS[variant]
      if (formatter) {
        e.target.value = formatter(e.target.value)
      }
      onChange?.(e)
    },
    [variant, onChange],
  )

  const errorId = `${id}-error`

  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      {label ? (
        <label
          htmlFor={id}
          className={cn(
            "font-sans text-body-sm font-medium text-fg-secondary",
            disabled ? "opacity-50" : "cursor-text",
            error && "text-danger",
          )}
        >
          {label}
        </label>
      ) : null}

      <div className="relative flex items-center">
        {leadingIcon ? (
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 inline-flex shrink-0 text-fg-muted"
          >
            {leadingIcon}
          </span>
        ) : null}

        <input
          {...props}
          id={id}
          type={inputType}
          inputMode={inputMode}
          pattern={isNumber ? "[0-9]*" : undefined}
          {...(formatter && typeof props.value === "string"
            ? { value: formattedValue }
            : {})}
          placeholder={
            placeholder ?? (isPhone ? "(11) 98765-4321" : undefined)
          }
          disabled={disabled}
          onChange={handleChange}
          aria-busy={status === "loading" ? true : undefined}
          className={cn(
            "h-[var(--control-height)] w-full rounded-md border border-input-border bg-input py-0",
            "font-sans text-body-sm text-fg outline-none",
            "placeholder:text-fg-muted",
            "transition-[background-color,border-color,color,opacity] duration-150 ease-out",
            "focus-visible:border-accent",
            "disabled:pointer-events-none disabled:opacity-50",
            error && "border-danger focus-visible:border-danger",
            leadingIcon ? "pl-9" : "pl-3",
            hasTrailing ? "pr-10" : "pr-3",
          )}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? errorId : undefined}
        />

        {showStatus ? (
          <LazyMotion features={domAnimation} strict>
            <StatusIcon status={status} />
          </LazyMotion>
        ) : null}

        {isPassword ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setPasswordVisible((v) => !v)}
            aria-label={passwordVisible ? "Ocultar senha" : "Exibir senha"}
            className={cn(
              "absolute right-2.5 inline-flex items-center justify-center",
              "size-6 rounded text-fg-muted",
              "transition-colors hover:text-fg",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            {passwordVisible ? (
              <RiEyeOffLine size={16} aria-hidden />
            ) : (
              <RiEyeLine size={16} aria-hidden />
            )}
          </button>
        ) : null}
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="font-sans text-body-sm text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
