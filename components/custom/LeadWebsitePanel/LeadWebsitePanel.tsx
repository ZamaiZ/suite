"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiGlobalLine, RiStarFill } from "react-icons/ri"
import {
  analyzeLeadWebsite,
  pollLeadWebsiteJobs,
  updateLeadWebsiteAudit,
  type LeadWebsiteAudit,
} from "@/app/actions/leads"
import { LeadGbpOpportunitiesCard } from "@/components/custom/LeadGbpPanel/LeadGbpOpportunitiesCard"
import { LeadWebsiteChecks } from "./LeadWebsiteChecks"
import { LeadWebsiteReview } from "./LeadWebsiteReview"
import { LeadWebsiteScreenshots } from "./LeadWebsiteScreenshots"
import { LeadWebsiteStepHeader } from "./LeadWebsiteStepHeader"
import { LeadWebsiteSummaryCards } from "./LeadWebsiteSummaryCards"
import { LeadWebsiteBacklinksCard } from "./LeadWebsiteBacklinksCard"
import type { LeadWebsitePanelProps } from "./LeadWebsitePanel.types"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  digitalChannelDisplay,
  hrefForDigitalChannel,
  type LeadDigitalChannel,
} from "@/lib/leads/digital-channels"
import {
  napCheckForCrawl,
  websiteGapsForAudit,
} from "@/lib/leads/website-audit"
import {
  mergeWebsiteOpportunities,
  missingSecurityHeaderLabels,
  napMismatchLabels,
} from "@/lib/leads/website-opportunities"
import { backlinkOpportunitiesFromSnapshot } from "@/lib/leads/backlinks-opportunities"
import {
  websiteMinPerformance,
  websitePsiJobsActive,
  websitePsiJobsFailedWithoutReady,
} from "@/lib/leads/website-pagespeed"
import {
  websiteCheckSections,
  websiteReviewEvidence,
} from "@/lib/leads/website-presenters"
import {
  serializeWebsiteReviewDraft,
  websiteReviewDraft,
  type WebsiteReview,
} from "@/lib/leads/website-review"

const REVIEW_DEBOUNCE_MS = 800
const POLL_MS = 8000
const POLL_MAX_MS = 300_000
const EASE = [0.23, 1, 0.32, 1] as const

function websiteChannels(channels: LeadDigitalChannel[]): LeadDigitalChannel[] {
  return channels
    .filter((channel) => channel.type === "website" && channel.id)
    .sort((left, right) => {
      if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1
      return left.sort_order - right.sort_order
    })
}

function websiteJobsKey(audit: LeadWebsiteAudit | null): string {
  if (!audit) return ""
  return audit.jobs
    .filter((job) => job.status === "queued" || job.status === "running")
    .map((job) => job.kind)
    .sort()
    .join(",")
}

