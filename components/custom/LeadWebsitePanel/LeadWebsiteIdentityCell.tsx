"use client"

import { useState } from "react"
import { RiGlobalLine, RiStarFill } from "react-icons/ri"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { digitalChannelDisplay } from "@/lib/leads/digital-channels"
import { websiteHomePage } from "@/lib/leads/website-audit"
import type { WebsiteController } from "./use-website-controller"

/**
 * Primeira célula da faixa do cabeçalho. Substitui o `Select` solto que morava
 * acima do painel: a troca de site é identidade, não uma linha de formulário.
 */
export function LeadWebsiteIdentityCell({
  controller,
}: {
  controller: WebsiteController
}) {
  const { selected, audit, channels, channelItems } = controller
  const [shotFailed, setShotFailed] = useState(false)
  const shot =
    audit?.pagespeed?.desktop?.screenshot ??
    audit?.pagespeed?.mobile?.screenshot ??
    null
  const home = audit ? websiteHomePage(audit.crawl) : null
  const label = selected
    ? digitalChannelDisplay(selected.type, selected.value)
    : "—"

  return (
    <div className="flex min-w-0 flex-col justify-center gap-2 rounded-lg bg-accent/60 px-3 py-2.5 ring-1 ring-foreground/[0.06]">
      <div className="flex min-w-0 items-center gap-2.5">
        {shot && !shotFailed ? (
          <img
            src={shot}
            alt=""
            aria-hidden
            onError={() => setShotFailed(true)}
            className="size-11 shrink-0 rounded-lg border border-border/70 object-cover object-top"
          />
        ) : (
          <span
            aria-hidden
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <RiGlobalLine size={20} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs/[1.5] font-semibold text-foreground">
            {label}
          </p>
          <p className="truncate text-xs/[1.5] text-muted-foreground">
            {audit?.crawl.finalUrl ?? "Sem coleta"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {selected?.is_primary ? (
          <Badge variant="primary">
            <RiStarFill size={12} aria-hidden />
            Principal
          </Badge>
        ) : null}
        {audit ? (
          <>
            <Badge variant={audit.crawl.https ? "success" : "warning"}>
              {audit.crawl.https ? "HTTPS" : "Sem HTTPS"}
            </Badge>
            <Badge variant={home?.indexable === false ? "warning" : "muted"}>
              {home?.indexable === false ? "Sem indexação" : "Indexável"}
            </Badge>
          </>
        ) : null}
      </div>

      {channels.length > 1 ? (
        <Select
          items={channelItems}
          value={controller.selectedId ?? ""}
          onValueChange={(value) => controller.setSelectedId(String(value))}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {channelItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  )
}
