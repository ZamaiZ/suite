"use client"

import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import type { IconType } from "react-icons"
import {
  RiBarChartBoxLine,
  RiFileList3Line,
  RiGlobalLine,
  RiGroupLine,
  RiMapPin2Line,
} from "react-icons/ri"
import { LeadGbpAuditStep } from "./LeadGbpAuditStep"
import { cn } from "@/lib/cn"
import { formatDateTimeShort } from "@/lib/date-time"
import {
  buildGbpAuditRailModel,
  type GbpAuditRailStepId,
  type GbpAuditRailStatus,
  type GbpAuditRailWebsite,
  type GbpAuditRailDigitalPresence,
  type GbpAuditRailVisibility,
  type GbpAuditRailDiagnosis,
} from "@/lib/leads/gbp-audit-rail"
import type { LeadGbpProfile } from "@/lib/leads/gbp"
import { GBP_AUDIT_STATUS_LABEL } from "@/lib/leads/gbp-presenters"

const EASE = [0.23, 1, 0.32, 1] as const

const STATUS_TONE: Record<GbpAuditRailStatus, string> = {
  processing: "bg-warning-subtle text-fg",
  analyzed: "bg-success/10 text-success",
  pending: "bg-hover text-fg-secondary",
  error: "bg-danger/10 text-danger",
}

const STATUS_DOT: Record<GbpAuditRailStatus, string> = {
  processing: "bg-warning",
  analyzed: "bg-success",
  pending: "bg-fg-muted",
  error: "bg-danger",
}

const STEP_ICONS: Record<string, IconType> = {
  "google-profile": RiMapPin2Line,
  website: RiGlobalLine,
  "digital-presence": RiGroupLine,
  visibility: RiBarChartBoxLine,
  diagnosis: RiFileList3Line,
}

