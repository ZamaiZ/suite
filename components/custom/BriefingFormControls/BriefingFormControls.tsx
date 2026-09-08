"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import { RiEyeLine, RiEyeOffLine } from "react-icons/ri"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"

type TextFieldProps = Omit<
  React.ComponentProps<typeof InputGroupInput>,
  "id"
> & {
  id: string
  label: string
  leadingIcon?: ReactNode
  error?: string
}

export function BriefingTextField({
  id,
  label,
  leadingIcon,
  type,
  disabled,
  error,
  ...props
}: TextFieldProps) {
  const [passwordVisible, setPasswordVisible] = useState(false)
  const isPassword = type === "password"

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        {leadingIcon ? <InputGroupAddon>{leadingIcon}</InputGroupAddon> : null}
        <InputGroupInput
          id={id}
          type={isPassword && passwordVisible ? "text" : type}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          {...props}
        />
        {isPassword ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="button"
              size="icon-sm"
              disabled={disabled}
              onClick={() => setPasswordVisible((visible) => !visible)}
              aria-label={passwordVisible ? "Ocultar senha" : "Exibir senha"}
            >
              {passwordVisible ? (
                <RiEyeOffLine aria-hidden />
              ) : (
                <RiEyeLine aria-hidden />
              )}
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
      <FieldError>{error}</FieldError>
    </Field>
  )
}

export function BriefingTextareaField({
  id,
  label,
  ...props
}: React.ComponentProps<typeof Textarea> & { id: string; label: string }) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea id={id} {...props} />
    </Field>
  )
}

export function BriefingRadioField({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <FieldSet>
      <FieldLegend variant="label">{label}</FieldLegend>
      <RadioGroup
        className="flex flex-row flex-wrap gap-3"
        value={value}
        onValueChange={onValueChange}
      >
        {options.map((option) => (
          <Field key={option.value} orientation="horizontal" className="w-auto">
            <RadioGroupItem
              id={`${label}-${option.value}`}
              value={option.value}
            />
            <FieldLabel htmlFor={`${label}-${option.value}`}>
              {option.label}
            </FieldLabel>
          </Field>
        ))}
      </RadioGroup>
    </FieldSet>
  )
}

const BriefingRadioContext = createContext("")

export function BriefingRadioGroup({
  label,
  value,
  onValueChange,
  children,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  orientation?: "horizontal" | "vertical"
  children: ReactNode
}) {
  const groupId = `briefing-radio-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
  return (
    <FieldSet>
      <FieldLegend variant="label">{label}</FieldLegend>
      <BriefingRadioContext.Provider value={groupId}>
        <RadioGroup
          className="flex flex-row flex-wrap gap-3"
          value={value}
          onValueChange={onValueChange}
        >
          {children}
        </RadioGroup>
      </BriefingRadioContext.Provider>
    </FieldSet>
  )
}

export function BriefingRadio({
  value,
  label,
}: {
  value: string
  label: string
}) {
  const groupId = useContext(BriefingRadioContext)
  const id = `${groupId}-${value}`
  return (
    <Field orientation="horizontal" className="w-auto">
      <RadioGroupItem id={id} value={value} />
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
    </Field>
  )
}

export function BriefingCheckbox({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <BriefingCheckboxField
      id={id}
      label={label}
      checked={checked}
      onCheckedChange={onCheckedChange}
    />
  )
}

export function BriefingCheckboxField({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <Field orientation="horizontal" className="w-auto">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
      />
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
    </Field>
  )
}

export function BriefingSliderField({
  id,
  value,
  onValueChange,
  ...props
}: Omit<React.ComponentProps<typeof Slider>, "value" | "onValueChange"> & {
  id: string
  value: number
  onValueChange: (value: number) => void
}) {
  return (
    <Slider
      id={id}
      value={[value]}
      onValueChange={(next) =>
        onValueChange(Array.isArray(next) ? (next[0] ?? value) : next)
      }
      {...props}
    />
  )
}
