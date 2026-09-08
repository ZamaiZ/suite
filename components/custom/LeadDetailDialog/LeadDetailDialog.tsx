"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import {
  getLeadDetail,
  type ClosingChecklistPatch,
  type LeadAssignmentPatch,
  type LeadDetail,
  type LeadDigitalPresenceAudit,
  type LeadVisibilityAudit,
  type LeadBacklinkAudit,
  type LeadDiagnosisDraft,
  type LeadDiagnosisExport,
  type LeadGbpProfile,
  type LeadWebsiteAudit,
  type LogClosingEventState,
  type LogLeadActivityState,
} from "@/app/actions/leads"
import type { ConvertLeadState } from "@/app/actions/clients"
import { ClientPortalCodeReveal } from "@/components/custom/ClientPortalCodeReveal"
import { LeadGbpPanel } from "@/components/custom/LeadGbpPanel"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "cn"
import { leadAccessFlags } from "@/lib/leads/board-item"
import { isClosingStage } from "@/lib/leads/closing"
import { countActivitiesByChannel } from "@/lib/leads/channel"
import { matchWebsiteKey, websiteKeysFromChannels } from "@/lib/leads/gbp"
import { isLeadStatus } from "@/lib/leads/status"
import type { LeadTag } from "@/lib/leads/tags"
import type { LeadWritePayload } from "@/lib/leads/types"
import { LeadActivityPanel } from "./LeadActivityPanel"
import { LeadDetailHeader } from "./LeadDetailHeader"
import { LeadRecordPanel } from "./LeadRecordPanel"
import type {
  LeadDetailDialogProps,
  LeadDetailTab,
} from "./LeadDetailDialog.types"

const EASE = [0.23, 1, 0.32, 1] as const

type LoadState = "loading" | "ready" | "not_found" | "error"

