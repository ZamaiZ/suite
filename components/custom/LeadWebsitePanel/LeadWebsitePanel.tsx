"use client"

import { useEffect, useRef, useState } from "react"
import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiGlobalLine, RiStarFill } from "react-icons/ri"
import {
  analyzeLeadWebsite,
  updateLeadWebsiteAudit,
  type LeadWebsiteAudit,
} from "@/app/actions/leads"
import { LeadGbpNotesCard } from "@/components/custom/LeadGbpPanel/LeadGbpNotesCard"
import { LeadGbpOpportunitiesCard } from "@/components/custom/LeadGbpPanel/LeadGbpOpportunitiesCard"
import { LeadWebsiteChecks } from "./LeadWebsiteChecks"
import { LeadWebsiteStepHeader } from "./LeadWebsiteStepHeader"
import { LeadWebsiteSummaryCards } from "./LeadWebsiteSummaryCards"
import type { LeadWebsitePanelProps } from "./LeadWebsitePanel.types"
import { Select } from "@/components/ui/Select"
import {
  digitalChannelDisplay,
  hrefForDigitalChannel,
  type LeadDigitalChannel,
} from "@/lib/leads/digital-channels"
import { websiteGapsForAudit } from "@/lib/leads/website-audit"
import { websiteOpportunitiesFromGaps } from "@/lib/leads/website-opportunities"
import { websiteCheckSections } from "@/lib/leads/website-presenters"

const NOTES_DEBOUNCE_MS = 800
const EASE = [0.23, 1, 0.32, 1] as const

function websiteChannels(channels: LeadDigitalChannel[]): LeadDigitalChannel[] {
  return channels
    .filter((channel) => channel.type === "website" && channel.id)
    .sort((left, right) => {
      if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1
      return left.sort_order - right.sort_order
    })
}

