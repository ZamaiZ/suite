"use client"

import { useState, useTransition } from "react"
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
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ClientCardMenuProps } from "./ClientCardMenu.types"

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
      <DropdownMenu onOpenChange={onOpenChange}>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" />}
          aria-label="Ações do portal"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <RiMore2Line size={16} aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
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
                <DropdownMenuItem
                  disabled={isPending}
                  onClick={runIssue}
                >
                  <RiKey2Line size={16} aria-hidden />
                  {isPending ? "Gerando…" : "Gerar acesso"}
                </DropdownMenuItem>
              ) : null}
              {portal?.hasPortalAccess ? (
                <>
                  <DropdownMenuItem
                    disabled={isPending || !portal.portalUrl}
                    onClick={() => void copyLink()}
                  >
                    {copied ? (
                      <RiCheckLine size={16} aria-hidden />
                    ) : (
                      <RiFileCopyLine size={16} aria-hidden />
                    )}
                    {copied ? "Link copiado" : "Copiar link"}
                  </DropdownMenuItem>
                  {confirmRotate ? (
                    <DropdownMenuItem
                      disabled={isPending}
                      onClick={runRotate}
                      variant="destructive"
                    >
                      <RiRefreshLine size={16} aria-hidden />
                      {isPending ? "Rotacionando…" : "Confirmar rotação"}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      closeOnClick={false}
                      disabled={isPending}
                      onClick={() => setConfirmRotate(true)}
                    >
                      <RiRefreshLine size={16} aria-hidden />
                      Rotacionar código
                    </DropdownMenuItem>
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
        </DropdownMenuContent>
      </DropdownMenu>

      <ClientPortalCodeReveal
        open={reveal !== null}
        onClose={() => setReveal(null)}
        code={reveal?.code ?? ""}
        url={reveal?.url ?? ""}
      />
    </>
  )
}