export function LeadWebsitePanel({
  detail,
  canEdit,
  onAuditChange,
  onBacklinkAuditChange,
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
  const [pollTimedOut, setPollTimedOut] = useState(false)
  const [reviewStatus, setReviewStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle")
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [liveReview, setLiveReview] = useState<WebsiteReview | null>(null)
  const reviewRef = useRef<WebsiteReview | null>(null)
  const reviewTimerRef = useRef(0)
  const auditRef = useRef<LeadWebsiteAudit | null>(null)
  const onAuditChangeRef = useRef(onAuditChange)
  onAuditChangeRef.current = onAuditChange

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
    detail.websiteAudits.find((item) => item.channel_id === selected?.id) ??
    null
  auditRef.current = audit
  const jobsKey = websiteJobsKey(audit)

  useEffect(() => {
    window.clearTimeout(reviewTimerRef.current)
    const current = auditRef.current
    const draft = current ? websiteReviewDraft(current.review) : null
    reviewRef.current = draft
    setLiveReview(draft)
    setReviewStatus("idle")
    setReviewError(null)
  }, [audit?.id])

  useEffect(() => {
    setPollTimedOut(false)
  }, [audit?.id, jobsKey])

  useEffect(() => {
    if (!canEdit || !audit || !jobsKey) return
    const auditId = audit.id
    let cancelled = false
    const startedAt = Date.now()

    async function tick() {
      if (cancelled) return
      if (Date.now() - startedAt >= POLL_MAX_MS) {
        setPollTimedOut(true)
        return
      }
      const formData = new FormData()
      formData.set("audit_id", auditId)
      const result = await pollLeadWebsiteJobs(formData)
      if (cancelled) return
      if (result.status === "error") {
        setError(result.message)
        return
      }
      onAuditChangeRef.current(result.audit)
    }

    void tick()
    const timer = window.setInterval(() => {
      void tick()
    }, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [canEdit, audit?.id, jobsKey])

  const primaryGbp =
    detail.gbpProfiles.find((profile) => profile.is_primary) ??
    detail.gbpProfiles[0] ??
    null
  const serviceTitles =
    primaryGbp?.enrichment?.services?.map((item) => item.title) ?? []
  const nap = primaryGbp
    ? {
        phone: primaryGbp.payload.nationalPhoneNumber,
        address: primaryGbp.payload.formattedAddress,
      }
    : null
  const gaps = audit
    ? websiteGapsForAudit(
        audit.crawl,
        detail.lead.company_name,
        nap,
        audit.pagespeed,
        serviceTitles,
      )
    : []
  const review = liveReview ?? audit?.review ?? null
  // Backlinks entra na mesma lista: é o pilar de Website, e a contagem tem que
  // bater com o badge da trilha, que soma os dois do mesmo jeito.
  const opportunities = [
    ...(audit
      ? mergeWebsiteOpportunities(
          gaps,
          {
            minPerformance: websiteMinPerformance(audit.pagespeed),
            missingSecurityHeaders: missingSecurityHeaderLabels(audit.crawl),
            napMismatches: napMismatchLabels(
              napCheckForCrawl(audit.crawl, nap),
            ),
          },
          review ?? audit.review,
        )
      : []),
    ...backlinkOpportunitiesFromSnapshot(
      detail.backlinkAudit?.snapshot ?? null,
    ),
  ].sort((left, right) => {
    if (left.impact !== right.impact) return left.impact === "high" ? -1 : 1
    return 0
  })
  const sections = audit
    ? websiteCheckSections(
        audit.crawl,
        gaps,
        audit.pagespeed,
        audit.jobs,
        detail.lead.company_name,
        review ?? audit.review,
      )
    : []
  const reviewEvidence = audit
    ? websiteReviewEvidence(audit.crawl, audit.pagespeed, gaps, nap)
    : null
  const siteHref = selected
    ? hrefForDigitalChannel(selected.type, selected.value)
    : null
  const jobsActive = audit ? websitePsiJobsActive(audit.jobs) : false
  const failedJobs = audit
    ? audit.jobs.filter((job) => job.status === "failed")
    : []

  async function persistReview(next: WebsiteReview) {
    const current = auditRef.current
    if (!current) return true
    if (
      serializeWebsiteReviewDraft(next) ===
      serializeWebsiteReviewDraft(current.review)
    ) {
      setReviewStatus("idle")
      return true
    }
    setReviewStatus("saving")
    setReviewError(null)
    const formData = new FormData()
    formData.set("audit_id", current.id)
    formData.set("review", serializeWebsiteReviewDraft(next))
    const result = await updateLeadWebsiteAudit(formData)
    if (result.status === "error") {
      setReviewStatus("error")
      setReviewError(result.message)
      return false
    }
    onAuditChange(result.audit)
    setLiveReview(websiteReviewDraft(result.audit.review))
    setReviewStatus("saved")
    return true
  }

  function handleReviewDraftChange(next: WebsiteReview) {
    reviewRef.current = next
    window.clearTimeout(reviewTimerRef.current)
    if (!canEdit || !auditRef.current) return
    if (
      serializeWebsiteReviewDraft(next) ===
      serializeWebsiteReviewDraft(auditRef.current.review)
    ) {
      return
    }
    reviewTimerRef.current = window.setTimeout(() => {
      const draft = reviewRef.current
      if (!draft) return
      setLiveReview(draft)
      void persistReview(draft)
    }, REVIEW_DEBOUNCE_MS)
  }

  function handleAnalyze() {
    if (!selected?.id || busy || jobsActive) return
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

  const channelItems = useMemo(
    () =>
      channels.map((channel) => ({
        value: channel.id ?? channel.normalized_key,
        label: digitalChannelDisplay(channel.type, channel.value),
      })),
    [channels],
  )

  if (!selected) {
    return (
      <Empty className="px-4 py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="size-12 rounded-xl">
            <RiGlobalLine size={22} aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Nenhum site cadastrado neste lead.</EmptyTitle>
        </EmptyHeader>
      </Empty>
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
        collecting={busy || jobsActive}
        canEdit={canEdit}
        onAnalyze={handleAnalyze}
      />

      {channels.length > 1 ? (
        <div className="max-w-sm">
          <Select
            items={channelItems}
            value={selected.id ?? ""}
            onValueChange={(value) => setSelectedId(String(value))}
          >
            <SelectTrigger
              id={`website-channel-${detail.lead.id}`}
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {channels.map((channel) => {
                const value = channel.id ?? channel.normalized_key
                return (
                  <SelectItem key={value} value={value}>
                    {digitalChannelDisplay(channel.type, channel.value)}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {selected.is_primary ? (
            <p className="mt-2 inline-flex items-center gap-1 text-xs/relaxed text-primary">
              <RiStarFill size={12} aria-hidden />
              Site principal
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs/relaxed text-destructive">
          {error}
        </p>
      ) : null}

      {jobsActive ? (
        <p className="text-xs/relaxed text-muted-foreground">
          Coletando PageSpeed…
        </p>
      ) : null}

      {pollTimedOut && jobsKey ? (
        <p className="text-xs/relaxed text-muted-foreground">
          Ainda coletando o PageSpeed — abra de novo.
        </p>
      ) : null}

      {audit && websitePsiJobsFailedWithoutReady(audit.jobs)
        ? failedJobs.map((job) => (
            <p
              key={job.kind}
              role="alert"
              className="text-xs/relaxed text-destructive"
            >
              {job.error_message ??
                "Não foi possível obter o PageSpeed. Tente novamente."}
            </p>
          ))
        : null}

      {audit ? (
        <>
          <LeadWebsiteSummaryCards crawl={audit.crawl} />
          <LeadWebsiteScreenshots pagespeed={audit.pagespeed} />
          <LeadWebsiteBacklinksCard
            leadId={detail.lead.id}
            audit={detail.backlinkAudit}
            canEdit={canEdit}
            onAuditChange={onBacklinkAuditChange}
            onPendingChange={onPendingChange}
          />
          {reviewEvidence ? (
            <LeadWebsiteReview
              auditId={audit.id}
              review={audit.review}
              evidence={reviewEvidence}
              canEdit={canEdit}
              status={reviewStatus}
              errorMessage={reviewError}
              onDraftChange={handleReviewDraftChange}
              onRetry={() => {
                if (reviewRef.current) void persistReview(reviewRef.current)
              }}
            />
          ) : null}
          <LeadWebsiteChecks sections={sections} />
          <LeadGbpOpportunitiesCard items={opportunities} />
        </>
      ) : (
        <Empty className="px-4 py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="size-12 rounded-xl">
              <RiGlobalLine size={22} aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Nenhuma coleta deste site</EmptyTitle>
            <EmptyDescription>
              Analise o website para montar a auditoria on-page.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </m.div>
  )
}
