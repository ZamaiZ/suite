"use client"

import type { ReactNode } from "react"
import { AnimatePresence, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiPencilLine, RiSaveLine } from "react-icons/ri"
import type { IconType } from "react-icons"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { LeadIconWell } from "./LeadIconWell"

const EASE = [0.23, 1, 0.32, 1] as const

export function LeadRecordSectionCard({
  icon,
  title,
  subtitle,
  editing,
  editLabel,
  readOnly,
  pending,
  saveDisabled,
  showActions = true,
  onEdit,
  onCancel,
  children,
}: {
  icon: IconType
  title: string
  subtitle?: string
  editing: boolean
  editLabel: string
  readOnly: boolean
  pending: boolean
  saveDisabled: boolean
  showActions?: boolean
  onEdit: () => void
  onCancel: () => void
  children: ReactNode
}) {
  const reduced = !!useReducedMotion()

  return (
    <section className="rounded-xl bg-card p-4 shadow-xs">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <LeadIconWell icon={icon} />
          <div className="min-w-0">
            <h3 className="font-heading text-sm font-semibold text-foreground">
              {title}
            </h3>
            {subtitle ? (
              <p className="text-xs/relaxed text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {readOnly || !showActions ? null : editing ? (
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || saveDisabled}>
              {pending ? (
                <Spinner
                  data-icon="inline-start"
                  aria-hidden
                  className="size-3.5"
                />
              ) : (
                <RiSaveLine data-icon="inline-start" aria-hidden />
              )}
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={onEdit}>
            <RiPencilLine data-icon="inline-start" aria-hidden />
            {editLabel}
          </Button>
        )}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={editing ? "edit" : "view"}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
          transition={{ duration: reduced ? 0.12 : 0.16, ease: EASE }}
        >
          {children}
        </m.div>
      </AnimatePresence>
    </section>
  )
}
