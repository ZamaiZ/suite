export type DatePickerProps = {
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
  className?: string
  onBlur?: () => void
}
