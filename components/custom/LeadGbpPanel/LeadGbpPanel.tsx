"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiAlertLine, RiMapPin2Line } from "react-icons/ri"
import { linkLeadGbpProfile, type LeadGbpProfile } from "@/app/actions/leads"
import { LeadDigitalPresencePanel } from "@/components/custom/LeadDigitalPresencePanel"
import { LeadDiagnosisPanel } from "@/components/custom/LeadDiagnosisPanel"
import { LeadVisibilityPanel } from "@/components/custom/LeadVisibilityPanel"
import { LeadWebsitePanel } from "@/components/custom/LeadWebsitePanel"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/cn"
import { todayCivilDate } from "@/lib/date-time"
import { gbpJobQueued } from "@/lib/leads/gbp-audit"
import {
  gbpGapsForProfile,
  gbpWebsiteCoverage,
  websiteKeysFromChannels,
} from "@/lib/leads/gbp"
import { type GbpAuditRailStepId } from "@/lib/leads/gbp-audit-rail"
import { diagnosisFactsFingerprint } from "@/lib/leads/diagnosis-document"
import { websiteGapsForAudit } from "@/lib/leads/website-audit"
import {
  mergeWebsiteOpportunities,
  missingSecurityHeaderLabels,
} from "@/lib/leads/website-opportunities"
import { websiteMinPerformance } from "@/lib/leads/website-pagespeed"
import {
  digitalPresenceReviewForChannels,
  isDigitalPresenceComplete,
  socialChannelsFromLead,
} from "@/lib/leads/digital-presence"
import { emptyDigitalPresenceReview } from "@/lib/leads/digital-presence-review"
import { mergeDigitalPresenceOpportunities } from "@/lib/leads/digital-presence-opportunities"
import {
  leadLocationSearchHint,
  resolveLeadLocation,
} from "@/lib/leads/resolve-location"
import {
  visibilityGapsForSnapshot,
} from "@/lib/leads/visibility-audit"
import { LeadGbpAuditRail } from "./LeadGbpAuditRail"
import { LeadGbpPlacePicker } from "./LeadGbpPlacePicker"
import { LeadGbpProfileCard } from "./LeadGbpProfileCard"
import type { LeadGbpPanelProps } from "./LeadGbpPanel.types"

const EASE = [0.23, 1, 0.32, 1] as const