export function LeadGbpAuditRail({
  profile,
  website,
  digitalPresence,
  visibility,
  diagnosis,
  selectedStep,
  googleAlertCount = 0,
  websiteAlertCount = 0,
  loading,
  onSelectStep,
}: {
  profile: LeadGbpProfile | null
  website: GbpAuditRailWebsite
  digitalPresence?: GbpAuditRailDigitalPresence
  visibility?: GbpAuditRailVisibility
  diagnosis?: GbpAuditRailDiagnosis
  selectedStep: GbpAuditRailStepId
  googleAlertCount?: number
  websiteAlertCount?: number
  loading: boolean
  onSelectStep: (step: GbpAuditRailStepId) => void
}) {
  const reduced = !!useReducedMotion()

  if (loading && !profile) {
    return <AuditRailSkeleton />
  }

  const model = buildGbpAuditRailModel({
    profile,
    website,
    digitalPresence: digitalPresence ?? null,
    visibility: visibility ?? null,
    diagnosis: diagnosis ?? null,
    selectedStep,
    googleAlertCount,
    websiteAlertCount,
  })
  const selected = model.steps.find((step) => step.selected) ?? model.steps[0]
  const SelectedIcon = STEP_ICONS[selected?.id ?? "google-profile"] ?? RiMapPin2Line

  function mobileSubtitle(): string {
    if (selected?.id === "diagnosis") {
      if (!diagnosis?.unlocked) return "Conclua as etapas anteriores"
      if (diagnosis.stale) return "Fatos desatualizados"
      if (model.showAlerts && model.alertCount > 0) {
        return "Recompile os fatos"
      }
      return diagnosis.hasExport
        ? "PDF pronto para a reunião"
        : "Aguardando diagnóstico"
    }
    if (model.showAlerts) {
      return model.alertCount === 0
        ? "Nenhum alerta encontrado"
        : model.alertCount === 1
          ? "1 alerta encontrado"
          : `${model.alertCount.toLocaleString("pt-BR")} alertas encontrados`
    }
    if (selected?.id === "website") return "Aguardando coleta do site"
    if (selected?.id === "digital-presence") {
      return "Aguardando revisão das redes"
    }
    if (selected?.id === "visibility") {
      return "Aguardando análise de visibilidade"
    }
    return "Aguardando perfil vinculado"
  }

  return (
    <div className="flex h-auto min-h-0 flex-col px-3 py-4 sm:px-4 lg:h-full">
      <header className="shrink-0">
        <h2 className="font-display text-body-sm font-semibold text-fg">
          Auditoria digital
        </h2>
        <span
          className={cn(
            "mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-sans text-caption font-semibold",
            STATUS_TONE[model.status],
          )}
        >
          <span
            aria-hidden
            className={cn(
              "size-2 rounded-full",
              STATUS_DOT[model.status],
              model.status === "processing" &&
                "motion-safe:animate-pulse motion-reduce:opacity-70",
            )}
          />
          {GBP_AUDIT_STATUS_LABEL[model.status]}
        </span>
      </header>

      <section className="mt-4 shrink-0" aria-label="Progresso da auditoria">
        <div className="flex items-center justify-between gap-3">
          <p className="font-sans text-caption font-medium text-fg-secondary">
            Etapa {model.currentStep} de {model.totalSteps}
          </p>
          <span className="font-mono text-caption text-fg-muted">
            {model.progress}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Progresso da auditoria digital"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={model.progress}
          aria-valuetext={`Etapa ${model.currentStep} de ${model.totalSteps}`}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-border-subtle"
        >
          <m.div
            className="h-full w-full origin-left rounded-full bg-accent"
            initial={reduced ? false : { transform: "scaleX(0)" }}
            animate={{ transform: `scaleX(${model.progress / 100})` }}
            transition={{ duration: reduced ? 0.12 : 0.24, ease: EASE }}
          />
        </div>
      </section>

      <nav
        aria-label="Etapas da auditoria digital"
        className="mt-4 min-h-0 flex-1 overflow-y-auto"
      >
        <div className="relative hidden lg:block">
          <span
            aria-hidden
            className="absolute top-7 bottom-7 left-6 w-px bg-border"
          />
          <ol className="relative flex flex-col justify-start gap-1">
            {model.steps.map((step, index) => {
              const Icon = STEP_ICONS[step.id] ?? RiFileList3Line
              return (
                <LeadGbpAuditStep
                  key={step.id}
                  step={step}
                  index={index}
                  icon={Icon}
                  reduced={reduced}
                  onSelect={onSelectStep}
                />
              )
            })}
          </ol>
        </div>

        <div className="relative lg:hidden">
          <span
            aria-hidden
            className="absolute top-4 right-[10%] left-[10%] h-px bg-border"
          />
          <ol className="relative grid grid-cols-5 gap-1">
            {model.steps.map((step, index) => (
              <li
                key={step.id}
                aria-current={step.selected ? "step" : undefined}
                className="relative z-10 flex flex-col items-center gap-1.5"
              >
                {step.selectable ? (
                  <button
                    type="button"
                    onClick={() => onSelectStep(step.id)}
                    className={cn(
                      "inline-flex size-8 items-center justify-center rounded-full border bg-elevated font-sans text-caption font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                      step.selected
                        ? model.status === "error"
                          ? "border-danger bg-danger text-danger-fg"
                          : "border-primary bg-primary text-primary-foreground"
                        : "border-border text-fg-secondary",
                    )}
                    aria-label={step.label}
                  >
                    {index + 1}
                  </button>
                ) : (
                  <span
                    aria-hidden
                    className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-elevated font-sans text-caption font-semibold text-fg-secondary"
                  >
                    {index + 1}
                  </span>
                )}
                <span className="sr-only">
                  {step.label},{" "}
                  {step.selected ? "etapa atual" : "etapa futura"}
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex items-center gap-3 rounded-xl border border-accent/20 bg-surface/80 p-3 shadow-card">
            <span
              aria-hidden
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-accent/15 bg-elevated text-accent"
            >
              <SelectedIcon size={19} />
            </span>
            <div className="min-w-0">
              <p className="truncate font-sans text-caption font-semibold text-fg">
                {selected?.label}
              </p>
              <p className="mt-0.5 font-sans text-caption text-fg-muted">
                {mobileSubtitle()}
              </p>
            </div>
          </div>
        </div>
      </nav>

      <AuditMetadata
        collectedAt={model.collectedAt}
        analyzedAt={model.analyzedAt}
        processing={model.status === "processing"}
      />
    </div>
  )
}

function AuditMetadata({
  collectedAt,
  analyzedAt,
  processing,
}: {
  collectedAt: string | null
  analyzedAt: string | null
  processing: boolean
}) {
  return (
    <dl className="mt-3 shrink-0 divide-y divide-border-subtle border-t border-border-subtle pt-1.5 font-sans text-caption lg:mt-3">
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 py-1.5">
        <dt className="text-fg-muted">Coletado</dt>
        <dd className="text-right font-medium text-fg-secondary">
          {collectedAt ? formatDateTimeShort(collectedAt) : "—"}
        </dd>
      </div>
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 py-1.5">
        <dt className="text-fg-muted">Analisado</dt>
        <dd className="text-right font-medium text-fg-secondary">
          {analyzedAt
            ? formatDateTimeShort(analyzedAt)
            : processing
              ? "Em andamento"
              : "—"}
        </dd>
      </div>
    </dl>
  )
}

function AuditRailSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando auditoria digital"
      className="flex h-auto min-h-0 flex-col gap-4 px-3 py-4 sm:px-4 lg:h-full"
    >
      <div className="flex flex-col gap-3">
        <span className="h-6 w-40 animate-pulse rounded-md bg-hover motion-reduce:animate-none" />
        <span className="h-8 w-28 animate-pulse rounded-lg bg-hover motion-reduce:animate-none" />
      </div>
      <div className="flex flex-col gap-3">
        <span className="h-4 w-24 animate-pulse rounded bg-hover motion-reduce:animate-none" />
        <span className="h-1.5 w-full animate-pulse rounded-full bg-hover motion-reduce:animate-none" />
      </div>
      <div className="hidden flex-col gap-2 lg:flex">
        {[0, 1, 2, 3, 4].map((item) => (
          <span
            key={item}
            className="h-14 animate-pulse rounded-xl bg-hover motion-reduce:animate-none"
            style={{ animationDelay: `${item * 40}ms` }}
          />
        ))}
      </div>
      <div className="flex flex-col gap-4 lg:hidden">
        <span className="h-8 w-full animate-pulse rounded-full bg-hover motion-reduce:animate-none" />
        <span className="h-[4.25rem] animate-pulse rounded-xl bg-hover motion-reduce:animate-none" />
      </div>
      <span className="mt-auto h-16 animate-pulse rounded-lg bg-hover motion-reduce:animate-none" />
    </div>
  )
}
