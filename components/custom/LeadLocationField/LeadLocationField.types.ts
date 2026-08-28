import type { BrazilStateCode } from "@/lib/br-locations"

export type LeadLocationValue = {
  state_code: BrazilStateCode | ""
  city: string
}

export type LeadLocationFieldProps = {
  id: string
  value: LeadLocationValue
  onValueChange: (value: LeadLocationValue) => void
  stateError?: string
  cityError?: string
  disabled?: boolean
  onBlur?: () => void
}