export function LeadWebsitePanel({
  detail,
  canEdit,
  onAuditChange,
  onPendingChange,
}: LeadWebsitePanelProps) {
  const reduced = !!useReducedMotion()
  const fade = {
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0.12 : 0.18, ease: EASE },
  }
  const channels = websiteChannels(detail.lead.channels)
  const [selectedId, setSelectedId] = useState<string | null>(
    channels[0]?.id ?? null,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notesStatus, setNotesStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle")
  const notesRef = useRef("")
  const notesTimerRef = useRef(0)
  const auditRef = useRef<LeadWebsiteAudit | null>(null)

  const channelKey = channels.map((channel) => channel.id).join(",")

  useEffect(() => {
    const next = websiteChannels(detail.lead.channels)
    setSelectedId((current) => {
      if (current && next.some((channel) => channel.id === current)) {
        return current
      }
      return next[0]?.id ?? null
    })
  }, [detail.lead.id, channelKey])

  const selected =
    channels.find((channel) => channel.id === selectedId) ?? channels[0] ?? null
  const audit =
    detail.websiteAudits.find(
      (item) => item.channel_id === selected?.id,
    ) ?? null
  auditRef.current = audit

  useEffect(() => {
    notesRef.current = audit?.notes ?? ""
    setNotesStatus("idle")
  }, [audit?.id])

  const primaryGbp =
    detail.gbpProfiles.find((profile) => profile.is_primary) ??
    detail.gbpProfiles[0] ??
    null
  const gaps = audit
    ? websiteGapsForAudit(audit.crawl, detail.lead.company_name, primaryGbp
        ? {
            phone: primaryGbp.payload.nationalPhoneNumber,
            address: primaryGbp.payload.formattedAddress,
          }
        : null)
    : []
  const opportunities = websiteOpportunitiesFromGaps(gaps)
  const sections = audit ? websiteCheckSections(audit.crawl, gaps) : []
  const siteHref = selected
    ? hrefForDigitalChannel(selected.type, selected.value)
    : null

  async function persistNotes(next: string) {
    const current = auditRef.current
    if (!current) return true
    if (next.trim() === (current.notes ?? "")) {
      setNotesStatus("idle")
      return true
    }
    setNotesStatus("saving")
    setError(null)
    const formData = new FormData()
    formData.set("audit_id", current.id)
    formData.set("notes", next)
    const result = await updateLeadWebsiteAudit(formData)
    if (result.status === "error") {
      setNotesStatus("error")
      setError(result.message)
      return false
    }
    onAuditChange(result.audit)
    setNotesStatus("saved")
    return true
  }

  function handleDraftChange(next: string) {
    notesRef.current = next
    window.clearTimeout(notesTimerRef.current)
    if (!canEdit || !auditRef.current) return
    if (next.trim() === (auditRef.current.notes ?? "")) return
    notesTimerRef.current = window.setTimeout(() => {
      void persistNotes(notesRef.current)
    }, NOTES_DEBOUNCE_MS)
  }

  function handleAnalyze() {
    if (!selected?.id || busy) return
    setBusy(true)
    onPendingChange(true)
    setError(null)
    const formData = new FormData()
    formData.set("channel_id", selected.id)
    void analyzeLeadWebsite(formData).then((result) => {
      setBusy(false)
      onPendingChange(false)
      if (result.status === "error") {
        setError(result.message)
        return
      }
      onAuditChange(result.audit)
    })
  }

  if (!selected) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-8">
        <span
          aria-hidden
          className="inline-flex size-12 items-center justify-center rounded-xl bg-hover text-fg-muted"
        >
          <RiGlobalLine size={22} />
        </span>
        <p className="font-sans text-caption text-fg-secondary">
          Nenhum site cadastrado neste lead.
        </p>
      </div>
    )
  }

  return (
    <m.div
      initial={fade.initial}
      animate={fade.animate}
      transition={fade.transition}
      className="flex flex-col gap-3"
    >
      <LeadWebsiteStepHeader
        updatedAt={audit?.fetched_at ?? null}
        siteHref={siteHref}
        collecting={busy}
        canEdit={canEdit}
        onAnalyze={handleAnalyze}
      />

      {channels.length > 1 ? (
        <div className="max-w-sm">
          <Select
            id={`website-channel-${detail.lead.id}`}
            items={channels.map((channel) => ({
              value: channel.id ?? channel.normalized_key,
              label: digitalChannelDisplay(channel.type, channel.value),
            }))}
            value={selected.id ?? ""}
            searchable={false}
            onValueChange={(value) => {
              if (typeof value === "string" && value) setSelectedId(value)
            }}
          />
          {selected.is_primary ? (
            <p className="mt-2 inline-flex items-center gap-1 font-sans text-caption text-accent">
              <RiStarFill size={12} aria-hidden />
              Site principal
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="font-sans text-body-sm text-danger">
          {error}
        </p>
      ) : null}

      {audit ? (
        <>
          <LeadWebsiteSummaryCards crawl={audit.crawl} />
          <LeadWebsiteChecks sections={sections} />
          <LeadGbpOpportunitiesCard items={opportunities} />
          <LeadGbpNotesCard
            id={`website-notes-${audit.id}`}
            profileId={audit.id}
            initialValue={audit.notes ?? ""}
            canEdit={canEdit}
            status={notesStatus}
            errorMessage={error}
            onDraftChange={handleDraftChange}
            onRetry={() => {
              void persistNotes(notesRef.current)
            }}
            placeholder="CTAs, design, o que a coleta não vê"
          />
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 px-4 py-8">
          <span
            aria-hidden
            className="inline-flex size-12 items-center justify-center rounded-xl bg-hover text-fg-muted"
          >
            <RiGlobalLine size={22} />
          </span>
          <div className="max-w-sm text-center">
            <p className="font-sans text-caption text-fg-secondary">
              Nenhuma coleta deste site
            </p>
            <p className="mt-1 font-sans text-caption text-fg-muted">
              Analise o website para montar a auditoria on-page.
            </p>
          </div>
        </div>
      )}
    </m.div>
  )
}