export function LeadDetailDialog({
  open,
  onClose,
  leadId,
  preview,
  readOnly = false,
  onMutated,
}: LeadDetailDialogProps) {
  const requestIdRef = useRef(0)
  const reduced = !!useReducedMotion()
  const [tab, setTab] = useState<LeadDetailTab>("activity")
  const [editing, setEditing] = useState(false)
  const [detail, setDetail] = useState<LeadDetail | null>(null)
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [formPending, setFormPending] = useState(false)
  const [claimPending, setClaimPending] = useState(false)
  const [activityPending, setActivityPending] = useState(false)
  const [gbpPending, setGbpPending] = useState(false)
  const [portalReveal, setPortalReveal] = useState<{
    code: string
    url: string
  } | null>(null)
  const [enteredActivityId, setEnteredActivityId] = useState<string | null>(
    null,
  )

  const isBusy = formPending || claimPending || activityPending || gbpPending
  const paneTransition = {
    duration: reduced ? 0.12 : 0.18,
    ease: EASE,
  }
  const paneEnter = reduced ? { opacity: 0 } : { opacity: 0, y: 6 }
  const paneVisible = reduced ? { opacity: 1 } : { opacity: 1, y: 0 }

  const loadDetail = useCallback(
    async (id: string, mode: "replace" | "refresh") => {
      const requestId = ++requestIdRef.current
      if (mode === "replace") {
        setDetail(null)
        setErrorMessage(null)
        setLoadState("loading")
      }

      const result = await getLeadDetail(id)
      if (requestId !== requestIdRef.current) return

      if (result.status === "success") {
        setDetail(result.data)
        setErrorMessage(null)
        setLoadState("ready")
        if (mode === "replace") {
          setTab(
            result.data.lead.status === "interested"
              ? "opportunity"
              : "activity",
          )
        }
        return
      }

      if (result.status === "not_found") {
        if (mode === "replace") setDetail(null)
        setLoadState("not_found")
        setErrorMessage(null)
        return
      }

      if (mode === "replace") setDetail(null)
      setLoadState("error")
      setErrorMessage(result.message)
    },
    [],
  )

  useEffect(() => {
    if (!open || !leadId) return
    setTab(preview?.status === "interested" ? "opportunity" : "activity")
    setEditing(false)
    setClaimError(null)
    setEnteredActivityId(null)
    setGbpPending(false)
    void loadDetail(leadId, "replace")
  }, [open, leadId, loadDetail, preview?.status])

  const companyName =
    preview?.company_name ?? detail?.lead.company_name ?? "Lead"
  const domain = preview?.website_domain ?? detail?.lead.website_domain
  const status = detail
    ? isLeadStatus(detail.lead.status)
      ? detail.lead.status
      : null
    : (preview?.status ?? null)
  const activityCount = detail
    ? detail.activities.length
    : (preview?.activity_count ?? 0)

  function handleDismiss() {
    if (isBusy) return
    onClose()
  }

  function handleRequestClose() {
    if (isBusy) return
    if (editing) {
      setEditing(false)
      return
    }
    onClose()
  }

  function applyAssignment(patch: LeadAssignmentPatch) {
    setDetail((current) => {
      if (!current) return current
      const lead = {
        ...current.lead,
        assigned_sdr_id: patch.assigned_sdr_id,
        status: patch.status,
        next_follow_up_at: patch.next_follow_up_at,
      }
      return {
        ...current,
        lead,
        assigneeName: patch.assignee_name,
        ...leadAccessFlags(lead),
      }
    })
    onMutated?.(patch)
  }

  function applyFields(fields: LeadWritePayload, tags: LeadTag[]) {
    setDetail((current) => {
      if (!current) return current
      // O payload de escrita carrega o segmento como nome; o registro guarda
      // { id, name }. Espalhar direto trocaria o objeto por uma string.
      const { segment: segmentName, ...rest } = fields
      const currentSegment = current.lead.segment
      const segment =
        segmentName.trim().length === 0
          ? null
          : currentSegment?.name === segmentName
            ? currentSegment
            : { id: currentSegment?.id ?? "", name: segmentName }
      const lead = { ...current.lead, ...rest, segment }
      const websiteKeys = websiteKeysFromChannels(lead.channels)
      return {
        ...current,
        lead,
        tags,
        gbpProfiles: current.gbpProfiles.map((profile) => ({
          ...profile,
          matched_website_key: matchWebsiteKey(
            profile.payload.websiteDomain,
            websiteKeys,
          ),
        })),
      }
    })
    onMutated?.({
      company_name: fields.company_name,
      website: fields.website,
      website_domain: fields.website_domain,
      tags,
    })
    setEditing(false)
  }

  function applyGbpProfiles(leadId: string, profiles: LeadGbpProfile[]) {
    setDetail((current) =>
      current && current.lead.id === leadId
        ? { ...current, gbpProfiles: profiles }
        : current,
    )
  }

  function applyWebsiteAudits(leadId: string, audits: LeadWebsiteAudit[]) {
    setDetail((current) =>
      current && current.lead.id === leadId
        ? { ...current, websiteAudits: audits }
        : current,
    )
  }

  function applyDigitalPresence(
    leadId: string,
    audit: LeadDigitalPresenceAudit | null,
  ) {
    setDetail((current) =>
      current && current.lead.id === leadId
        ? { ...current, digitalPresenceAudit: audit }
        : current,
    )
  }

  function applyVisibility(leadId: string, audit: LeadVisibilityAudit | null) {
    setDetail((current) =>
      current && current.lead.id === leadId
        ? { ...current, visibilityAudit: audit }
        : current,
    )
  }

  function applyBacklinks(leadId: string, audit: LeadBacklinkAudit | null) {
    setDetail((current) =>
      current && current.lead.id === leadId
        ? { ...current, backlinkAudit: audit }
        : current,
    )
  }

  function applyDiagnosisDraft(
    leadId: string,
    draft: LeadDiagnosisDraft | null,
  ) {
    setDetail((current) =>
      current && current.lead.id === leadId
        ? { ...current, diagnosisDraft: draft }
        : current,
    )
  }

  function applyDiagnosisExports(
    leadId: string,
    exports: LeadDiagnosisExport[],
  ) {
    setDetail((current) =>
      current && current.lead.id === leadId
        ? { ...current, diagnosisExports: exports }
        : current,
    )
  }

  function handleActivitySuccess(
    result: Extract<LogLeadActivityState, { status: "success" }>,
  ) {
    setEnteredActivityId(result.activity.id)
    const interested = result.patch.status === "interested"
    if (interested) setTab("opportunity")
    setDetail((current) => {
      if (!current) return current
      const lead = {
        ...current.lead,
        status: result.patch.status,
        next_follow_up_at: result.patch.next_follow_up_at,
        assigned_closer_id: result.patch.assigned_closer_id,
        closing_meeting_at: result.patch.closing_meeting_at,
        closing_stage: result.patch.closing_stage,
      }
      return {
        ...current,
        lead,
        closerName: result.patch.closer_name,
        activities: [result.activity, ...current.activities],
        ...leadAccessFlags(lead),
        canEditGbp: interested ? true : current.canEditGbp,
        canRescheduleClosing: interested,
        canRecordClosingOutcome: false,
        canEditClosingChecklist: false,
      }
    })
    onMutated?.({
      ...result.patch,
      activity_count: activityCount + 1,
      activity_counts: countActivitiesByChannel([
        result.activity,
        ...(detail?.activities ?? []),
      ]),
    })
  }

  function handleClosingEventSuccess(
    result: Extract<LogClosingEventState, { status: "success" }>,
  ) {
    setEnteredActivityId(result.activity.id)
    const stillOpportunity = result.patch.status === "interested"
    setDetail((current) => {
      if (!current) return current
      const lead = {
        ...current.lead,
        status: result.patch.status,
        next_follow_up_at: result.patch.next_follow_up_at,
        assigned_closer_id: result.patch.assigned_closer_id,
        closing_meeting_at: result.patch.closing_meeting_at,
        closing_stage: result.patch.closing_stage,
      }
      const stage = isClosingStage(result.patch.closing_stage)
        ? result.patch.closing_stage
        : null
      return {
        ...current,
        lead,
        closerName: result.patch.closer_name,
        activities: [result.activity, ...current.activities],
        ...leadAccessFlags(lead),
        canEditGbp: stillOpportunity,
        canRescheduleClosing:
          stillOpportunity &&
          (stage === "open" || stage === "no_show" || stage === "standby") &&
          current.canRescheduleClosing,
        canRecordClosingOutcome:
          stillOpportunity &&
          stage !== "won_pending" &&
          Boolean(stage) &&
          current.canRecordClosingOutcome,
        canEditClosingChecklist:
          stillOpportunity &&
          stage === "won_pending" &&
          (current.canRecordClosingOutcome || current.canEditClosingChecklist),
      }
    })
    onMutated?.({
      ...result.patch,
      activity_count: activityCount + 1,
      activity_counts: countActivitiesByChannel([
        result.activity,
        ...(detail?.activities ?? []),
      ]),
    })
  }

  function handleChecklistSuccess(patch: ClosingChecklistPatch) {
    setDetail((current) => {
      if (!current) return current
      return {
        ...current,
        lead: {
          ...current.lead,
          ...patch,
        },
      }
    })
  }

  function handleConvertSuccess(
    result: Extract<ConvertLeadState, { status: "success" }>,
  ) {
    setDetail((current) => {
      if (!current) return current
      const lead = {
        ...current.lead,
        status: result.patch.status,
        closing_stage: result.patch.closing_stage,
      }
      return {
        ...current,
        lead,
        ...leadAccessFlags(lead),
        client: {
          id: result.clientId,
          canView: result.patch.can_view_client,
        },
        canEditGbp: false,
        canRescheduleClosing: false,
        canRecordClosingOutcome: false,
        canEditClosingChecklist: false,
      }
    })
    onMutated?.(result.patch)
    setPortalReveal({
      code: result.portalCode,
      url: result.portalUrl,
    })
  }

  const keepRecordMounted = tab === "record" || editing
  const showBody =
    loadState === "loading" ||
    loadState === "ready" ||
    (loadState === "error" && Boolean(detail))

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) handleRequestClose()
        }}
      >
        <DialogContent
          showCloseButton={false}
          className={cn(
            "h-[min(50rem,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl gap-0 overflow-hidden bg-background p-0",
            tab === "opportunity" && "max-w-6xl",
          )}
        >
          <DialogTitle className="sr-only">{companyName}</DialogTitle>
          <DialogDescription className="sr-only">
            {domain || "Atividade e cadastro do lead"}
          </DialogDescription>
          <LeadDetailHeader
            tab={tab}
            onTabChange={setTab}
            companyName={companyName}
            domain={domain}
            status={status}
            closingStage={
              detail && isClosingStage(detail.lead.closing_stage)
                ? detail.lead.closing_stage
                : null
            }
            activityCount={activityCount}
            leadId={leadId}
            canClaim={detail?.canClaim ?? false}
            canUnclaim={detail?.canUnclaim ?? false}
            createdByName={detail?.createdByName ?? null}
            clientId={detail?.client?.id ?? null}
            canViewClient={detail?.client?.canView ?? false}
            readOnly={readOnly}
            closeDisabled={isBusy}
            onClose={handleDismiss}
            onClaimSuccess={applyAssignment}
            onClaimPending={setClaimPending}
            onClaimError={setClaimError}
          />
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            {claimError ? (
              <p
                role="alert"
                className="mx-auto w-full max-w-2xl px-4 pt-4 text-xs/relaxed text-destructive sm:px-5"
              >
                {claimError}
              </p>
            ) : null}

            {loadState === "not_found" ? (
              <p className="mx-auto w-full max-w-2xl px-4 py-5 text-xs/relaxed text-muted-foreground sm:px-5">
                Lead não encontrado.
              </p>
            ) : loadState === "error" && !detail ? (
              <p
                role="alert"
                className="mx-auto w-full max-w-2xl px-4 py-5 text-xs/relaxed text-destructive sm:px-5"
              >
                {errorMessage ?? "Não foi possível carregar o lead."}
              </p>
            ) : showBody ? (
              <div className="relative h-full min-h-0 flex-1 overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  {tab === "activity" ? (
                    <m.div
                      key="activity"
                      role="tabpanel"
                      id="lead-detail-activity"
                      aria-labelledby="lead-tab-activity"
                      initial={paneEnter}
                      animate={paneVisible}
                      exit={paneEnter}
                      transition={paneTransition}
                      className="absolute inset-0 overflow-y-auto"
                    >
                      <LeadActivityPanel
                        detail={detail}
                        loading={loadState === "loading"}
                        readOnly={readOnly}
                        enteredActivityId={enteredActivityId}
                        onActivitySuccess={handleActivitySuccess}
                        onClosingEventSuccess={handleClosingEventSuccess}
                        onChecklistSuccess={handleChecklistSuccess}
                        onConvertSuccess={handleConvertSuccess}
                        onPendingChange={setActivityPending}
                      />
                    </m.div>
                  ) : null}
                  {tab === "opportunity" ? (
                    <m.div
                      key="opportunity"
                      role="tabpanel"
                      id="lead-detail-opportunity"
                      aria-labelledby="lead-tab-opportunity"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={paneTransition}
                      className="absolute inset-0 overflow-hidden"
                    >
                      <LeadGbpPanel
                        detail={detail}
                        loading={loadState === "loading"}
                        readOnly={readOnly}
                        onProfilesChange={applyGbpProfiles}
                        onWebsiteAuditsChange={applyWebsiteAudits}
                        onDigitalPresenceChange={applyDigitalPresence}
                        onVisibilityChange={applyVisibility}
                        onBacklinksChange={applyBacklinks}
                        onDiagnosisDraftChange={applyDiagnosisDraft}
                        onDiagnosisExportsChange={applyDiagnosisExports}
                        onPendingChange={setGbpPending}
                      />
                    </m.div>
                  ) : null}
                </AnimatePresence>

                {keepRecordMounted ? (
                  <m.div
                    role="tabpanel"
                    id="lead-detail-record"
                    aria-labelledby="lead-tab-record"
                    hidden={tab !== "record"}
                    aria-hidden={tab !== "record"}
                    initial={paneEnter}
                    animate={paneVisible}
                    transition={paneTransition}
                    className={cn(
                      "absolute inset-0 overflow-y-auto",
                      tab !== "record" && "hidden",
                    )}
                  >
                    <LeadRecordPanel
                      detail={detail}
                      loading={loadState === "loading"}
                      editing={editing}
                      readOnly={readOnly}
                      onEdit={() => setEditing(true)}
                      onCancel={() => setEditing(false)}
                      onSaved={applyFields}
                      onPendingChange={setFormPending}
                    />
                  </m.div>
                ) : null}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      <ClientPortalCodeReveal
        open={portalReveal !== null}
        onClose={() => setPortalReveal(null)}
        code={portalReveal?.code ?? ""}
        url={portalReveal?.url ?? ""}
        title="Cliente consolidado"
      />
    </>
  )
}
