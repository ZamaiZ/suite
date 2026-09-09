"use client"

import { useEffect, useState, useTransition } from "react"
import {
  RiErrorWarningLine,
  RiExternalLinkLine,
  RiFileWordLine,
  RiRefreshLine,
} from "react-icons/ri"
import {
  exportClientBriefingWord,
  getClientBriefingWordUrl,
  loadClientBriefingExport,
  type ClientBriefingExportState,
} from "@/app/actions/briefing"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDateTimeShort } from "@/lib/date-time"

type Props = {
  clientId: string
  finalizedAt: string | null
  contentUpdatedAt: string | null
}

export function ClientBriefingExport({
  clientId,
  finalizedAt,
  contentUpdatedAt,
}: Props) {
  const [state, setState] = useState<ClientBriefingExportState | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // A mensagem some quando a chave muda; o fetch fica no efeito.
  const exportKey = finalizedAt ? `${clientId}|${contentUpdatedAt ?? ""}` : null
  const [syncedExportKey, setSyncedExportKey] = useState(exportKey)
  if (syncedExportKey !== exportKey) {
    setSyncedExportKey(exportKey)
    setMessage(null)
  }

  useEffect(() => {
    if (!finalizedAt) return
    let cancelled = false
    void loadClientBriefingExport(clientId).then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [clientId, contentUpdatedAt, finalizedAt])

  if (!finalizedAt) return null

  function openUrl(url: string) {
    if (url) window.open(url, "_blank", "noopener,noreferrer")
  }

  function generate() {
    setMessage(null)
    startTransition(async () => {
      const result = await exportClientBriefingWord(clientId)
      if (result.status === "error") {
        setMessage(result.message)
        return
      }
      setState({
        status: "success",
        finalized: true,
        current: result.current,
        stale: false,
      })
      openUrl(result.url)
    })
  }

  function openCurrent() {
    setMessage(null)
    startTransition(async () => {
      const result = await getClientBriefingWordUrl(clientId)
      if (result.status === "error") {
        setMessage(result.message)
        return
      }
      openUrl(result.url)
    })
  }

  const ready = state?.status === "success" ? state : null
  const hasCurrent = Boolean(ready?.current)
  return (
    <Card
      render={<section />}
      className="mb-5 bg-popover/60 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-heading text-sm font-semibold text-foreground">
            Documento Word
          </h3>
          {ready?.stale ? <Badge variant="warning">Desatualizado</Badge> : null}
        </div>
        {ready?.current ? (
          <p className="mt-1 truncate text-xs/relaxed text-muted-foreground">
            Atual: {ready.current.fileName} ·{" "}
            {formatDateTimeShort(ready.current.exportedAt)}
          </p>
        ) : (
          <p className="mt-1 text-xs/relaxed text-muted-foreground">
            Gere um snapshot do briefing e do kickoff para compartilhar
            internamente.
          </p>
        )}
        {message ? (
          <p
            role="alert"
            className="mt-2 flex items-center gap-1.5 text-xs/relaxed text-destructive"
          >
            <RiErrorWarningLine size={15} aria-hidden />
            {message}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {hasCurrent ? (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={openCurrent}
          >
            <RiExternalLinkLine
              size={16}
              aria-hidden
              data-icon="inline-start"
            />
            Abrir atual
          </Button>
        ) : null}
        <Button
          type="button"
          variant={hasCurrent ? "secondary" : "default"}
          disabled={pending}
          onClick={generate}
        >
          {pending ? (
            <Spinner data-icon="inline-start" aria-hidden className="size-4" />
          ) : hasCurrent ? (
            <RiRefreshLine size={16} aria-hidden data-icon="inline-start" />
          ) : (
            <RiFileWordLine size={16} aria-hidden data-icon="inline-start" />
          )}
          {pending
            ? "Gerando…"
            : hasCurrent
              ? "Gerar nova versão"
              : "Gerar Word"}
        </Button>
      </div>
    </Card>
  )
}
