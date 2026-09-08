"use client"

import { useEffect, useState } from "react"
import { RiStarFill } from "react-icons/ri"
import { getLeadInitials } from "@/components/custom/LeadBoard/LeadBoardCardFace"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/cn"
import type { LeadGbpProfile } from "@/lib/leads/gbp"
import { gbpBusinessStatusLabel } from "@/lib/leads/gbp-presenters"

export function LeadGbpIdentity({
  profile,
  profiles,
  onSelectProfile,
}: {
  profile: LeadGbpProfile
  profiles: LeadGbpProfile[]
  onSelectProfile: (profileId: string) => void
}) {
  const [coverFailed, setCoverFailed] = useState(false)
  const snapshot = profile.payload
  const name = snapshot.displayName ?? profile.place_id
  const statusLabel = gbpBusinessStatusLabel(snapshot.businessStatus)
  const cover = profile.enrichment?.mainImageUrl
  const claimed = profile.enrichment?.isClaimed

  useEffect(() => {
    setCoverFailed(false)
  }, [profile.id, cover])

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border-subtle bg-surface p-3 shadow-card sm:flex-row sm:items-start">
      {cover && !coverFailed ? (
        <img
          src={cover}
          alt=""
          className="size-12 shrink-0 rounded-lg object-cover"
          onError={() => setCoverFailed(true)}
        />
      ) : (
        <span
          aria-hidden
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent/10 font-sans text-body font-semibold text-accent"
        >
          {getLeadInitials(name)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-sans text-caption font-semibold text-fg">{name}</p>
          {profile.is_primary ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 font-sans text-caption font-medium text-accent">
              <RiStarFill size={12} aria-hidden />
              Perfil principal
            </span>
          ) : null}
          {statusLabel ? (
            <span
              className={cn(
                "rounded-md px-2 py-0.5 font-sans text-caption font-medium",
                snapshot.businessStatus === "OPERATIONAL"
                  ? "bg-success/10 text-success"
                  : "bg-hover text-fg-secondary",
              )}
            >
              {statusLabel}
            </span>
          ) : null}
          {claimed === true ? (
            <span className="rounded-md bg-success/10 px-2 py-0.5 font-sans text-caption font-medium text-success">
              Reivindicado
            </span>
          ) : null}
          {claimed === false ? (
            <span className="rounded-md bg-warning/10 px-2 py-0.5 font-sans text-caption font-medium text-warning">
              Não reivindicado
            </span>
          ) : null}
        </div>
        {snapshot.formattedAddress ? (
          <p className="mt-1 font-sans text-caption text-fg-secondary">
            {snapshot.formattedAddress}
          </p>
        ) : null}
        {profiles.length > 1 ? (
          <div className="mt-3 max-w-sm">
            <Select value={profile.id} onValueChange={(value) => onSelectProfile(String(value))}>
              <SelectTrigger id={`gbp-profile-${profile.lead_id}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {profiles.map((item) => <SelectItem key={item.id} value={item.id}>{item.payload.displayName ?? item.place_id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
    </div>
  )
}
