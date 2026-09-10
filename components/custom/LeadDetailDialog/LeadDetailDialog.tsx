"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { LeadDetailHeader } from "./LeadDetailHeader"
import { LeadRecordPanel } from "./LeadRecordPanel"
import type {
  LeadDetailDialogProps,
  LeadDetailTab,
} from "./LeadDetailDialog.types"

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
  // Inicializador preguiçoso: `localStorage` nunca é lido no corpo do render.
  const [readingModePref, setReadingModePref] = useState(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem("gbp:reading-mode") === "on"
  })
  const [portalReveal, setPortalReveal] = useState<{
    code: string
    url: string
  } | null>(null)
  const [enteredActivityId, setEnteredActivityId] = useState<string | null>(
    null,
  )

  const isBusy = formPending || claimPending || activityPending || gbpPending

  // Reset ao abrir/trocar de lead: no render. O carregamento continua no efeito.
  const dialogKey = open && leadId ? `${leadId}|${preview?.status ?? ""}` : null
  const [syncedDialogKey, setSyncedDialogKey] = useState(dialogKey)
  if (syncedDialogKey !== dialogKey) {
    setSyncedDialogKey(dialogKey)
    if (dialogKey !== null) {
      setTab(preview?.status === "interested" ? "opportunity" : "activity")
      setEditing(false)
      setClaimError(null)
      setEnteredActivityId(null)
      setGbpPending(false)
      setDetail(null)
      setErrorMessage(null)
      setLoadState("loading")
    }
  }

  useEffect(() => {
    if (!open || !leadId) return
    const requestId = ++requestIdRef.current
    void getLeadDetail(leadId).then((result) => {
      if (requestId !== requestIdRef.current) return
      if (result.status === "success") {
        setDetail(result.data)
        setErrorMessage(null)
        setLoadState("ready")
        setTab(
          result.data.lead.status === "interested" ? "opportunity" : "activity",
        )
        return
      }
      setDetail(null)
      if (result.status === "not_found") {
        setLoadState("not_found")
        setErrorMessage(null)
        return
      }
      setLoadState("error")
      setErrorMessage(result.message)
    })
  }, [open, leadId])

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

  const showOpportunityTab = status === "interested" || status === "converted"
  const canEditGbp = (detail?.canEditGbp ?? false) && !readOnly
  // Quem não pode editar entra em modo reunião e não vê o botão: não há o que
  // esconder de quem já não edita. O modo nunca habilita nada — só esconde.
  const readingMode = canEditGbp ? readingModePref : true

  function handleReadingModeChange(next: boolean) {
    setReadingModePref(next)
    window.localStorage.setItem("gbp:reading-mode", next ? "on" : "off")
  }

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
            "h-[min(50rem,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl grid-rows-[minmax(0,1fr)] gap-0 overflow-hidden bg-background p-0",
            // Os quatro: `tailwind-merge` resolve por chave, e sem o `max-h-` o
            // `max-h-[calc(100dvh-2rem)]` da linha acima continuaria clampando.
            tab === "opportunity" &&
              "h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-none",
          )}
        >
          <DialogTitle className="sr-only">{companyName}</DialogTitle>
          <DialogDescription className="sr-only">
            {domain || "Atividade e cadastro do lead"}
          </DialogDescription>
          <Tabs
            value={tab}
            onValueChange={(next) => setTab(next as LeadDetailTab)}
            className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-0"
          >
            <LeadDetailHeader
              tab={tab}
              showOpportunityTab={showOpportunityTab}
              readingMode={readingMode}
              showReadingMode={tab === "opportunity" && canEditGbp}
              onReadingModeChange={handleReadingModeChange}
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
            <div className="flex min-h-0 flex-col overflow-hidden">
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
                <div className="relative min-h-0 flex-1 overflow-hidden">
                  <TabsContent
                    value="activity"
                    className="absolute inset-0 overflow-y-auto duration-150 data-active:animate-in data-active:fade-in-0"
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
                  </TabsContent>

                  {showOpportunityTab ? (
                    <TabsContent
                      value="opportunity"
                      className="absolute inset-0 overflow-hidden duration-150 data-active:animate-in data-active:fade-in-0"
                    >
                      <LeadGbpPanel
                        detail={detail}
                        loading={loadState === "loading"}
                        readOnly={readOnly}
                        readingMode={readingMode}
                        onProfilesChange={applyGbpProfiles}
                        onWebsiteAuditsChange={applyWebsiteAudits}
                        onDigitalPresenceChange={applyDigitalPresence}
                        onVisibilityChange={applyVisibility}
                        onBacklinksChange={applyBacklinks}
                        onDiagnosisDraftChange={applyDiagnosisDraft}
                        onDiagnosisExportsChange={applyDiagnosisExports}
                        onPendingChange={setGbpPending}
                      />
                    </TabsContent>
                  ) : null}

                  {/* keepMounted preserva o formulário em edição ao trocar de aba */}
                  <TabsContent
                    value="record"
                    keepMounted
                    className="absolute inset-0 overflow-y-auto"
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
                  </TabsContent>
                </div>
              ) : null}
            </div>
          </Tabs>
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
