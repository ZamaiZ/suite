"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { RiComputerLine, RiMoonLine, RiSunLine } from "react-icons/ri"
import { cn } from "cn"
import type { ThemeValue } from "@/lib/theme"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ThemeToggleProps } from "./ThemeToggle.types"

const subscribeNoop = () => () => {}

const THEME_OPTIONS: Array<{
  value: ThemeValue
  label: string
  Icon: typeof RiComputerLine
}> = [
  { value: "system", label: "Sistema", Icon: RiComputerLine },
  { value: "light", label: "Claro", Icon: RiSunLine },
  { value: "dark", label: "Escuro", Icon: RiMoonLine },
]

function isThemeValue(value: string | undefined): value is ThemeValue {
  return value === "system" || value === "light" || value === "dark"
}

export function ThemeToggle({
  className,
  label,
  "aria-describedby": ariaDescribedby,
}: ThemeToggleProps) {
  // Hidratação como sistema externo: o servidor devolve false, o cliente true,
  // sem efeito nem render extra.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  )
  const { theme, setTheme } = useTheme()

  const current = mounted && isThemeValue(theme) ? theme : "system"
  const currentOption =
    THEME_OPTIONS.find(({ value }) => value === current) ?? THEME_OPTIONS[0]
  const CurrentIcon = currentOption.Icon
  const hasLabel = Boolean(label)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size={hasLabel ? "lg" : "icon-lg"}
            className={cn(
              hasLabel && "w-full justify-start gap-3 px-3",
              !hasLabel && "rounded-full",
              className,
            )}
            aria-label={label ? undefined : `Tema: ${currentOption.label}`}
            aria-describedby={ariaDescribedby}
          />
        }
      >
        <CurrentIcon size={hasLabel ? 18 : 20} aria-hidden />
        {hasLabel ? (
          <span>{label}</span>
        ) : (
          <span className="sr-only">Tema</span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(value) => {
            if (isThemeValue(value)) setTheme(value)
          }}
        >
          <DropdownMenuLabel>Tema</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {THEME_OPTIONS.map(({ value, label: optionLabel, Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon size={16} aria-hidden />
              {optionLabel}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
