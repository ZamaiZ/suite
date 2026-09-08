"use client"

import type { ReactNode } from "react"
import type { IconType } from "react-icons"
import { AnimatePresence, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import {
  RiMailLine,
  RiMore2Line,
  RiPhoneLine,
  RiWhatsappLine,
} from "react-icons/ri"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/cn"
import {
  LEAD_ACTIVITY_CHANNEL_LABELS,
  LEAD_ACTIVITY_CHANNELS,
  type LeadActivityChannel,
} from "@/lib/leads/channel"
import type { LeadActivityChannelPickerProps } from "./LeadActivityChannelPicker.types"

const EASE = [0.23, 1, 0.32, 1] as const

export const LEAD_ACTIVITY_CHANNEL_ICONS = {
  email: RiMailLine,
  call: RiPhoneLine,
  whatsapp: RiWhatsappLine,
  other: RiMore2Line,
} as const satisfies Record<LeadActivityChannel, IconType>

function FieldReveal({
  show,
  id,
  children,
}: {
  show: boolean
  id: string
  children: ReactNode
}) {
  const reduced = !!useReducedMotion()
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <m.div
          key={id}
          initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0, y: 4 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, height: "auto", y: 0 }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: 0.12 } }
              : {
                  opacity: 0,
                  height: 0,
                  y: 4,
                  transition: { duration: 0.14, ease: EASE },
                }
          }
          transition={{ duration: reduced ? 0.12 : 0.18, ease: EASE }}
          style={reduced ? undefined : { overflow: "hidden" }}
        >
          {children}
        </m.div>
      ) : null}
    </AnimatePresence>
  )
}

export function LeadActivityChannelPicker({
  id,
  value,
  detail,
  onValueChange,
  onDetailChange,
  error,
  detailError,
  disabled,
}: LeadActivityChannelPickerProps) {
  const showDetail = value === "other"

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Canal do contato"
        className="flex flex-wrap gap-1.5"
      >
        {LEAD_ACTIVITY_CHANNELS.map((item) => {
          const selected = value === item
          const Icon = LEAD_ACTIVITY_CHANNEL_ICONS[item]
          return (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => {
                onValueChange(item)
                if (item !== "other") onDetailChange("")
              }}
              className={cn(
                "inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border px-2",
                "font-sans text-caption transition-[colors,transform] duration-150 ease-out",
                "active:scale-[0.97]",
                selected
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-transparent text-fg-muted hover:text-fg",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              <Icon size={14} aria-hidden />
              {LEAD_ACTIVITY_CHANNEL_LABELS[item]}
            </button>
          )
        })}
      </div>
      {error ? (
        <p role="alert" className="mt-1 font-sans text-caption text-danger">
          {error}
        </p>
      ) : null}
      <FieldReveal show={showDetail} id="channel-detail">
        <Field className="mt-3" data-invalid={!!detailError}>
          <FieldLabel htmlFor={id}>Qual canal?</FieldLabel>
          <Input
            id={id}
            value={detail}
            onChange={(event) => onDetailChange(event.target.value)}
            disabled={disabled}
            aria-invalid={!!detailError}
            aria-describedby={detailError ? `${id}-error` : undefined}
          />
          <FieldError id={`${id}-error`}>{detailError}</FieldError>
        </Field>
      </FieldReveal>
    </div>
  )
}
