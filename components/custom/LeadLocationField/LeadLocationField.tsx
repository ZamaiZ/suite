"use client"

import { useMemo } from "react"
import { RiMapPinLine } from "react-icons/ri"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  brStateOptions,
  cityOptionsForState,
  type BrazilStateCode,
} from "@/lib/br-locations"
import type { LeadLocationFieldProps } from "./LeadLocationField.types"

export function LeadLocationField({
  id,
  value,
  onValueChange,
  stateError,
  cityError,
  disabled,
  onBlur,
}: LeadLocationFieldProps) {
  const stateItems = useMemo(() => brStateOptions(), [])
  const cityItems = useMemo(
    () =>
      cityOptionsForState(
        value.state_code ? (value.state_code as BrazilStateCode) : null,
      ),
    [value.state_code],
  )

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field data-invalid={Boolean(stateError)}>
        <FieldLabel htmlFor={`${id}-state`}>UF</FieldLabel>
        <Select
          value={value.state_code}
          disabled={disabled}
          onValueChange={(next) => {
            const stateCode = String(next)
            onValueChange({
              state_code: stateCode as BrazilStateCode | "",
              city: "",
            })
          }}
        >
          <SelectTrigger id={`${id}-state`} className="w-full" onBlur={onBlur}>
            <RiMapPinLine size={16} aria-hidden />
            <SelectValue placeholder="Selecionar UF" />
          </SelectTrigger>
          <SelectContent align="start">
            {stateItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError>{stateError}</FieldError>
      </Field>
      <Field data-invalid={Boolean(cityError)}>
        <FieldLabel htmlFor={`${id}-city`}>Cidade</FieldLabel>
        <Select
          value={value.city}
          disabled={disabled || !value.state_code}
          onValueChange={(next) => {
            const city = String(next)
            onValueChange({
              ...value,
              city,
            })
          }}
        >
          <SelectTrigger id={`${id}-city`} className="w-full" onBlur={onBlur}>
            <SelectValue
              placeholder={
                value.state_code
                  ? "Selecionar cidade"
                  : "Selecione a UF primeiro"
              }
            />
          </SelectTrigger>
          <SelectContent align="start">
            {cityItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError>{cityError}</FieldError>
      </Field>
    </div>
  )
}
