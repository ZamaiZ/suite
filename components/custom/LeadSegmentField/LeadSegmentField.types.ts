export type LeadSegmentFieldProps = {
  id: string
  value: string
  onValueChange: (value: string) => void
  label?: string
  error?: string
  disabled?: boolean
  onBlur?: () => void
}
