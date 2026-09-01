"use client"

import { LeadActivityForm } from "@/components/custom/LeadActivityForm"
import { LeadClosingPanel } from "@/components/custom/LeadClosingPanel"
import { isLeadStatus } from "@/lib/leads/status"
import type { LeadDetail } from "@/app/actions/leads"
import type {
  ClosingChecklistPatch,
  LogClosingEventState,
  LogLeadActivityState,
} from "@/app/actions/leads"
import type { ConvertLeadState } from "@/app/actions/clients"
import { LeadActivityTimeline } from "./LeadActivityTimeline"
import { LeadContextRail } from "./LeadContextRail"

export function LeadActivityPanel({
  detail,
  loading,
  readOnly,
  enteredActivityId,
  onActivitySuccess,
  onClosingEventSuccess,
  onChecklistSuccess,
  onConvertSuccess,
  onPendingChange,
}: {
  detail: LeadDetail | null
  loading: boolean
  readOnly: boolean
  enteredActivityId: string | null
  onActivitySuccess: (
    result: Extract<LogLeadActivityState, { status: "success" }>,
  ) => void
  onClosingEventSuccess: (
    result: Extract<LogClosingEventState, { status: "success" }>,
  ) => void
  onChecklistSuccess: (patch: ClosingChecklistPatch) => void
  onConvertSuccess: (
    result: Extract<ConvertLeadState, { status: "success" }>,
  ) => void
  onPendingChange: (pending: boolean) => void
}) {
  if (loading && !detail) {
    return <ActivitySkeleton />
  }

  if (!detail) return null

  const canCompose = detail.canLogActivity && !readOnly
  const interested =
    isLeadStatus(detail.lead.status) && detail.lead.status === "interested"
  const converted =
    isLeadStatus(detail.lead.status) && detail.lead.status === "converted"
  const showClosing = interested || converted

  return (
    <div className="grid min-h-full grid-cols-1 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="border-b border-border-subtle bg-elevated lg:border-r lg:border-b-0">
        <LeadContextRail detail={detail} loading={loading} />
      </aside>
      <div className="flex min-w-0 flex-col gap-4 px-4 py-5 sm:px-5">
        {canCompose ? (
          <LeadActivityForm
            leadId={detail.lead.id}
            onSuccess={onActivitySuccess}
            onPendingChange={onPendingChange}
          />
        ) : showClosing ? (
          <LeadClosingPanel
            detail={detail}
            readOnly={readOnly}
            onEventSuccess={onClosingEventSuccess}
            onChecklistSuccess={onChecklistSuccess}
            onConvertSuccess={onConvertSuccess}
            onPendingChange={onPendingChange}
          />
        ) : readOnly ? null : (
          <p className="font-sans text-body-sm text-fg-secondary">
            Somente o responsável registra tentativas.
          </p>
        )}
        <LeadActivityTimeline
          activities={detail.activities}
          enteredActivityId={enteredActivityId}
        />
      </div>
    </div>
  )
}

function ActivitySkeleton() {
  return (
    <div className="grid min-h-full grid-cols-1 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="border-b border-border-subtle bg-elevated lg:border-r lg:border-b-0">
        <LeadContextRail detail={null} loading />
      </aside>
      <div className="flex min-w-0 flex-col gap-4 px-4 py-5 sm:px-5">
        <span className="h-36 animate-pulse rounded-xl bg-hover motion-reduce:animate-none" />
        <span
          className="h-24 animate-pulse rounded-xl bg-hover motion-reduce:animate-none"
          style={{ animationDelay: "40ms" }}
        />
        <span
          className="h-24 animate-pulse rounded-xl bg-hover motion-reduce:animate-none"
          style={{ animationDelay: "80ms" }}
        />
      </div>
    </div>
  )
}
