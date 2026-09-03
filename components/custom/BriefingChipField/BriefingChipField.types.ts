export type BriefingChipFieldProps = {
  id: string
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  disabled?: boolean
}
