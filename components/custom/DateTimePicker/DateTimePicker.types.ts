import type { HourCycle } from "@/components/custom/TimePicker/TimePicker.types"

export type DateTimePickerProps = {
  id: string
  value?: string
  onValueChange?: (value: string) => void
  label?: string
  placeholder?: string
  error?: string
  disabled?: boolean
  clearable?: boolean
  min?: string
  max?: string
  hourCycle?: HourCycle
  className?: string
  onBlur?: () => void
}
