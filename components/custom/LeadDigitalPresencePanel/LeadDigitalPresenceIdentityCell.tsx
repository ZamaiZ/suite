"use client"

import { RiGroupLine } from "react-icons/ri"
import { Badge } from "@/components/ui/badge"
import { cn } from "cn"
import { formatRelativeShort } from "@/lib/date-time"
import { CHANNEL_ICONS } from "@/lib/leads/digital-channel-icons"
import {
  DIGITAL_PRESENCE_ALIGNMENT_LABEL,
  type DigitalPresenceAlignment,
} from "@/lib/leads/digital-presence-presenters"
import { DIGITAL_PRESENCE_IDENTITY_VERDICT_LABEL } from "@/lib/leads/digital-presence-review"
import type { DigitalPresenceController } from "./use-digital-presence-controller"

/**
 * A constelação é o retrato da etapa: uma fileira de glifos que diz, de
 * relance, quantas redes existem e em que estado cada uma está. Esse mesmo
 * retrato exigia ler oito cards.
 *
 * O estado nunca é só cor: cada glifo carrega `title` e nome acessível.
 */
const GLYPH: Record<DigitalPresenceAlignment, string> = {
  aligned: "bg-primary/10 text-primary",
  not_on_site: "bg-warning/10 text-warning",
  mismatch: "bg-warning/10 text-warning",
  unregistered: "border border-dashed border-border text-muted-foreground",
  unknown: "bg-accent text-muted-foreground",
}

export function LeadDigitalPresenceIdentityCell({
  controller,
}: {
  controller: DigitalPresenceController
}) {
  const { companyName, networkStates, hasCollect, collectedAt, review } =
    controller
  const verdict = review.identity.verdict

  return (
    <div className="flex min-w-0 flex-col justify-center gap-2 rounded-lg bg-accent/60 px-3 py-2.5 ring-1 ring-foreground/[0.06]">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <RiGroupLine size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs/[1.5] font-semibold text-foreground">
            {companyName}
          </p>
          <p className="truncate text-xs/[1.5] text-muted-foreground">
            {hasCollect && collectedAt
              ? `Coleta do site ${formatRelativeShort(collectedAt)}`
              : "Sem coleta do site"}
          </p>
        </div>
      </div>

      {networkStates.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-1">
          {networkStates.map((state) => {
            const Icon = CHANNEL_ICONS[state.type]
            const title = `${state.label} · ${
              state.answer.unavailable
                ? "Perfil inacessível"
                : DIGITAL_PRESENCE_ALIGNMENT_LABEL[state.alignment]
            }`
            return (
              <li key={state.channelId}>
                <span
                  role="img"
                  title={title}
                  aria-label={title}
                  className={cn(
                    "inline-flex size-7 items-center justify-center rounded-lg",
                    state.answer.unavailable
                      ? "bg-accent text-muted-foreground/60"
                      : GLYPH[state.alignment],
                  )}
                >
                  <Icon size={15} aria-hidden />
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs/[1.5] text-muted-foreground">
          Nenhuma rede cadastrada
        </p>
      )}

      {verdict ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={verdict === "ok" ? "success" : "warning"}>
            Identidade: {DIGITAL_PRESENCE_IDENTITY_VERDICT_LABEL[verdict]}
          </Badge>
        </div>
      ) : null}
    </div>
  )
}
