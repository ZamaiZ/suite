"use client"

import { useEffect, useState, useTransition } from "react"
import { RiMore2Line, RiUserAddLine, RiUserUnfollowLine } from "react-icons/ri"
import { claimLead, unclaimLead } from "@/app/actions/leads"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "cn"
import type { LeadClaimActionsProps } from "./LeadClaimActions.types"

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
        kind === "claim"
          ? await claimLead(formData)
          : await unclaimLead(formData)
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
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" />}
          disabled={isPending}
          aria-label="Mais ações"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {isPending ? (
            <Spinner aria-hidden className="size-4" />
          ) : (
            <RiMore2Line size={18} aria-hidden />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {canClaim ? (
            <DropdownMenuItem disabled={isPending} onClick={() => run("claim")}>
              <RiUserAddLine size={16} aria-hidden />
              Reivindicar
            </DropdownMenuItem>
          ) : null}
          {canUnclaim ? (
            <DropdownMenuItem
              disabled={isPending}
              onClick={() => run("unclaim")}
            >
              <RiUserUnfollowLine size={16} aria-hidden />
              Devolver à fila
            </DropdownMenuItem>
          ) : null}
          {createdByName ? (
            <p className="px-2 py-1.5 text-xs/relaxed text-muted-foreground">
              Criado por {createdByName}
            </p>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
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
              <Spinner
                data-icon="inline-start"
                aria-hidden
                className="size-3.5"
              />
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
              <Spinner
                data-icon="inline-start"
                aria-hidden
                className="size-3.5"
              />
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
            "text-xs/relaxed",
            message.tone === "error" ? "text-destructive" : "text-success",
          )}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  )
}
