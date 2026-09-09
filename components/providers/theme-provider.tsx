"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ThemeProviderProps } from "next-themes"
import { nextTheme } from "@/lib/theme"

function KeyboardShortcuts() {
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    function onKeyDown(e: Event) {
      // Sensores de teclado (dnd-kit) e extensões despacham eventos `keydown`
      // que não são KeyboardEvent — chamar getModifierState neles quebra a app.
      if (!(e instanceof KeyboardEvent)) return
      if (e.repeat) return

      const isCtrlAlt = e.ctrlKey && e.altKey
      const isAltGr = e.getModifierState("AltGraph")
      const isT = e.code === "KeyT"

      if ((isCtrlAlt || isAltGr) && isT) {
        e.preventDefault()
        setTheme(nextTheme(theme))
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [theme, setTheme])

  return null
}

export function ThemeProvider({
  children,
  scriptProps,
  ...props
}: ThemeProviderProps) {
  const resolvedScriptProps =
    typeof window === "undefined"
      ? scriptProps
      : { ...scriptProps, type: "application/json" }

  return (
    <NextThemesProvider {...props} scriptProps={resolvedScriptProps}>
      <KeyboardShortcuts />
      {children}
    </NextThemesProvider>
  )
}
