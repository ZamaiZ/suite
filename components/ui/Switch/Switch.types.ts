export type SwitchProps = {
  id?: string
  name?: string
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  required?: boolean
  error?: boolean
  label?: string
  className?: string
}
