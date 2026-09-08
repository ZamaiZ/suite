"use client"

import type { IconType } from "react-icons"
import {
  RiExternalLinkLine,
  RiFacebookCircleLine,
  RiInstagramLine,
  RiLinkedinBoxLine,
  RiPinterestLine,
  RiStarFill,
  RiTiktokLine,
  RiTwitterXLine,
  RiYoutubeLine,
} from "react-icons/ri"
import { LeadGbpCard } from "@/components/custom/LeadGbpPanel/LeadGbpCard"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "cn"
import {
  DIGITAL_CHANNEL_LABELS,
  digitalChannelDisplay,
  hrefForDigitalChannel,
  type LeadDigitalChannel,
  type SocialChannelType,
} from "@/lib/leads/digital-channels"
import {
  emptyNetworkAnswer,
  type DigitalPresenceNetworkAnswer,
  type DigitalPresenceReview,
} from "@/lib/leads/digital-presence-review"
import { socialPostingAgeLabel } from "@/lib/leads/digital-presence"

const CHANNEL_ICONS: Record<SocialChannelType, IconType> = {
  instagram: RiInstagramLine,
  linkedin: RiLinkedinBoxLine,
  facebook: RiFacebookCircleLine,
  youtube: RiYoutubeLine,
  tiktok: RiTiktokLine,
  pinterest: RiPinterestLine,
  twitter: RiTwitterXLine,
}

export function LeadDigitalPresenceNetworks({
  channels,
  review,
  today,
  canEdit,
  onChange,
}: {
  channels: LeadDigitalChannel[]
  review: DigitalPresenceReview
  today: string
  canEdit: boolean
  onChange: (next: DigitalPresenceReview) => void
}) {
  if (channels.length === 0) {
    return (
      <LeadGbpCard title="Redes sociais">
        <p className="text-xs/relaxed text-muted-foreground">
          Nenhuma rede cadastrada. Inclua Instagram, LinkedIn ou outras no
          cadastro do lead.
        </p>
      </LeadGbpCard>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {channels.map((channel) => {
        if (!channel.id) return null
        const type = channel.type as SocialChannelType
        const Icon = CHANNEL_ICONS[type]
        const answer = review.networks[channel.id] ?? emptyNetworkAnswer()
        const href = hrefForDigitalChannel(channel.type, channel.value)
        const display = digitalChannelDisplay(channel.type, channel.value)

        function patch(partial: Partial<DigitalPresenceNetworkAnswer>) {
          onChange({
            ...review,
            networks: {
              ...review.networks,
              [channel.id!]: {
                ...answer,
                ...partial,
              },
            },
          })
        }

        return (
          <LeadGbpCard key={channel.id} title={DIGITAL_CHANNEL_LABELS[type]}>
            <div className="flex items-start gap-2.5">
              <LeadIconWell icon={Icon} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-xs/relaxed font-medium text-foreground">
                    {display}
                  </p>
                  {channel.is_primary ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs/relaxed font-medium text-primary">
                      <RiStarFill size={12} aria-hidden />
                      Principal
                    </span>
                  ) : null}
                </div>
                {href ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-1 h-7 px-2 text-primary"
                    onClick={() =>
                      window.open(href, "_blank", "noopener,noreferrer")
                    }
                  >
                    Abrir
                    <RiExternalLinkLine
                      size={14}
                      aria-hidden
                      data-icon="inline-end"
                    />
                  </Button>
                ) : null}
              </div>
            </div>

            <label
              className={cn(
                "mt-3 flex cursor-pointer items-center gap-2",
                !canEdit && "cursor-default opacity-70",
              )}
            >
              <input
                type="checkbox"
                checked={answer.unavailable}
                disabled={!canEdit}
                onChange={(event) => {
                  if (event.target.checked) {
                    patch({
                      unavailable: true,
                      followers: null,
                      lastPostedOn: null,
                    })
                  } else {
                    patch({ unavailable: false })
                  }
                }}
                className="size-4 rounded border-border text-primary"
              />
              <span className="text-xs/relaxed text-muted-foreground">
                Perfil inacessível
              </span>
            </label>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`dp-followers-${channel.id}`}>
                  Seguidores
                </FieldLabel>
                <Input
                  id={`dp-followers-${channel.id}`}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={
                    answer.followers === null ? "" : String(answer.followers)
                  }
                  disabled={!canEdit || answer.unavailable}
                  onChange={(event) => {
                    const raw = event.target.value.replace(/\D/g, "")
                    patch({ followers: raw.length === 0 ? null : Number(raw) })
                  }}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`dp-last-post-${channel.id}`}>
                  Última postagem
                </FieldLabel>
                <Input
                  id={`dp-last-post-${channel.id}`}
                  type="date"
                  value={answer.lastPostedOn ?? ""}
                  disabled={!canEdit || answer.unavailable}
                  max={today}
                  onChange={(event) => {
                    const value = event.target.value
                    patch({ lastPostedOn: value.length === 0 ? null : value })
                  }}
                />
              </Field>
            </div>

            {!answer.unavailable && answer.lastPostedOn ? (
              <p className="mt-2 text-xs/relaxed text-muted-foreground">
                {socialPostingAgeLabel(answer.lastPostedOn, today)}
              </p>
            ) : null}
          </LeadGbpCard>
        )
      })}
    </div>
  )
}
