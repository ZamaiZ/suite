"use client"

import { AnimatePresence, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiCheckLine } from "react-icons/ri"
import { Button } from "@/components/ui/button"
import type { ClientBriefingCompleteScreenProps } from "./ClientBriefingCompleteScreen.types"

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1]

export function ClientBriefingCompleteScreen({
  companyName,
  editedAfterSubmit = false,
  onEdit,
}: ClientBriefingCompleteScreenProps) {
  const reduced = !!useReducedMotion()

  return (
    <AnimatePresence mode="wait">
      <m.div
        key="complete"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
        transition={{ duration: reduced ? 0.12 : 0.4, ease: EASE }}
        className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-16 text-center sm:py-24"
      >
        <m.span
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: reduced ? 0.1 : 0.35,
            ease: EASE,
            delay: reduced ? 0 : 0.05,
          }}
          className="inline-flex size-14 items-center justify-center rounded-full bg-success/10 text-success"
          aria-hidden
        >
          <RiCheckLine size={28} />
        </m.span>

        <m.p
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduced ? 0.1 : 0.32,
            ease: EASE,
            delay: reduced ? 0 : 0.12,
          }}
          className="mt-6 text-xs/relaxed font-medium tracking-wide text-muted-foreground uppercase"
        >
          {companyName}
        </m.p>

        <m.h1
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduced ? 0.1 : 0.34,
            ease: EASE,
            delay: reduced ? 0 : 0.18,
          }}
          className="mt-2 font-heading text-xl font-semibold text-foreground"
        >
          Obrigado
        </m.h1>

        <m.p
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduced ? 0.1 : 0.32,
            ease: EASE,
            delay: reduced ? 0 : 0.26,
          }}
          className="mt-3 max-w-md text-xs/relaxed leading-relaxed text-muted-foreground"
        >
          Recebemos seu briefing. Nossa equipe entrará em contato o quanto
          antes.
        </m.p>

        {editedAfterSubmit ? (
          <m.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: reduced ? 0.1 : 0.28,
              ease: EASE,
              delay: reduced ? 0 : 0.32,
            }}
            className="mt-4 text-xs/relaxed text-muted-foreground"
          >
            Alterações salvas após o envio.
          </m.p>
        ) : null}

        <m.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduced ? 0.1 : 0.3,
            ease: EASE,
            delay: reduced ? 0 : 0.36,
          }}
          className="mt-10"
        >
          <Button type="button" variant="secondary" onClick={onEdit}>
            Editar respostas
          </Button>
        </m.div>
      </m.div>
    </AnimatePresence>
  )
}
