import type { CivilHourCycle } from "@/lib/date-time"

export type HourCycle = CivilHourCycle

export type TimePickerProps = {
  id: string
  value?: string
  onValueChange?: (value: string) => void
  label?: string
  placeholder?: string
  error?: string
  disabled?: boolean
  clearable?: boolean
  hourCycle?: HourCycle
  className?: string
  onBlur?: () => void
}
