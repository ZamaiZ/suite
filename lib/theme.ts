export type ThemeValue = "system" | "light" | "dark"

const CYCLE: Record<ThemeValue, ThemeValue> = {
  system: "light",
  light:  "dark",
  dark:   "system",
}

export function nextTheme(current: string | undefined): ThemeValue {
  const safe = (current as ThemeValue | undefined) ?? "system"
  return CYCLE[safe] ?? "system"
}
