"use client"

import { useState } from "react"
import { RiLinksLine, RiLoader4Line, RiRefreshLine } from "react-icons/ri"
import {
  analyzeLeadBacklinks,
  type LeadBacklinkAudit,
} from "@/app/actions/leads"
import { LeadGbpCard } from "@/components/custom/LeadGbpPanel/LeadGbpCard"
import { Button } from "@/components/ui/button"
import { formatRelativeShort } from "@/lib/date-time"
import type { BacklinkSnapshot } from "@/lib/leads/backlinks-audit"

function count(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("pt-BR")
}

/**
 * Cada métrica declara se foi medida. Ausente é `—`, nunca zero: um domínio sem
 * coleta não é um domínio sem autoridade, e a tela não pode confundir os dois.
 */
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-sans text-caption text-fg-muted">{label}</p>
      <p className="font-sans text-body-sm font-semibold tabular-nums text-fg">
        {value}
      </p>
    </div>
  )
}

function nofollowShare(snapshot: BacklinkSnapshot): string {
  if (snapshot.nofollowBacklinks === null || !snapshot.backlinks) return "—"
  const share = Math.round(
    (snapshot.nofollowBacklinks / snapshot.backlinks) * 100,
  )
  return `${share}%`
}

export function LeadWebsiteBacklinksCard({
  leadId,
  audit,
  canEdit,
  onAuditChange,
  onPendingChange,
}: {
  leadId: string
  audit: LeadBacklinkAudit | null
  canEdit: boolean
  onAuditChange: (audit: LeadBacklinkAudit) => void
  onPendingChange: (pending: boolean) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const snapshot = audit?.snapshot ?? null

  function handleAnalyze() {
    if (busy) return
    setBusy(true)
    onPendingChange(true)
    setError(null)
    const formData = new FormData()
    formData.set("lead_id", leadId)
    void analyzeLeadBacklinks(formData).then((result) => {
      setBusy(false)
      onPendingChange(false)
      if (result.status === "error") {
        setError(result.message)
        return
      }
      onAuditChange(result.audit)
    })
  }

  return (
    <LeadGbpCard title="Autoridade externa">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-sans text-caption text-fg-secondary">
            <RiLinksLine size={14} aria-hidden className="text-fg-muted" />
            {audit
              ? `Coletado ${formatRelativeShort(audit.fetched_at)}`
              : "Ainda não medido"}
          </span>
          {canEdit ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={handleAnalyze}
            >
              {busy ? (
                <RiLoader4Line
                  data-icon="inline-start"
                  aria-hidden
                  className="animate-spin"
                />
              ) : (
                <RiRefreshLine data-icon="inline-start" aria-hidden />
              )}
              {audit ? "Atualizar backlinks" : "Analisar backlinks"}
            </Button>
          ) : null}
        </div>

        {snapshot ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric label="Rank" value={count(snapshot.rank)} />
              <Metric label="Backlinks" value={count(snapshot.backlinks)} />
              <Metric
                label="Domínios"
                value={count(snapshot.referringDomains)}
              />
              <Metric
                label="Quebrados"
                value={count(snapshot.brokenBacklinks)}
              />
              <Metric label="Nofollow" value={nofollowShare(snapshot)} />
              <Metric
                label="Spam score"
                value={
                  snapshot.spamScore === null
                    ? "—"
                    : count(Math.round(snapshot.spamScore))
                }
              />
            </div>
            {snapshot.topTlds.length > 0 ? (
              <p className="font-sans text-caption text-fg-muted">
                Principais TLDs:{" "}
                {snapshot.topTlds
                  .map((item) => `${item.label} (${count(item.count)})`)
                  .join(" · ")}
              </p>
            ) : null}
          </>
        ) : (
          <p className="font-sans text-caption text-fg-muted">
            O resumo de backlinks ainda não foi coletado para este domínio.
          </p>
        )}

        {error ? (
          <p className="font-sans text-caption text-danger">{error}</p>
        ) : null}
      </div>
    </LeadGbpCard>
  )
}
