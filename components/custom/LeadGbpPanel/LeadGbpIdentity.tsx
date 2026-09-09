"use client"

import { useEffect, useMemo, useState } from "react"
import { RiStarFill } from "react-icons/ri"
import { getLeadInitials } from "@/components/custom/LeadBoard/LeadBoardCardFace"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "cn"
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

  const profileItems = useMemo(
    () =>
      profiles.map((item) => ({
        value: item.id,
        label: item.payload.displayName ?? item.place_id,
      })),
    [profiles],
  )

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border/70 bg-card p-3 shadow-xs sm:flex-row sm:items-start">
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
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary"
        >
          {getLeadInitials(name)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs/relaxed font-semibold text-foreground">
            {name}
          </p>
          {profile.is_primary ? (
            <Badge variant="primary">
              <RiStarFill size={12} aria-hidden />
              Perfil principal
            </Badge>
          ) : null}
          {statusLabel ? (
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-xs/relaxed font-medium",
                snapshot.businessStatus === "OPERATIONAL"
                  ? "bg-success/10 text-success"
                  : "bg-accent text-muted-foreground",
              )}
            >
              {statusLabel}
            </span>
          ) : null}
          {claimed === true ? (
            <Badge variant="success">Reivindicado</Badge>
          ) : null}
          {claimed === false ? (
            <Badge variant="warning">Não reivindicado</Badge>
          ) : null}
        </div>
        {snapshot.formattedAddress ? (
          <p className="mt-1 text-xs/relaxed text-muted-foreground">
            {snapshot.formattedAddress}
          </p>
        ) : null}
        {profiles.length > 1 ? (
          <div className="mt-3 max-w-sm">
            <Select
              items={profileItems}
              value={profile.id}
              onValueChange={(value) => onSelectProfile(String(value))}
            >
              <SelectTrigger
                id={`gbp-profile-${profile.lead_id}`}
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {profiles.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.payload.displayName ?? item.place_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
    </div>
  )
}
