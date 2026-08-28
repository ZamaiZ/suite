"use client"

import { useMemo } from "react"
import { RiMapPinLine } from "react-icons/ri"
import { Select } from "@/components/ui/Select"
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
      <Select
        id={`${id}-state`}
        label="UF"
        items={stateItems}
        value={value.state_code}
        onValueChange={(next) => {
          const stateCode = typeof next === "string" ? next : ""
          onValueChange({
            state_code: stateCode as BrazilStateCode | "",
            city: "",
          })
        }}
        searchable
        clearable={false}
        placeholder="Selecionar UF"
        leadingIcon={<RiMapPinLine size={16} aria-hidden />}
        error={stateError}
        disabled={disabled}
        onBlur={onBlur}
      />
      <Select
        id={`${id}-city`}
        label="Cidade"
        items={cityItems}
        value={value.city}
        onValueChange={(next) => {
          const city = typeof next === "string" ? next : ""
          onValueChange({
            ...value,
            city,
          })
        }}
        searchable
        clearable={false}
        placeholder={value.state_code ? "Selecionar cidade" : "Selecione a UF primeiro"}
        error={cityError}
        disabled={disabled || !value.state_code}
        onBlur={onBlur}
      />
    </div>
  )
}