export function LeadGbpPanel({
  detail,
  loading,
  readOnly,
  onProfilesChange,
  onWebsiteAuditsChange,
  onDigitalPresenceChange,
  onVisibilityChange,
  onDiagnosisDraftChange,
  onDiagnosisExportsChange,
  onPendingChange,
}: LeadGbpPanelProps) {
  const reduced = !!useReducedMotion()
  const fade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: reduced ? 0.12 : 0.18, ease: EASE },
  }
  const [linkError, setLinkError] = useState<string | null>(null)
  const [existingLeadId, setExistingLeadId] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedStep, setSelectedStep] =
    useState<GbpAuditRailStepId>("google-profile")
  const leadIdRef = useRef<string | null>(detail?.lead.id ?? null)
  leadIdRef.current = detail?.lead.id ?? null

  const profiles = detail?.gbpProfiles ?? []

  useEffect(() => {
    setLinkError(null)
    setExistingLeadId(null)
    setLinking(false)
    setPickerOpen(false)
    setSelectedStep("google-profile")
  }, [detail?.lead.id])

  useEffect(() => {
    const preferred =
      profiles.find((item) => item.is_primary)?.id ?? profiles[0]?.id ?? null
    setSelectedId((current) => {
      if (current && profiles.some((item) => item.id === current)) {
        return current
      }
      return preferred
    })
  }, [profiles])

  const selected =
    profiles.find((item) => item.id === selectedId) ?? profiles[0] ?? null

  if (loading && !detail) {
    return (
      <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[17rem_minmax(0,1fr)] lg:grid-rows-1">
        <aside className="border-b border-border-subtle bg-elevated/70 lg:border-r lg:border-b-0">
        <LeadGbpAuditRail
          profile={null}
          website={null}
          digitalPresence={null}
          visibility={null}
          diagnosis={null}
          selectedStep="google-profile"
          loading
          onSelectStep={() => undefined}
        />
        </aside>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
          <Pulse className="h-16" delay={0} />
          <Pulse className="h-24" delay={40} />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Pulse className="h-16" delay={80} />
            <Pulse className="h-16" delay={120} />
            <Pulse className="h-16" delay={160} />
            <Pulse className="h-16" delay={200} />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Pulse className="h-48" delay={240} />
            <Pulse className="h-48" delay={280} />
            <Pulse className="h-48" delay={320} />
          </div>
          <Pulse className="h-32" delay={360} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Pulse className="h-48" delay={400} />
            <Pulse className="h-48" delay={440} />
            <Pulse className="h-48 md:col-span-2 xl:col-span-1" delay={480} />
          </div>
        </div>
      </div>
    )
  }

  if (!detail) return null

  const currentLeadId = detail.lead.id
  const canEdit = detail.canEditGbp && !readOnly
  const websiteKeys = websiteKeysFromChannels(detail.lead.channels)
  const coverage = gbpWebsiteCoverage(websiteKeys, profiles)
  const showPicker = canEdit && (profiles.length === 0 || pickerOpen)
  const uncoveredCount = coverage.uncoveredWebsiteKeys.length
  const alertCount = selected
    ? gbpGapsForProfile(
        selected.payload,
        detail.lead.company_name,
        selected.matched_website_key,
        selected.enrichment,
        {
          posts: selected.posts,
          postsReady:
            selected.posts !== null &&
            !gbpJobQueued(selected.jobs, "updates"),
          reviews: selected.reviews,
          reviewsReady:
            selected.reviews !== null &&
            !gbpJobQueued(selected.jobs, "reviews"),
          qna: selected.qna,
          rankKeywords: selected.rank_keywords,
          rankChecks: selected.rankChecks,
        },
      ).length
    : 0
  const primaryWebsiteChannel =
    detail.lead.channels
      .filter((channel) => channel.type === "website" && channel.id)
      .sort((left, right) => {
        if (left.is_primary !== right.is_primary) {
          return left.is_primary ? -1 : 1
        }
        return left.sort_order - right.sort_order
      })[0] ?? null
  const websiteAudit =
    detail.websiteAudits.find(
      (item) => item.channel_id === primaryWebsiteChannel?.id,
    ) ??
    detail.websiteAudits[0] ??
    null
  const primaryGbp =
    profiles.find((item) => item.is_primary) ?? profiles[0] ?? null
  const websiteGaps = websiteAudit
    ? websiteGapsForAudit(
        websiteAudit.crawl,
        detail.lead.company_name,
        primaryGbp
          ? {
              phone: primaryGbp.payload.nationalPhoneNumber,
              address: primaryGbp.payload.formattedAddress,
            }
          : null,
        websiteAudit.pagespeed,
        primaryGbp?.enrichment?.services.map((item) => item.title) ?? [],
      )
    : []
  const websiteAlertCount = websiteAudit
    ? mergeWebsiteOpportunities(
        websiteGaps,
        {
          minPerformance: websiteMinPerformance(websiteAudit.pagespeed),
          missingSecurityHeaders: missingSecurityHeaderLabels(websiteAudit.crawl),
        },
        websiteAudit.review,
      ).length
    : 0
  const presenceReview = digitalPresenceReviewForChannels(
    detail.digitalPresenceAudit?.review ?? emptyDigitalPresenceReview(),
    detail.lead.channels,
  )
  const presenceToday = todayCivilDate()
  const presenceAlertCount = mergeDigitalPresenceOpportunities({
    signals: websiteAudit?.crawl.signals ?? null,
    channels: detail.lead.channels,
    review: presenceReview,
    today: presenceToday,
  }).length
  const presenceComplete = isDigitalPresenceComplete(
    presenceReview,
    detail.lead.channels,
  )
  const hasPresenceWork =
    detail.digitalPresenceAudit !== null ||
    socialChannelsFromLead(detail.lead.channels).length > 0 ||
    presenceReview.identity.verdict !== null
  const visibilityLocation = resolveLeadLocation(
    {
      city: detail.lead.city,
      state_code: detail.lead.state_code,
      segment: detail.lead.segment,
    },
    primaryGbp
      ? { formattedAddress: primaryGbp.payload.formattedAddress ?? null }
      : null,
  )
  const visibilityCity = visibilityLocation.city
  const gbpLocationHint = leadLocationSearchHint(
    {
      city: detail.lead.city,
      state_code: detail.lead.state_code,
      segment: detail.lead.segment,
    },
    detail.lead.company_name,
  )
  const visibilityAlertCount = detail.visibilityAudit
    ? visibilityGapsForSnapshot({
        snapshot: detail.visibilityAudit.snapshot,
        companyName: detail.lead.company_name,
        city: visibilityCity,
      }).length
    : 0
  const diagnosisUnlocked =
    Boolean(selected?.enrichment_at) &&
    websiteAudit != null &&
    presenceComplete &&
    detail.visibilityAudit != null
  const liveFingerprint = diagnosisFactsFingerprint({
    gbpFetchedAt: primaryGbp?.fetched_at ?? null,
    gbpEnrichmentAt: primaryGbp?.enrichment_at ?? null,
    websiteFetchedAt: websiteAudit?.fetched_at ?? null,
    websitePagespeedAt: websiteAudit?.pagespeed_at ?? null,
    presenceUpdatedAt: detail.digitalPresenceAudit?.updated_at ?? null,
    visibilityFetchedAt: detail.visibilityAudit?.fetched_at ?? null,
  })
  const diagnosisStale = Boolean(
    detail.diagnosisDraft &&
      detail.diagnosisDraft.facts_fingerprint !== liveFingerprint,
  )
  const hasDiagnosisExport = detail.diagnosisExports.some(
    (item) => item.is_current,
  )

  function replaceProfile(next: LeadGbpProfile) {
    const others = profiles.filter((item) => item.id !== next.id)
    const synced = next.is_primary
      ? others.map((item) => ({ ...item, is_primary: false }))
      : others
    onProfilesChange(
      next.lead_id,
      [...synced, next].sort((left, right) => {
        if (left.is_primary !== right.is_primary) {
          return left.is_primary ? -1 : 1
        }
        return left.sort_order - right.sort_order
      }),
    )
    setSelectedId(next.id)
    setPickerOpen(false)
  }

  function removeProfile(profileId: string) {
    const removed = profiles.find((item) => item.id === profileId)
    const remaining = profiles.filter((item) => item.id !== profileId)
    if (!removed?.is_primary || remaining.length === 0) {
      onProfilesChange(currentLeadId, remaining)
      return
    }
    const nextPrimaryId = [...remaining].sort(
      (left, right) => left.sort_order - right.sort_order,
    )[0]?.id
    onProfilesChange(
      currentLeadId,
      remaining.map((item) => ({
        ...item,
        is_primary: item.id === nextPrimaryId,
      })),
    )
  }

  function handlePick(placeId: string, sessionToken: string) {
    if (!detail || linking) return
    const leadId = detail.lead.id
    setLinking(true)
    onPendingChange(true)
    setLinkError(null)
    setExistingLeadId(null)
    const formData = new FormData()
    formData.set("lead_id", leadId)
    formData.set("place_id", placeId)
    formData.set("session_token", sessionToken)
    void linkLeadGbpProfile(formData).then((result) => {
      if (leadIdRef.current !== leadId) {
        onPendingChange(false)
        return
      }
      setLinking(false)
      onPendingChange(false)
      if (result.status === "conflict") {
        setLinkError(result.message)
        setExistingLeadId(result.existingLeadId)
        return
      }
      if (result.status === "error") {
        setLinkError(result.message)
        return
      }
      replaceProfile(result.profile)
    })
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[17rem_minmax(0,1fr)] lg:grid-rows-1">
      <aside className="min-h-0 overflow-y-auto border-b border-border-subtle bg-elevated/70 lg:border-r lg:border-b-0">
        <LeadGbpAuditRail
          profile={selected}
          website={
            websiteAudit
              ? {
                  fetched_at: websiteAudit.fetched_at,
                  pagespeed_at: websiteAudit.pagespeed_at,
                  jobs: websiteAudit.jobs.map((job) => ({
                    status: job.status,
                  })),
                }
              : null
          }
          digitalPresence={
            hasPresenceWork || websiteAudit
              ? {
                  updatedAt: detail.digitalPresenceAudit?.updated_at ?? null,
                  complete: presenceComplete,
                  alertCount: presenceAlertCount,
                  collectedAt: websiteAudit?.fetched_at ?? null,
                }
              : null
          }
          visibility={
            detail.visibilityAudit
              ? {
                  fetchedAt: detail.visibilityAudit.fetched_at,
                  alertCount: visibilityAlertCount,
                }
              : null
          }
          diagnosis={{
            unlocked: diagnosisUnlocked,
            hasExport: hasDiagnosisExport,
            updatedAt:
              detail.diagnosisDraft?.updated_at ??
              detail.diagnosisExports.find((item) => item.is_current)
                ?.exported_at ??
              null,
            stale: diagnosisStale,
          }}
          selectedStep={selectedStep}
          googleAlertCount={alertCount}
          websiteAlertCount={websiteAlertCount}
          loading={loading}
          onSelectStep={setSelectedStep}
        />
      </aside>
      <div className="min-h-0 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
        {selectedStep === "website" ? (
          <LeadWebsitePanel
            detail={detail}
            canEdit={canEdit}
            onAuditChange={(audit) => {
              onWebsiteAuditsChange(detail.lead.id, [
                ...detail.websiteAudits.filter(
                  (item) => item.channel_id !== audit.channel_id,
                ),
                audit,
              ])
            }}
            onPendingChange={onPendingChange}
          />
        ) : selectedStep === "digital-presence" ? (
          <LeadDigitalPresencePanel
            detail={detail}
            canEdit={canEdit}
            onAuditChange={(audit) => {
              onDigitalPresenceChange(detail.lead.id, audit)
            }}
            onPendingChange={onPendingChange}
          />
        ) : selectedStep === "visibility" ? (
          <LeadVisibilityPanel
            detail={detail}
            canEdit={canEdit}
            onAuditChange={(audit) => {
              onVisibilityChange(detail.lead.id, audit)
            }}
            onPendingChange={onPendingChange}
          />
        ) : selectedStep === "diagnosis" ? (
          <LeadDiagnosisPanel
            detail={detail}
            canEdit={canEdit}
            unlocked={diagnosisUnlocked}
            liveFingerprint={liveFingerprint}
            onDraftChange={(draft) => {
              onDiagnosisDraftChange(detail.lead.id, draft)
            }}
            onExportsChange={(exports) => {
              onDiagnosisExportsChange(detail.lead.id, exports)
            }}
            onPendingChange={onPendingChange}
          />
        ) : selectedStep === "google-profile" ? (
          <div className="flex flex-col gap-3">
            {uncoveredCount > 0 ? (
              <m.div
                initial={fade.initial}
                animate={fade.animate}
                transition={fade.transition}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/25 bg-warning-subtle px-3 py-2"
              >
                <RiAlertLine
                  size={16}
                  aria-hidden
                  className="shrink-0 text-warning"
                />
                <p className="min-w-0 flex-1 font-sans text-caption text-warning">
                  {uncoveredCount === 1
                    ? "1 site sem perfil vinculado"
                    : `${uncoveredCount.toLocaleString("pt-BR")} sites sem perfil vinculado`}
                </p>
                {canEdit ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 px-2 text-warning"
                    onClick={() => setPickerOpen(true)}
                  >
                    Revisar
                  </Button>
                ) : null}
              </m.div>
            ) : null}

            {showPicker ? (
              <LeadGbpPlacePicker
                id="lead-gbp-place"
                disabled={linking}
                locationHint={gbpLocationHint}
                onPick={handlePick}
              />
            ) : null}

            {linkError ? (
              <p role="alert" className="font-sans text-body-sm text-danger">
                {linkError}
                {existingLeadId ? (
                  <>
                    {" "}
                    <Link
                      href={`/leads?lead=${existingLeadId}`}
                      className="font-medium text-link underline-offset-2 hover:underline"
                    >
                      Abrir cadastro existente
                    </Link>
                  </>
                ) : null}
              </p>
            ) : null}

            {profiles.length === 0 ? (
              <m.div
                initial={fade.initial}
                animate={fade.animate}
                transition={fade.transition}
                className="flex flex-col items-center gap-3 px-4 py-8"
              >
                <span
                  aria-hidden
                  className="inline-flex size-12 items-center justify-center rounded-xl bg-hover text-fg-muted"
                >
                  <RiMapPin2Line size={22} />
                </span>
                <div className="max-w-sm text-center">
                  <p className="font-sans text-caption text-fg-secondary">
                    Nenhum perfil do Google vinculado
                  </p>
                  <p className="mt-1 font-sans text-caption text-fg-muted">
                    Busque o estabelecimento para montar a análise do GBP.
                  </p>
                </div>
              </m.div>
            ) : selected ? (
              <LeadGbpProfileCard
                profile={selected}
                profiles={profiles}
                companyName={detail.lead.company_name}
                canEdit={canEdit}
                actionPending={linking}
                onSelectProfile={setSelectedId}
                onUpdated={replaceProfile}
                onRemoved={removeProfile}
                onPendingChange={onPendingChange}
              />
            ) : null}

            {canEdit && profiles.length > 0 && !pickerOpen ? (
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPickerOpen(true)}
                >
                  Adicionar perfil
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <UpcomingStepPlaceholder />
        )}
      </div>
    </div>
  )
}

function UpcomingStepPlaceholder() {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8">
      <p className="font-sans text-caption text-fg-secondary">
        Esta etapa ainda não está disponível.
      </p>
    </div>
  )
}

function Pulse({ className, delay }: { className: string; delay: number }) {
  return (
    <span
      className={cn(
        "block animate-pulse rounded-xl bg-hover motion-reduce:animate-none",
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
    />
  )
}
