"use client"

import { useState, useTransition } from "react"
import { Menu } from "@base-ui/react/menu"
import {
  RiCheckLine,
  RiFileCopyLine,
  RiKey2Line,
  RiLoader4Line,
  RiMore2Line,
  RiRefreshLine,
} from "react-icons/ri"
import {
  getClient,
  issuePortalAccess,
  rotatePortalAccess,
} from "@/app/actions/clients"
import { ClientPortalCodeReveal } from "@/components/custom/ClientPortalCodeReveal"
import { cn } from "@/lib/cn"
import type { ClientCardMenuProps } from "./ClientCardMenu.types"

const MENU_ITEM = cn(
  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 font-sans text-body-sm text-fg outline-none select-none",
  "data-highlighted:bg-hover",
  "data-disabled:pointer-events-none data-disabled:opacity-50",
)

type PortalState = {
  hasPortalAccess: boolean
  portalUrl: string | null
}

type Reveal = { code: string; url: string }

export function ClientCardMenu({ clientId }: ClientCardMenuProps) {
  const [portal, setPortal] = useState<PortalState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [copied, setCopied] = useState(false)
  const [reveal, setReveal] = useState<Reveal | null>(null)
  const [isPending, startTransition] = useTransition()
  const [loadingDetail, setLoadingDetail] = useState(false)

  async function ensurePortal(): Promise<PortalState | null> {
    if (portal) return portal
    setLoadingDetail(true)
    setLoadError(null)
    const result = await getClient(clientId)
    setLoadingDetail(false)
    if (result.status === "error") {
      setLoadError(result.message)
      return null
    }
    if (!result.client.canManagePortal) {
      setLoadError("Você não pode gerenciar o acesso deste cliente.")
      return null
    }
    const next: PortalState = {
      hasPortalAccess: result.client.hasPortalAccess,
      portalUrl: result.client.portalUrl,
    }
    setPortal(next)
    return next
  }

  function onOpenChange(open: boolean) {
    if (!open) {
      setConfirmRotate(false)
      setActionError(null)
      return
    }
    void ensurePortal()
  }

  function runIssue() {
    setActionError(null)
    const formData = new FormData()
    formData.set("client_id", clientId)
    startTransition(async () => {
      const result = await issuePortalAccess(formData)
      if (result.status === "error") {
        setActionError(result.message)
        return
      }
      setReveal({ code: result.code, url: result.url })
      setPortal({ hasPortalAccess: true, portalUrl: result.url })
    })
  }

  function runRotate() {
    setActionError(null)
    const formData = new FormData()
    formData.set("client_id", clientId)
    startTransition(async () => {
      const result = await rotatePortalAccess(formData)
      if (result.status === "error") {
        setActionError(result.message)
        return
      }
      setConfirmRotate(false)
      setReveal({ code: result.code, url: result.url })
      setPortal({ hasPortalAccess: true, portalUrl: result.url })
    })
  }

  async function copyLink() {
    const current = await ensurePortal()
    if (!current?.portalUrl) {
      setActionError("Link indisponível.")
      return
    }
    try {
      await navigator.clipboard.writeText(current.portalUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setActionError("Não foi possível copiar o link.")
    }
  }

  return (
    <>
      <Menu.Root onOpenChange={onOpenChange}>
        <Menu.Trigger
          aria-label="Ações do portal"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          className={cn(
            "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md",
            "text-fg-muted transition-[background-color,color,transform] duration-150 ease-out",
            "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-active-bg",
            "[@media(hover:hover)_and_(pointer:fine)]:hover:text-fg",
            "data-popup-open:bg-active-bg data-popup-open:text-fg",
            "active:scale-[0.97]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          )}
        >
          <RiMore2Line size={16} aria-hidden />
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
              {loadingDetail && !portal ? (
                <div className="flex items-center gap-2 px-2 py-1.5 font-sans text-body-sm text-fg-muted">
                  <RiLoader4Line size={16} aria-hidden className="animate-spin" />
                  Carregando…
                </div>
              ) : null}
              {loadError ? (
                <p
                  role="alert"
                  className="px-2 py-1.5 font-sans text-caption text-danger"
                >
                  {loadError}
                </p>
              ) : null}
              {portal && !portal.hasPortalAccess ? (
                <Menu.Item
                  disabled={isPending}
                  onClick={runIssue}
                  className={MENU_ITEM}
                >
                  <RiKey2Line size={16} aria-hidden />
                  {isPending ? "Gerando…" : "Gerar acesso"}
                </Menu.Item>
              ) : null}
              {portal?.hasPortalAccess ? (
                <>
                  <Menu.Item
                    disabled={isPending || !portal.portalUrl}
                    onClick={() => void copyLink()}
                    className={MENU_ITEM}
                  >
                    {copied ? (
                      <RiCheckLine size={16} aria-hidden />
                    ) : (
                      <RiFileCopyLine size={16} aria-hidden />
                    )}
                    {copied ? "Link copiado" : "Copiar link"}
                  </Menu.Item>
                  {confirmRotate ? (
                    <Menu.Item
                      disabled={isPending}
                      onClick={runRotate}
                      className={cn(MENU_ITEM, "text-danger data-highlighted:bg-danger/10")}
                    >
                      <RiRefreshLine size={16} aria-hidden />
                      {isPending ? "Rotacionando…" : "Confirmar rotação"}
                    </Menu.Item>
                  ) : (
                    <Menu.Item
                      closeOnClick={false}
                      disabled={isPending}
                      onClick={() => setConfirmRotate(true)}
                      className={MENU_ITEM}
                    >
                      <RiRefreshLine size={16} aria-hidden />
                      Rotacionar código
                    </Menu.Item>
                  )}
                </>
              ) : null}
              {confirmRotate ? (
                <p className="px-2 py-1 font-sans text-caption text-warning">
                  Invalida o código e a sessão atuais.
                </p>
              ) : null}
              {actionError ? (
                <p
                  role="alert"
                  className="px-2 py-1.5 font-sans text-caption text-danger"
                >
                  {actionError}
                </p>
              ) : null}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <ClientPortalCodeReveal
        open={reveal !== null}
        onClose={() => setReveal(null)}
        code={reveal?.code ?? ""}
        url={reveal?.url ?? ""}
      />
    </>
  )
}
