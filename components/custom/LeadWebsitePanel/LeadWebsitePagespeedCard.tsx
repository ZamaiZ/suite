"use client"

import { useState } from "react"
import { RiEyeLine, RiSmartphoneLine } from "react-icons/ri"
import {
  STEP_TONE_CHIP,
  STEP_TONE_TEXT,
  StepCard,
  StepMeter,
  stepScoreTone,
  StepSectionLabel,
  type StepTone,
} from "@/components/custom/LeadStepShell"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "cn"
import { formatMs } from "@/lib/leads/website-presenters"
import {
  PSI_CLS_NEEDS,
  PSI_PERFORMANCE_NEEDS,
  PSI_PERFORMANCE_POOR,
  PSI_CLS_POOR,
  PSI_INP_NEEDS_MS,
  PSI_INP_POOR_MS,
  PSI_LCP_NEEDS_MS,
  PSI_LCP_POOR_MS,
  type WebsitePsiJob,
  type WebsitePsiStrategy,
} from "@/lib/leads/website-pagespeed"
import { LeadWebsiteVitalGauge } from "./LeadWebsiteVitalGauge"

function formatCls(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
}

function Chip({ tone, children }: { tone: StepTone; children: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-md px-2 text-[11px] font-medium",
        STEP_TONE_CHIP[tone],
      )}
    >
      {children}
    </span>
  )
}

export function LeadWebsitePagespeedCard({
  label,
  strategy,
  job,
}: {
  label: string
  strategy: WebsitePsiStrategy | null
  job: WebsitePsiJob | null
}) {
  const [shotFailed, setShotFailed] = useState(false)
  const waiting = job?.status === "queued" || job?.status === "running"
  const failed = job?.status === "failed"
  const tone: StepTone = strategy
    ? stepScoreTone(
        strategy.performance,
        PSI_PERFORMANCE_POOR,
        PSI_PERFORMANCE_NEEDS,
      )
    : "neutral"

  return (
    <StepCard title={label}>
      <div className="flex items-end justify-between gap-3">
        <p className="flex items-baseline gap-1.5">
          <span
            className={cn(
              "text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] tabular-nums",
              strategy ? STEP_TONE_TEXT[tone] : "text-muted-foreground",
            )}
          >
            {strategy ? strategy.performance.toLocaleString("pt-BR") : "—"}
          </span>
          <span className="text-[11px] text-muted-foreground">
            de performance
          </span>
        </p>
        {waiting && !strategy ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Spinner aria-hidden className="size-3" />
            Aguardando PageSpeed
          </span>
        ) : null}
        {failed && !strategy ? (
          <span role="alert" className="text-[11px] text-destructive">
            {job?.error_message ?? "Não foi possível obter o PageSpeed"}
          </span>
        ) : null}
      </div>
      {strategy ? (
        <StepMeter
          share={strategy.performance / 100}
          tone={tone}
          className="mt-2"
        />
      ) : null}

      <div className="mt-3 border-t border-border/70 pt-3">
        <StepSectionLabel aside="bom · a melhorar · ruim">
          Core Web Vitals
        </StepSectionLabel>
        <div className="flex flex-col gap-3.5">
          <LeadWebsiteVitalGauge
            label="LCP"
            lab={strategy?.lcpMs ?? null}
            field={strategy?.fieldLcpMs ?? null}
            good={PSI_LCP_NEEDS_MS}
            poor={PSI_LCP_POOR_MS}
            max={6000}
            format={formatMs}
          />
          <LeadWebsiteVitalGauge
            label="INP"
            lab={strategy?.inpMs ?? null}
            field={strategy?.fieldInpMs ?? null}
            good={PSI_INP_NEEDS_MS}
            poor={PSI_INP_POOR_MS}
            max={750}
            format={formatMs}
          />
          <LeadWebsiteVitalGauge
            label="CLS"
            lab={strategy?.cls ?? null}
            field={strategy?.fieldCls ?? null}
            good={PSI_CLS_NEEDS}
            poor={PSI_CLS_POOR}
            max={0.4}
            format={formatCls}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/70 pt-3">
        <Chip
          tone={
            !strategy ? "neutral" : strategy.viewportOk ? "success" : "warning"
          }
        >
          {!strategy
            ? "Viewport —"
            : strategy.viewportOk
              ? "Viewport ok"
              : "Viewport não adaptado"}
        </Chip>
        <Chip
          tone={
            !strategy
              ? "neutral"
              : strategy.contrastFails > 0 || strategy.accessibility < 50
                ? "warning"
                : "success"
          }
        >
          {!strategy
            ? "Acessibilidade —"
            : strategy.contrastFails > 0
              ? `${strategy.contrastFails.toLocaleString("pt-BR")} falhas de contraste`
              : `${strategy.accessibility.toLocaleString("pt-BR")} de acessibilidade`}
        </Chip>
      </div>

      {/*
        A captura mora aqui porque foi desta execução que os números saíram —
        antes ela vivia num card próprio que precisava de uma frase explicando
        por que estava ali.
      */}
      <div className="mt-3 border-t border-border/70 pt-3">
        {strategy?.screenshot && !shotFailed ? (
          <img
            src={strategy.screenshot}
            alt={`Captura ${label}`}
            onError={() => setShotFailed(true)}
            className="max-h-64 w-full rounded-lg border border-border/70 bg-background object-cover object-top"
          />
        ) : (
          <div className="flex min-h-28 items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-background px-3 py-6">
            {label === "Mobile" ? (
              <RiSmartphoneLine
                size={14}
                aria-hidden
                className="text-muted-foreground"
              />
            ) : (
              <RiEyeLine
                size={14}
                aria-hidden
                className="text-muted-foreground"
              />
            )}
            <p className="text-xs/relaxed text-muted-foreground">
              Aguardando captura
            </p>
          </div>
        )}
      </div>
    </StepCard>
  )
}
