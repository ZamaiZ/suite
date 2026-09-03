"use client"

import { createContext, useContext, useId } from "react"
import {
  OTPInput,
  OTPInputContext,
  REGEXP_ONLY_CHARS,
  REGEXP_ONLY_DIGITS,
  REGEXP_ONLY_DIGITS_AND_CHARS,
} from "input-otp"
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  useReducedMotion,
} from "motion/react"
import * as m from "motion/react-m"
import { RiSubtractLine } from "react-icons/ri"
import { cn } from "@/lib/cn"
import type {
  InputOTPGroupProps,
  InputOTPProps,
  InputOTPSeparatorProps,
  InputOTPSlotProps,
  InputOTPVariant,
} from "./InputOTP.types"

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1]

const VARIANT_PATTERN: Record<InputOTPVariant, string> = {
  number: REGEXP_ONLY_DIGITS,
  text: REGEXP_ONLY_CHARS,
  mixed: REGEXP_ONLY_DIGITS_AND_CHARS,
}

const VARIANT_INPUT_MODE: Record<InputOTPVariant, "numeric" | "text"> = {
  number: "numeric",
  text: "text",
  mixed: "text",
}

type InputOTPUiContextValue = {
  error: boolean
}

const InputOTPUiContext = createContext<InputOTPUiContextValue>({
  error: false,
})

function transformOtpValue(value: string, variant: InputOTPVariant): string {
  if (variant === "number") return value.replace(/\D/g, "")
  if (variant === "text") return value.replace(/[^A-Za-z]/g, "").toUpperCase()
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
}

function SlotCaret() {
  const reduced = !!useReducedMotion()

  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <m.span
        className="h-[1.1em] w-px bg-accent"
        animate={reduced ? { opacity: 1 } : { opacity: [1, 0] }}
        transition={
          reduced
            ? undefined
            : {
                duration: 0.9,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "linear",
              }
        }
      />
    </span>
  )
}

export function InputOTP({
  maxLength,
  variant = "number",
  value,
  onChange,
  onComplete,
  disabled,
  id,
  name,
  error = false,
  label,
  className,
  containerClassName,
  children,
}: InputOTPProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  const handleChange = (next: string) => {
    onChange?.(transformOtpValue(next, variant))
  }

  const handleComplete = (next: string) => {
    onComplete?.(transformOtpValue(next, variant))
  }

  return (
    <InputOTPUiContext.Provider value={{ error }}>
      <div className={cn("flex w-full flex-col gap-1.5", className)}>
        {label ? (
          <label
            htmlFor={inputId}
            className={cn(
              "font-sans text-body-sm font-medium text-fg-secondary",
              disabled ? "opacity-50" : "cursor-text",
              error && "text-danger",
            )}
          >
            {label}
          </label>
        ) : null}

        <OTPInput
          id={inputId}
          name={name}
          maxLength={maxLength}
          value={value === undefined ? undefined : transformOtpValue(value, variant)}
          onChange={handleChange}
          onComplete={handleComplete}
          disabled={disabled}
          pattern={VARIANT_PATTERN[variant]}
          pasteTransformer={(pasted) => transformOtpValue(pasted, variant)}
          inputMode={VARIANT_INPUT_MODE[variant]}
          autoComplete="one-time-code"
          spellCheck={false}
          autoCapitalize={variant === "number" ? "off" : "characters"}
          containerClassName={cn(
            "flex items-center gap-2",
            disabled && "pointer-events-none opacity-50",
            containerClassName,
          )}
        >
          {children}
        </OTPInput>
      </div>
    </InputOTPUiContext.Provider>
  )
}

export function InputOTPGroup({ className, ...props }: InputOTPGroupProps) {
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  )
}

export function InputOTPSlot({
  index,
  className,
  ...props
}: InputOTPSlotProps) {
  const otpContext = useContext(OTPInputContext)
  const { error } = useContext(InputOTPUiContext)
  const { char, hasFakeCaret, isActive } = otpContext.slots[index] ?? {}
  const reduced = !!useReducedMotion()

  return (
    <div
      aria-invalid={error || undefined}
      data-active={isActive || undefined}
      className={cn(
        "relative flex h-[var(--control-height)] w-[var(--control-height)] items-center justify-center",
        "rounded-md border border-input-border bg-input",
        "font-sans text-body-sm font-semibold text-fg uppercase tabular-nums",
        "transition-[background-color,border-color,box-shadow,color,opacity] duration-150 ease-out",
        isActive && "z-10 border-accent ring-2 ring-accent/25",
        error && "border-danger",
        isActive && error && "ring-danger/20",
        className,
      )}
      {...props}
    >
      <LazyMotion features={domAnimation} strict>
        <AnimatePresence mode="wait" initial={false}>
          {char ? (
            <m.span
              key={char}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0.1 : 0.14, ease: EASE }}
            >
              {char}
            </m.span>
          ) : null}
        </AnimatePresence>
        {hasFakeCaret ? <SlotCaret /> : null}
      </LazyMotion>
    </div>
  )
}

export function InputOTPSeparator({
  className,
  children,
  ...props
}: InputOTPSeparatorProps) {
  return (
    <div
      role="separator"
      className={cn("flex items-center text-fg-muted", className)}
      {...props}
    >
      {children ?? <RiSubtractLine size={16} aria-hidden />}
    </div>
  )
}
