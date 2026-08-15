"use client"

import type { ReactNode } from "react"
import { AnimatePresence, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import {
  RiLoader4Line,
  RiPencilLine,
  RiSaveLine,
} from "react-icons/ri"
import type { IconType } from "react-icons"
import { Button } from "@/components/ui/Button"
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
    <section className="rounded-xl bg-surface p-4 shadow-card">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <LeadIconWell icon={icon} />
          <div className="min-w-0">
            <h3 className="font-sans text-body-sm font-semibold text-fg">
              {title}
            </h3>
            {subtitle ? (
              <p className="font-sans text-caption text-fg-muted">{subtitle}</p>
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
            <Button
              type="submit"
              disabled={pending || saveDisabled}
              leadingIcon={
                pending ? (
                  <RiLoader4Line
                    size={16}
                    aria-hidden
                    className="animate-spin"
                  />
                ) : (
                  <RiSaveLine size={16} aria-hidden />
                )
              }
            >
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={onEdit}
            leadingIcon={<RiPencilLine size={14} aria-hidden />}
          >
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
