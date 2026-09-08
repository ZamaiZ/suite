"use client"

import { useEffect, useState, useTransition } from "react"
import { Menu } from "@base-ui/react/menu"
import { RiLoader4Line, RiMore2Line, RiUserAddLine, RiUserUnfollowLine } from "react-icons/ri"
import { claimLead, unclaimLead } from "@/app/actions/leads"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/cn"
import type { LeadClaimActionsProps } from "./LeadClaimActions.types"

const MENU_ITEM = cn(
  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5",
  "font-sans text-body-sm text-fg outline-none",
  "data-highlighted:bg-hover",
  "data-disabled:pointer-events-none data-disabled:opacity-50",
)

export function LeadClaimActions({
  leadId,
  canClaim,
  canUnclaim,
  createdByName = null,
  variant = "buttons",
  onSuccess,
  onPendingChange,
  onError,
}: LeadClaimActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{
    tone: "success" | "error"
    text: string
  } | null>(null)

  useEffect(() => {
    onPendingChange?.(isPending)
    return () => onPendingChange?.(false)
  }, [isPending, onPendingChange])

  const hasMenuMeta = Boolean(createdByName)
  const hasActions = canClaim || canUnclaim

  if (!hasActions && (variant === "buttons" || !hasMenuMeta)) return null

  function run(kind: "claim" | "unclaim") {
    setMessage(null)
    onError?.(null)
    const formData = new FormData()
    formData.set("lead_id", leadId)

    startTransition(async () => {
      const result =
        kind === "claim" ? await claimLead(formData) : await unclaimLead(formData)
      if (result.status === "error") {
        setMessage({ tone: "error", text: result.message })
        onError?.(result.message)
        return
      }
      onError?.(null)
      onSuccess?.(result)
    })
  }

  if (variant === "menu") {
    return (
      <Menu.Root>
        <Menu.Trigger
          disabled={isPending}
          aria-label="Mais ações"
          className={cn(
            "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md",
            "text-fg-muted transition-[background-color,color,transform] duration-150 ease-out",
            "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-active-bg",
            "[@media(hover:hover)_and_(pointer:fine)]:hover:text-fg",
            "data-popup-open:bg-active-bg data-popup-open:text-fg",
            "active:scale-[0.97]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {isPending ? (
            <RiLoader4Line size={16} aria-hidden className="animate-spin" />
          ) : (
            <RiMore2Line size={18} aria-hidden />
          )}
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner className="z-50 outline-none" sideOffset={4} align="end">
            <Menu.Popup
              className={cn(
                "pointer-events-auto min-w-44 rounded-md border border-popover-border bg-popover p-1 shadow-raised",
                "origin-[var(--transform-origin)]",
                "transition-[transform,opacity] duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
                "data-starting-style:opacity-0 data-starting-style:scale-[0.96]",
                "data-ending-style:opacity-0 data-ending-style:scale-[0.96] data-ending-style:duration-[140ms]",
                "motion-reduce:transition-opacity motion-reduce:duration-150",
                "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
              )}
            >
              {canClaim ? (
                <Menu.Item
                  disabled={isPending}
                  onClick={() => run("claim")}
                  className={MENU_ITEM}
                >
                  <RiUserAddLine size={16} aria-hidden />
                  Reivindicar
                </Menu.Item>
              ) : null}
              {canUnclaim ? (
                <Menu.Item
                  disabled={isPending}
                  onClick={() => run("unclaim")}
                  className={MENU_ITEM}
                >
                  <RiUserUnfollowLine size={16} aria-hidden />
                  Devolver à fila
                </Menu.Item>
              ) : null}
              {createdByName ? (
                <p className="px-2 py-1.5 font-sans text-caption text-fg-muted">
                  Criado por {createdByName}
                </p>
              ) : null}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {canClaim ? (
          <Button
            type="button"
            onClick={() => run("claim")}
            disabled={isPending}
          >
            {isPending ? (
              <RiLoader4Line data-icon="inline-start" aria-hidden className="animate-spin" />
            ) : (
              <RiUserAddLine data-icon="inline-start" aria-hidden />
            )}
            Reivindicar
          </Button>
        ) : null}
        {canUnclaim ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => run("unclaim")}
            disabled={isPending}
          >
            {isPending ? (
              <RiLoader4Line data-icon="inline-start" aria-hidden className="animate-spin" />
            ) : (
              <RiUserUnfollowLine data-icon="inline-start" aria-hidden />
            )}
            Devolver à fila
          </Button>
        ) : null}
      </div>
      {message ? (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={cn(
            "font-sans text-body-sm",
            message.tone === "error" ? "text-danger" : "text-success",
          )}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  )
}
