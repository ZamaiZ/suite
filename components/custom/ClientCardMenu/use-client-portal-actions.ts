"use client"

import { useState, useTransition } from "react"
import {
  getClient,
  issuePortalAccess,
  rotatePortalAccess,
} from "@/app/actions/clients"

/**
 * As ações do portal do cliente, sem tela.
 *
 * Existe porque o mesmo menu abre em três lugares — clique direito no card,
 * setinha do card e cabeçalho do diálogo — e três cópias da mesma lógica
 * divergiriam na primeira alteração. Uma instância do hook alimenta os dois
 * menus de um card, então abrir por um caminho ou por outro carrega o portal
 * uma vez só.
 */

type PortalState = {
  hasPortalAccess: boolean
  portalUrl: string | null
}

/**
 * O estado do portal que a tela já tem em mãos.
 *
 * Quando vem preenchido, o menu abre pronto e **nenhuma** consulta acontece: a
 * listagem de clientes já lê a mesma linha de `clients` de onde estes campos
 * saem. Sem ele, o hook volta a buscar sob demanda — que é o caso de quem não
 * tem a lista no escopo.
 */
export type ClientPortalSnapshot = {
  canManagePortal: boolean
  hasPortalAccess: boolean
  portalUrl: string | null
}

const NO_PERMISSION = "Você não pode gerenciar o acesso deste cliente."

type Reveal = { code: string; url: string }

export type ClientPortalActions = {
  portal: PortalState | null
  loadingDetail: boolean
  loadError: string | null
  actionError: string | null
  confirmRotate: boolean
  copied: boolean
  isPending: boolean
  reveal: Reveal | null
  closeReveal: () => void
  /** Passe no `onOpenChange` de cada raiz de menu que usa estas ações. */
  handleOpenChange: (open: boolean) => void
  askRotate: () => void
  runIssue: () => void
  runRotate: () => void
  copyLink: () => void
}

export function useClientPortalActions(
  clientId: string,
  snapshot?: ClientPortalSnapshot,
): ClientPortalActions {
  const [portal, setPortal] = useState<PortalState | null>(
    snapshot?.canManagePortal
      ? {
          hasPortalAccess: snapshot.hasPortalAccess,
          portalUrl: snapshot.portalUrl,
        }
      : null,
  )
  // Sem permissão, a mensagem é a mesma que o `getClient` devolvia — ela só
  // deixou de custar uma ida ao banco para ser descoberta.
  const [loadError, setLoadError] = useState<string | null>(
    snapshot && !snapshot.canManagePortal ? NO_PERMISSION : null,
  )
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [copied, setCopied] = useState(false)
  const [reveal, setReveal] = useState<Reveal | null>(null)
  const [isPending, startTransition] = useTransition()
  const [loadingDetail, setLoadingDetail] = useState(false)

  async function ensurePortal(): Promise<PortalState | null> {
    if (portal) return portal
    // Com estado vindo da tela não há o que buscar: ou já está em `portal`, ou
    // a permissão não existe e `loadError` já diz isso.
    if (snapshot) return null
    setLoadingDetail(true)
    setLoadError(null)
    const result = await getClient(clientId)
    setLoadingDetail(false)
    if (result.status === "error") {
      setLoadError(result.message)
      return null
    }
    if (!result.client.canManagePortal) {
      setLoadError(NO_PERMISSION)
      return null
    }
    const next: PortalState = {
      hasPortalAccess: result.client.hasPortalAccess,
      portalUrl: result.client.portalUrl,
    }
    setPortal(next)
    return next
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      // A confirmação de rotação não sobrevive ao fechamento: reabrir o menu
      // já armado seria um clique de distância de invalidar o acesso.
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

  function copyLink() {
    void (async () => {
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
    })()
  }

  return {
    portal,
    loadingDetail,
    loadError,
    actionError,
    confirmRotate,
    copied,
    isPending,
    reveal,
    closeReveal: () => setReveal(null),
    handleOpenChange,
    askRotate: () => setConfirmRotate(true),
    runIssue,
    runRotate,
    copyLink,
  }
}
