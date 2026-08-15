export type LeadTagFieldProps = {
  id: string
  value: string[]
  onValueChange: (value: string[]) => void
  label?: string
  error?: string
  disabled?: boolean
  onBlur?: () => void
}

export type LeadTagChipsProps = {
  tags: { id?: string; name: string }[]
  max?: number
  compact?: boolean
}
