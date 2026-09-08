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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Criar novo"
              onClick={() => setOpen(true)}
              className="shrink-0 rounded-full text-muted-foreground"
            />
          }
        >
          <RiAddLine size={14} aria-hidden />
        </TooltipTrigger>
        <TooltipContent side="left">Criar novo</TooltipContent>
      </Tooltip>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close()
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-h-[calc(100dvh-2rem)] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl"
        >
          <DialogTitle className="sr-only">Novo lead</DialogTitle>
          <DialogDescription className="sr-only">
            Cadastre uma empresa e seu principal contato.
          </DialogDescription>
          <LeadCreateHeader onClose={close} closeDisabled={isPending} />
          <div className="overflow-y-auto bg-background p-4 sm:p-5">
            <div className="flex flex-col gap-4">
              <m.div
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{ duration: reduced ? 0.12 : 0.16, ease: EASE }}
                className="flex items-start gap-2.5 rounded-lg bg-accent px-3 py-2.5 text-accent-foreground"
              >
                <RiInformationLine
                  size={16}
                  aria-hidden
                  className="mt-0.5 shrink-0 text-primary"
                />
                <p className="font-sans text-body-sm">
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
          </div>
          <DialogFooter className="border-t border-border p-3 sm:p-4">
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
            >
              {isPending ? (
                <RiLoader4Line data-icon="inline-start" aria-hidden className="animate-spin" />
              ) : (
                <RiSendPlaneLine data-icon="inline-start" aria-hidden />
              )}
              {isPending ? "Cadastrando…" : "Cadastrar lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
