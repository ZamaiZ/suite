export type DatePickerProps = {
  id: string
  /** Data civil `YYYY-MM-DD`, ou `""` para vazio. */
  value?: string
  onValueChange?: (value: string) => void
  label?: string
  /**
   * Nome acessível do gatilho quando não há `label` visível — o caso de campo
   * cujo rótulo é uma sobrancelha de seção, e não um `<label>`.
   */
  ariaLabel?: string
  placeholder?: string
  error?: string
  disabled?: boolean
  clearable?: boolean
  /** Limites em data civil. Comparação de string basta: ISO ordena. */
  min?: string
  max?: string
  className?: string
  onBlur?: () => void
}
