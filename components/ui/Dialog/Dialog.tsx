"use client"

import { createContext, useContext, useEffect, useId, useRef, useState } from "react"
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  useReducedMotion,
} from "motion/react"
import * as m from "motion/react-m"
import { RiCloseLine } from "react-icons/ri"
import { cn } from "@/lib/cn"
import { Button } from "@/components/ui/Button"
import type { DialogProps, DialogSize } from "./Dialog.types"

const DialogPortalContext = createContext<HTMLElement | null>(null)

export function useDialogPortalContainer() {
  return useContext(DialogPortalContext)
}

const EASE = [0.23, 1, 0.32, 1] as const

const SPRING = {
  type: "spring" as const,
  stiffness: 420,
  damping: 28,
  mass: 0.8,
}

const SCRIM_VARIANTS = {
  hidden: { opacity: 0, transition: { duration: 0.15, ease: EASE } },
  visible: { opacity: 1, transition: { duration: 0.2, ease: EASE } },
}

const PANEL_VARIANTS = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    y: 10,
    filter: "blur(4px)",
    transition: {
      opacity: { duration: 0.16, ease: EASE },
      filter: { duration: 0.16, ease: EASE },
      scale: { duration: 0.16, ease: EASE },
      y: { duration: 0.16, ease: EASE },
    },
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      opacity: { duration: 0.2, ease: EASE },
      filter: { duration: 0.2, ease: EASE },
      scale: SPRING,
      y: SPRING,
    },
  },
}

const SCRIM_REDUCED = {
  hidden: { opacity: 0, transition: { duration: 0.1 } },
  visible: { opacity: 1, transition: { duration: 0.12 } },
}

const PANEL_REDUCED = {
  hidden: { opacity: 0, transition: { duration: 0.1 } },
  visible: { opacity: 1, transition: { duration: 0.12 } },
}

const PANEL_ENTER = {
  opacity: 0,
  scale: 0.92,
  y: 18,
  filter: "blur(8px)",
}

const PANEL_SIZE_CLASSES: Record<DialogSize, string> = {
  default: "flex max-h-[min(90vh,40rem)] max-w-lg flex-col overflow-hidden",
  lg: "flex h-[min(92vh,56rem)] w-[min(72rem,calc(100vw-2rem))] flex-col overflow-hidden",
  xl: "flex h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden",
}

const BODY_SIZE_CLASSES: Record<DialogSize, string> = {
  default: "min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5",
  lg: "flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-5",
  xl: "flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-5",
}

export function Dialog({
  open,
  onClose,
  onExited,
  title,
  description,
  header,
  children,
  footer,
  className,
  bodyClassName,
  size = "default",
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()
  const reduced = !!useReducedMotion()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (open) {
      if (!node.open) node.showModal()
      setVisible(true)
      return
    }
    setVisible(false)
  }, [open])

  function onExitComplete() {
    const node = ref.current
    if (!open && node?.open) node.close()
    if (!open) onExited?.()
  }

  const scrimVariants = reduced ? SCRIM_REDUCED : SCRIM_VARIANTS
  const panelVariants = reduced ? PANEL_REDUCED : PANEL_VARIANTS

  return (
    <LazyMotion features={domAnimation} strict>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onCancel={(event) => {
          event.preventDefault()
          onClose()
        }}
        className={cn(
          "relative m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 text-fg",
          "open:flex open:items-center open:justify-center",
        )}
      >
        <DialogPortalContext.Provider value={portalNode}>
          <div
            ref={setPortalNode}
            className="pointer-events-none absolute inset-0 z-50"
          />
          <AnimatePresence onExitComplete={onExitComplete}>
          {visible ? (
            <m.div
              key="scrim"
              variants={scrimVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              aria-hidden
              onClick={onClose}
              className="absolute inset-0 bg-scrim backdrop-blur-[16px]"
            />
          ) : null}
          {visible ? (
            <m.div
              key="panel"
              variants={panelVariants}
              initial={reduced ? "hidden" : PANEL_ENTER}
              animate="visible"
              exit="hidden"
              role="document"
              className={cn(
                "relative z-10 w-[calc(100%-1.5rem)]",
                PANEL_SIZE_CLASSES[size],
                "rounded-3xl border border-border bg-elevated/85 shadow-dialog backdrop-blur-xl",
                "motion-safe:transition-[width,height] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transition-none",
                className,
              )}
              style={{ transformOrigin: "50% 85%" }}
            >
              {header ? (
                <>
                  <h2 id={titleId} className="sr-only">
                    {title}
                  </h2>
                  {description ? (
                    <p id={descriptionId} className="sr-only">
                      {description}
                    </p>
                  ) : null}
                  {header}
                </>
              ) : (
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-subtle px-4 py-4 sm:px-5">
                  <div className="min-w-0">
                    <h2
                      id={titleId}
                      className="font-display text-title font-semibold text-fg"
                    >
                      {title}
                    </h2>
                    {description ? (
                      <p
                        id={descriptionId}
                        className="mt-1 font-sans text-body-sm text-fg-muted"
                      >
                        {description}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Fechar"
                    onClick={onClose}
                    className="size-9 shrink-0 px-0"
                  >
                    <RiCloseLine size={18} aria-hidden />
                  </Button>
                </div>
              )}
              <div className={cn(BODY_SIZE_CLASSES[size], bodyClassName)}>
                {children}
              </div>
              {footer ? (
                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border-subtle px-4 py-3 sm:px-5">
                  {footer}
                </div>
              ) : null}
            </m.div>
          ) : null}
        </AnimatePresence>
        </DialogPortalContext.Provider>
      </dialog>
    </LazyMotion>
  )
}
