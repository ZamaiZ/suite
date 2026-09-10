"use client"

import { useMemo, useState } from "react"
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

/**
 * Mesma informação do card de identidade antigo, no formato de célula: a faixa
 * do cabeçalho fixo só funciona se os cinco blocos tiverem a mesma altura, e um
 * `Card` com header próprio não tem como acompanhar.
 */
export function LeadGbpIdentityCell({
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

  // Ajuste de estado quando a prop muda: no render, não em efeito.
  const coverKey = `${profile.id}|${cover ?? ""}`
  const [syncedCoverKey, setSyncedCoverKey] = useState(coverKey)
  if (syncedCoverKey !== coverKey) {
    setSyncedCoverKey(coverKey)
    setCoverFailed(false)
  }

  const profileItems = useMemo(
    () =>
      profiles.map((item) => ({
        value: item.id,
        label: item.payload.displayName ?? item.place_id,
      })),
    [profiles],
  )

  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg bg-accent/60 px-3 py-2.5 ring-1 ring-foreground/[0.06]">
      {cover && !coverFailed ? (
        <img
          src={cover}
          alt=""
          className="size-11 shrink-0 rounded-lg object-cover"
          onError={() => setCoverFailed(true)}
        />
      ) : (
        <span
          aria-hidden
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[13px] font-semibold text-primary"
        >
          {getLeadInitials(name)}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="min-w-0 truncate text-xs/[1.5] font-semibold text-foreground">
            {name}
          </p>
          {profile.is_primary ? (
            <Badge variant="primary" className="shrink-0">
              <RiStarFill size={12} aria-hidden />
              Principal
            </Badge>
          ) : null}
        </div>
        {snapshot.formattedAddress ? (
          <p className="truncate text-xs/[1.5] text-muted-foreground">
            {snapshot.formattedAddress}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5">
          {statusLabel ? (
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
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
        {profiles.length > 1 ? (
          <Select
            items={profileItems}
            value={profile.id}
            onValueChange={(value) => onSelectProfile(String(value))}
          >
            <SelectTrigger
              size="sm"
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
        ) : null}
      </div>
    </div>
  )
}
