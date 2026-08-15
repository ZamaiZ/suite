"use client"

import { useState } from "react"
import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import {
  RiAddLine,
  RiInformationLine,
  RiLoader4Line,
  RiSendPlaneLine,
} from "react-icons/ri"
import { LeadForm, LEAD_FORM_ID } from "@/components/custom/LeadForm"
import { Button } from "@/components/ui/Button"
import { Dialog } from "@/components/ui/Dialog"
import { Tooltip } from "@/components/ui/Tooltip"
import type { LeadBoardItem } from "@/lib/leads/board-item"
import { LeadCreateHeader } from "./LeadCreateHeader"

const EASE = [0.23, 1, 0.32, 1] as const

export function LeadCreate({
  onCreated,
}: {
  onCreated?: (item: LeadBoardItem) => void
}) {
  const [open, setOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const reduced = !!useReducedMotion()

  function close() {
    if (isPending) return
    setOpen(false)
  }

  return (
    <>
      <Tooltip content="Criar novo" side="left">
        <Button
          type="button"
          variant="outline"
          tone="danger"
          aria-label="Criar novo"
          onClick={() => setOpen(true)}
          className="size-6 shrink-0 rounded-full px-0 text-fg-muted hover:bg-hover hover:text-fg"
        >
          <RiAddLine size={14} aria-hidden />
        </Button>
      </Tooltip>
      <Dialog
        open={open}
        onClose={close}
        title="Novo lead"
        description="Cadastre uma empresa e seu principal contato."
        className="max-w-2xl"
        bodyClassName="bg-canvas"
        header={
          <LeadCreateHeader onClose={close} closeDisabled={isPending} />
        }
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={close}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form={LEAD_FORM_ID}
              disabled={isPending}
              leadingIcon={
                isPending ? (
                  <RiLoader4Line
                    size={16}
                    aria-hidden
                    className="animate-spin"
                  />
                ) : (
                  <RiSendPlaneLine size={16} aria-hidden />
                )
              }
            >
              {isPending ? "Cadastrando…" : "Cadastrar lead"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <m.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0.12 : 0.16, ease: EASE }}
            className="flex items-start gap-2.5 rounded-lg bg-accent/10 px-3 py-2.5"
          >
            <RiInformationLine
              size={16}
              aria-hidden
              className="mt-0.5 shrink-0 text-accent"
            />
            <p className="font-sans text-body-sm text-fg-secondary">
              O lead será adicionado à fila para ser assumido por um SDR.
            </p>
          </m.div>
          <LeadForm
            mode="create"
            hideSubmit
            onSuccess={(result) => {
              if (result.kind === "create") onCreated?.(result.item)
              setOpen(false)
            }}
            onPendingChange={setIsPending}
          />
        </div>
      </Dialog>
    </>
  )
}
