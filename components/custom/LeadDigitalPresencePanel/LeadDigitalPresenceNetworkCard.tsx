"use client"

import { RiExternalLinkLine, RiStarFill } from "react-icons/ri"
import { StepSectionLabel } from "@/components/custom/LeadStepShell"
import { DatePicker } from "@/components/custom/DatePicker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "cn"
import { CHANNEL_ICONS } from "@/lib/leads/digital-channel-icons"
import type { DigitalPresenceTone } from "@/lib/leads/digital-presence"
import {
  DIGITAL_PRESENCE_ALIGNMENT_LABEL,
  DIGITAL_PRESENCE_ALIGNMENT_TONE,
  type DigitalPresenceNetworkState,
} from "@/lib/leads/digital-presence-presenters"
import type { DigitalPresenceNetworkAnswer } from "@/lib/leads/digital-presence-review"

/**
 * Mesma tabela de alfas do `SURFACE` de `StepStat`, conferida por cálculo para
 * AA em claro e escuro. A superfície do card é o estado: rede parada ou
 * desalinhada pede atenção; inacessível recua; em dia é cartão limpo.
 */
const SURFACE: Record<"neutral" | "warning", string> = {
  neutral: "border-border/70 bg-card",
  warning: "border-warning/25 bg-warning/[0.05]",
}

const CHIP: Record<DigitalPresenceTone, string> = {
  neutral: "bg-accent text-muted-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
}

const DOT: Record<DigitalPresenceTone, string> = {
  neutral: "bg-muted-foreground/40",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
}

export function LeadDigitalPresenceNetworkCard({
  state,
  canEdit,
  today,
  onChange,
}: {
  state: DigitalPresenceNetworkState
  canEdit: boolean
  today: string
  onChange: (
    channelId: string,
    partial: Partial<DigitalPresenceNetworkAnswer>,
  ) => void
}) {
  const Icon = CHANNEL_ICONS[state.type]
  const { answer } = state
  const locked = !canEdit || answer.unavailable
  const followersId = `presence-followers-${state.channelId}`
  const dateId = `presence-last-post-${state.channelId}`
  const unavailableId = `presence-unavailable-${state.channelId}`
  const alignmentTone = DIGITAL_PRESENCE_ALIGNMENT_TONE[state.alignment]

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-lg border px-3 py-2.5",
        SURFACE[state.tone],
        answer.unavailable && "border-border/70 bg-muted/40",
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          aria-hidden
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-lg",
            answer.unavailable
              ? "bg-accent text-muted-foreground/60"
              : "bg-primary/10 text-primary",
          )}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs/[1.5] font-semibold text-foreground">
              {state.label}
            </h3>
            {state.isPrimary ? (
              <Badge variant="primary" className="shrink-0">
                <RiStarFill size={12} aria-hidden />
                Principal
              </Badge>
            ) : null}
          </div>
          <p className="truncate text-xs/[1.5] text-muted-foreground">
            {state.display}
          </p>
        </div>
        {state.href ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Abrir o perfil no ${state.label}`}
            className="shrink-0 text-primary"
            onClick={() =>
              window.open(state.href ?? "", "_blank", "noopener,noreferrer")
            }
          >
            <RiExternalLinkLine size={14} aria-hidden />
          </Button>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 border-t border-border/70 pt-3 sm:grid-cols-2">
        <div className="min-w-0">
          <StepSectionLabel>Seguidores</StepSectionLabel>
          <Input
            id={followersId}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="—"
            aria-label={`Seguidores no ${state.label}`}
            className="tabular-nums"
            value={
              answer.followers === null
                ? ""
                : answer.followers.toLocaleString("pt-BR")
            }
            disabled={locked}
            onChange={(event) => {
              // Dígitos crus no estado, separador só na exibição: o valor que
              // vai para o banco é número, não texto formatado.
              const raw = event.target.value.replace(/\D/g, "")
              onChange(state.channelId, {
                followers: raw.length === 0 ? null : Number(raw),
              })
            }}
          />
        </div>

        <div className="min-w-0">
          <StepSectionLabel>Última postagem</StepSectionLabel>
          <DatePicker
            id={dateId}
            ariaLabel={`Última postagem no ${state.label}`}
            value={answer.lastPostedOn ?? ""}
            max={today}
            clearable
            disabled={locked}
            placeholder="—"
            onValueChange={(value) =>
              onChange(state.channelId, {
                lastPostedOn: value.length === 0 ? null : value,
              })
            }
          />
          {state.age ? (
            <p
              className={cn(
                "mt-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                CHIP[state.age.tone],
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "inline-block size-1.5 shrink-0 rounded-full",
                  DOT[state.age.tone],
                )}
              />
              {state.age.label}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
        {/*
          Sem coleta do site o chip não aparece: o estado é desconhecido, e chip
          nenhum é mais honesto que um chip cinza afirmando o quê.
        */}
        {state.alignment === "unknown" ? (
          <span />
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
              CHIP[alignmentTone],
            )}
          >
            <span
              aria-hidden
              className={cn(
                "inline-block size-1.5 shrink-0 rounded-full",
                DOT[alignmentTone],
              )}
            />
            {DIGITAL_PRESENCE_ALIGNMENT_LABEL[state.alignment]}
          </span>
        )}

        <div className="flex items-center gap-2">
          <Checkbox
            id={unavailableId}
            checked={answer.unavailable}
            disabled={!canEdit}
            onCheckedChange={(checked) => {
              // Marcar limpa as duas medidas: "não medimos" não pode conviver
              // com um número antigo que ninguém mais consegue conferir.
              if (checked) {
                onChange(state.channelId, {
                  unavailable: true,
                  followers: null,
                  lastPostedOn: null,
                })
                return
              }
              onChange(state.channelId, { unavailable: false })
            }}
          />
          <Label
            htmlFor={unavailableId}
            className={cn(
              "text-xs/relaxed text-muted-foreground",
              canEdit ? "cursor-pointer" : "cursor-default opacity-70",
            )}
          >
            Perfil inacessível
          </Label>
        </div>
      </div>
    </section>
  )
}
