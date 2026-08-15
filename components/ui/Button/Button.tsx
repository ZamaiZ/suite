import { cn } from "@/lib/cn"
import type { ButtonProps, ButtonTone, ButtonVariant } from "./Button.types"

const BASE =
  "inline-flex items-center justify-center gap-2 px-4 h-[var(--control-height)] rounded-md border font-sans text-body-sm font-semibold cursor-pointer select-none transition-[background-color,border-color,color,opacity,transform] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"

const VARIANT_CLASSES: Record<Exclude<ButtonVariant, "soft">, string> = {
  primary:   "bg-accent text-accent-fg border-transparent hover:bg-accent-hover",
  secondary: "bg-surface text-fg border-border hover:bg-hover",
  ghost:     "bg-transparent text-fg border-transparent hover:bg-hover",
  outline:   "bg-transparent text-fg border-border hover:bg-hover",
  success:   "bg-success text-success-fg border-transparent hover:opacity-90",
  warning:   "bg-warning text-warning-fg border-transparent hover:bg-warning-hover",
  danger:    "bg-danger text-danger-fg border-transparent hover:opacity-90",
}

const SOFT_TONE_CLASSES: Record<ButtonTone, string> = {
  primary:   "bg-accent/10  text-accent   border-accent/25  hover:bg-accent/15",
  secondary: "bg-surface    text-fg        border-border      hover:bg-hover",
  success:   "bg-success/10 text-success  border-success/25  hover:bg-success/15",
  warning:   "bg-warning/10 text-warning  border-warning/25  hover:bg-warning/15",
  danger:    "bg-danger/10  text-danger   border-danger/25   hover:bg-danger/15",
}

function getVariantClasses(variant: ButtonVariant, tone: ButtonTone): string {
  if (variant === "soft") return SOFT_TONE_CLASSES[tone]
  return VARIANT_CLASSES[variant]
}

export function Button({
  variant = "primary",
  tone = "primary",
  leadingIcon,
  trailingIcon,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={cn(BASE, getVariantClasses(variant, tone), className)}
      {...props}
    >
      {leadingIcon && (
        <span aria-hidden className="shrink-0 inline-flex">
          {leadingIcon}
        </span>
      )}
      {children}
      {trailingIcon && (
        <span aria-hidden className="shrink-0 inline-flex">
          {trailingIcon}
        </span>
      )}
    </button>
  )
}
