"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import {
  RiErrorWarningLine,
  RiExternalLinkLine,
  RiFileWordLine,
  RiLoader4Line,
  RiRefreshLine,
} from "react-icons/ri"
import {
  exportClientBriefingWord,
  getClientBriefingWordUrl,
  loadClientBriefingExport,
  type ClientBriefingExportState,
} from "@/app/actions/briefing"
import { Button } from "@/components/ui/button"
import { formatDateTimeShort } from "@/lib/date-time"

type Props = {
  clientId: string
  finalizedAt: string | null
  contentUpdatedAt: string | null
}

export function ClientBriefingExport({ clientId, finalizedAt, contentUpdatedAt }: Props) {
  const [state, setState] = useState<ClientBriefingExportState | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const refresh = useCallback(async () => {
    setMessage(null)
    setState(await loadClientBriefingExport(clientId))
  }, [clientId])

  useEffect(() => {
    if (finalizedAt) void refresh()
  }, [contentUpdatedAt, finalizedAt, refresh])

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
      setState({ status: "success", finalized: true, current: result.current, stale: false })
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
    <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-border-subtle bg-elevated/60 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-sans text-body-sm font-semibold text-fg">Documento Word</h3>
          {ready?.stale ? <span className="rounded-md bg-warning/10 px-2 py-0.5 font-sans text-caption font-medium text-warning">Desatualizado</span> : null}
        </div>
        {ready?.current ? <p className="mt-1 truncate font-sans text-caption text-fg-muted">Atual: {ready.current.fileName} · {formatDateTimeShort(ready.current.exportedAt)}</p> : <p className="mt-1 font-sans text-caption text-fg-muted">Gere um snapshot do briefing e do kickoff para compartilhar internamente.</p>}
        {message ? <p role="alert" className="mt-2 flex items-center gap-1.5 font-sans text-caption text-danger"><RiErrorWarningLine size={15} aria-hidden />{message}</p> : null}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {hasCurrent ? <Button type="button" variant="ghost" disabled={pending} onClick={openCurrent}><RiExternalLinkLine size={16} aria-hidden data-icon="inline-start" />Abrir atual</Button> : null}
        <Button type="button" variant={hasCurrent ? "secondary" : "default"} disabled={pending} onClick={generate}>{pending ? <RiLoader4Line size={16} aria-hidden data-icon="inline-start" className="animate-spin" /> : hasCurrent ? <RiRefreshLine size={16} aria-hidden data-icon="inline-start" /> : <RiFileWordLine size={16} aria-hidden data-icon="inline-start" />}{pending ? "Gerando…" : hasCurrent ? "Gerar nova versão" : "Gerar Word"}</Button>
      </div>
    </section>
  )
}
