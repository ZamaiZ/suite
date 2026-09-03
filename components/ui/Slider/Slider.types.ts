export type SliderValue = number | [number, number]

export type SliderProps = {
  id?: string
  name?: string
  value?: SliderValue
  defaultValue?: SliderValue
  onValueChange?: (value: SliderValue) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  error?: boolean
  label?: string
  showValue?: boolean
  className?: string
}
