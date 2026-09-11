"use client"

import { useState } from "react"
import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import {
  RiAlertLine,
  RiCheckLine,
  RiLightbulbLine,
  RiSaveLine,
} from "react-icons/ri"
import {
  compileLeadDiagnosis,
  exportLeadDiagnosisPdf,
  getLeadDiagnosisPdfUrl,
  updateLeadDiagnosisDraft,
} from "@/app/actions/leads"
import { StepCard } from "@/components/custom/LeadStepShell"
import { LeadGbpOpportunitiesCard } from "@/components/custom/LeadGbpPanel/LeadGbpOpportunitiesCard"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "cn"
import { formatDateTimeShort } from "@/lib/date-time"
import {
  DIAGNOSIS_HOOK_MAX,
  DIAGNOSIS_PILLAR_LABELS,
  DIAGNOSIS_PILLARS,
  DIAGNOSIS_PROSE_MAX,
  type DiagnosisPillar,
} from "@/lib/leads/diagnosis-document"
import { LeadDiagnosisScorecard } from "./LeadDiagnosisScorecard"
import { LeadDiagnosisStepHeader } from "./LeadDiagnosisStepHeader"
import type { LeadDiagnosisPanelProps } from "./LeadDiagnosisPanel.types"

const EASE = [0.23, 1, 0.32, 1] as const

const TEXTAREA = "min-h-0 resize-y"

export function LeadDiagnosisPanel({
  detail,
  canEdit,
  unlocked,
  liveFingerprint,
  onDraftChange,
  onExportsChange,
  onPendingChange,
}: LeadDiagnosisPanelProps) {
  const reduced = !!useReducedMotion()
  const fade = {
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0.12 : 0.18, ease: EASE },
  }

  const draft = detail.diagnosisDraft
  const exports = detail.diagnosisExports
  const currentExport = exports.find((item) => item.is_current) ?? null
  const stale = Boolean(draft && draft.facts_fingerprint !== liveFingerprint)

  const [executiveSummary, setExecutiveSummary] = useState(
    draft?.document.prose.executiveSummary ?? "",
  )
  const [commercialHook, setCommercialHook] = useState(
    draft?.document.prose.commercialHook ?? "",
  )
  const [narratives, setNarratives] = useState(
    draft?.document.prose.pillarNarratives ?? {
      google: "",
      website: "",
      presence: "",
      visibility: "",
      geo: "",
    },
  )
  const [compiling, setCompiling] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  // Reset ligado à mudança de chave: no render, não em efeito.
  const [syncedDraft, setSyncedDraft] = useState(draft)
  if (syncedDraft !== draft) {
    setSyncedDraft(draft)
    setExecutiveSummary(draft?.document.prose.executiveSummary ?? "")
    setCommercialHook(draft?.document.prose.commercialHook ?? "")
    setNarratives(
      draft?.document.prose.pillarNarratives ?? {
        google: "",
        website: "",
        presence: "",
        visibility: "",
        geo: "",
      },
    )
  }

  const dirty =
    draft != null &&
    (executiveSummary !== draft.document.prose.executiveSummary ||
      commercialHook !== draft.document.prose.commercialHook ||
      DIAGNOSIS_PILLARS.some(
        (pillar) =>
          narratives[pillar] !== draft.document.prose.pillarNarratives[pillar],
      ))

  async function handleCompile() {
    if (!canEdit || compiling) return
    setCompiling(true)
    setError(null)
    onPendingChange(true)
    const formData = new FormData()
    formData.set("lead_id", detail.lead.id)
    const result = await compileLeadDiagnosis(formData)
    setCompiling(false)
    onPendingChange(false)
    if (result.status === "error") {
      setError(result.message)
      return
    }
    onDraftChange(result.draft)
  }

  async function handleSave(): Promise<boolean> {
    if (!canEdit || !draft || saving) return false
    setSaving(true)
    setError(null)
    onPendingChange(true)
    const formData = new FormData()
    formData.set("lead_id", detail.lead.id)
    formData.set("executive_summary", executiveSummary)
    formData.set("commercial_hook", commercialHook)
    for (const pillar of DIAGNOSIS_PILLARS) {
      formData.set(`narrative_${pillar}`, narratives[pillar])
    }
    const result = await updateLeadDiagnosisDraft(formData)
    setSaving(false)
    onPendingChange(false)
    if (result.status === "error") {
      setError(result.message)
      return false
    }
    onDraftChange(result.draft)
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 1600)
    return true
  }

  async function handleExport() {
    if (!canEdit || !draft || exporting) return
    if (dirty) {
      const saved = await handleSave()
      if (!saved) return
    }
    setExporting(true)
    setError(null)
    onPendingChange(true)
    const formData = new FormData()
    formData.set("lead_id", detail.lead.id)
    const result = await exportLeadDiagnosisPdf(formData)
    setExporting(false)
    onPendingChange(false)
    if (result.status === "error") {
      setError(result.message)
      return
    }
    const nextExports = [
      result.exportRow,
      ...exports
        .filter((item) => item.id !== result.exportRow.id)
        .map((item) => ({ ...item, is_current: false })),
    ]
    onExportsChange(nextExports)
    if (result.url) {
      window.open(result.url, "_blank", "noopener,noreferrer")
    }
  }

  async function handleOpenPdf(exportId?: string) {
    if (opening) return
    setOpening(true)
    setError(null)
    const formData = new FormData()
    formData.set("lead_id", detail.lead.id)
    if (exportId) formData.set("export_id", exportId)
    const result = await getLeadDiagnosisPdfUrl(formData)
    setOpening(false)
    if (result.status === "error") {
      setError(result.message)
      return
    }
    window.open(result.url, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="relative flex flex-col gap-3 pb-20">
      <m.div
        initial={fade.initial}
        animate={fade.animate}
        transition={fade.transition}
      >
        <LeadDiagnosisStepHeader
          updatedAt={draft?.updated_at ?? null}
          hasExport={currentExport != null}
          stale={stale}
          unlocked={unlocked}
          compiling={compiling}
          exporting={exporting}
          canEdit={canEdit}
          onCompile={() => {
            void handleCompile()
          }}
          onExport={() => {
            void handleExport()
          }}
          onOpenPdf={() => {
            void handleOpenPdf()
          }}
        />
      </m.div>

      {error ? (
        <p role="alert" className="text-xs/relaxed text-destructive">
          {error}
        </p>
      ) : null}

      {!unlocked ? (
        <StepCard title="Etapa bloqueada">
          <p className="text-xs/relaxed text-muted-foreground">
            Conclua Perfil no Google, Website, Presença digital, Visibilidade e
            Presença em IA para liberar o diagnóstico.
          </p>
        </StepCard>
      ) : !draft ? (
        <StepCard title="Pronto para compilar">
          <p className="text-xs/relaxed text-muted-foreground">
            Monte o diagnóstico para gerar scorecard, achados cross-pillar,
            roadmap e textos editáveis antes do PDF da reunião.
          </p>
        </StepCard>
      ) : (
        <>
          <m.div
            initial={fade.initial}
            animate={fade.animate}
            transition={{ ...fade.transition, delay: reduced ? 0 : 0.04 }}
          >
            <LeadDiagnosisScorecard document={draft.document} />
          </m.div>

          {draft.document.prose.commercialHook || canEdit ? (
            <StepCard title="Gancho comercial">
              {canEdit ? (
                <>
                  <Textarea
                    id="diagnosis-hook"
                    value={commercialHook}
                    maxLength={DIAGNOSIS_HOOK_MAX}
                    rows={2}
                    disabled={!canEdit || compiling}
                    onChange={(event) => setCommercialHook(event.target.value)}
                    className={TEXTAREA}
                  />
                  <p className="mt-1 text-right text-xs/relaxed tabular-nums text-muted-foreground">
                    {commercialHook.length}/{DIAGNOSIS_HOOK_MAX}
                  </p>
                </>
              ) : (
                <p className="text-xs/relaxed text-foreground">
                  {draft.document.prose.commercialHook}
                </p>
              )}
            </StepCard>
          ) : null}

          <StepCard title="Resumo executivo">
            {canEdit ? (
              <>
                <Textarea
                  id="diagnosis-summary"
                  value={executiveSummary}
                  maxLength={DIAGNOSIS_PROSE_MAX}
                  rows={4}
                  disabled={!canEdit || compiling}
                  onChange={(event) => setExecutiveSummary(event.target.value)}
                  className={TEXTAREA}
                />
                <p className="mt-1 text-right text-xs/relaxed tabular-nums text-muted-foreground">
                  {executiveSummary.length}/{DIAGNOSIS_PROSE_MAX}
                </p>
              </>
            ) : (
              <p className="whitespace-pre-wrap text-xs/relaxed text-foreground">
                {draft.document.prose.executiveSummary}
              </p>
            )}
          </StepCard>

          {/* Antes dos achados, na mesma ordem do PDF e do documento de
              referência: o que funciona vem primeiro. */}
          {(draft.document.facts.strengths?.length ?? 0) > 0 ? (
            <StepCard title="Pontos fortes">
              <ul className="flex flex-col gap-3">
                {(draft.document.facts.strengths ?? []).map((item) => (
                  <li key={item.id} className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-success/10 text-success"
                    >
                      <RiCheckLine size={14} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs/relaxed font-semibold text-foreground">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-xs/relaxed text-muted-foreground">
                        {item.detail}
                      </p>
                      <p className="mt-1 text-xs/relaxed text-muted-foreground">
                        {DIAGNOSIS_PILLAR_LABELS[item.pillar]}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </StepCard>
          ) : null}

          {draft.document.facts.findings.length > 0 ? (
            <StepCard title="Achados prioritários">
              <ul className="flex flex-col gap-3">
                {draft.document.facts.findings.map((item) => (
                  <li key={item.id} className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                    >
                      <RiAlertLine size={14} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs/relaxed font-semibold text-foreground">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-xs/relaxed text-muted-foreground">
                        {item.detail}
                      </p>
                      <p className="mt-1 text-xs/relaxed text-muted-foreground">
                        {item.pillars
                          .map((pillar) => DIAGNOSIS_PILLAR_LABELS[pillar])
                          .join(" · ")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </StepCard>
          ) : null}

          <LeadGbpOpportunitiesCard
            title="Roadmap recomendado"
            items={draft.document.facts.roadmap.map((item) => ({
              id: item.id,
              title: item.title,
              impact: item.impact,
              detail: `${DIAGNOSIS_PILLAR_LABELS[item.pillar]} · ${item.evidence}`,
            }))}
          />

          {DIAGNOSIS_PILLARS.map((pillar: DiagnosisPillar) => (
            <StepCard key={pillar} title={DIAGNOSIS_PILLAR_LABELS[pillar]}>
              <div className="mb-3 flex flex-wrap gap-2">
                {draft.document.facts.pillars[pillar].keyMetrics.map(
                  (metric) => (
                    <span
                      key={metric.id}
                      className="rounded-md border border-border/70 bg-popover px-2 py-1 text-xs/relaxed text-muted-foreground"
                    >
                      <span className="text-muted-foreground">
                        {metric.label}:{" "}
                      </span>
                      {metric.value}
                    </span>
                  ),
                )}
              </div>
              {canEdit ? (
                <>
                  <Textarea
                    id={`diagnosis-narrative-${pillar}`}
                    value={narratives[pillar]}
                    maxLength={DIAGNOSIS_PROSE_MAX}
                    rows={3}
                    disabled={compiling}
                    onChange={(event) =>
                      setNarratives((prev) => ({
                        ...prev,
                        [pillar]: event.target.value,
                      }))
                    }
                    className={TEXTAREA}
                  />
                  <p className="mt-1 text-right text-xs/relaxed tabular-nums text-muted-foreground">
                    {narratives[pillar].length}/{DIAGNOSIS_PROSE_MAX}
                  </p>
                </>
              ) : (
                <p className="text-xs/relaxed text-foreground">
                  {draft.document.prose.pillarNarratives[pillar]}
                </p>
              )}
              {draft.document.facts.pillars[pillar].opportunities.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-1.5 border-t border-border/70 pt-3">
                  {draft.document.facts.pillars[pillar].opportunities
                    .slice(0, 5)
                    .map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start gap-2 text-xs/relaxed text-muted-foreground"
                      >
                        <RiLightbulbLine
                          size={14}
                          aria-hidden
                          className="mt-0.5 shrink-0 text-warning"
                        />
                        <span>{item.title}</span>
                      </li>
                    ))}
                </ul>
              ) : null}
            </StepCard>
          ))}

          {exports.length > 0 ? (
            <StepCard title="PDFs exportados">
              <ul className="flex flex-col gap-2">
                {exports.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs/relaxed text-foreground">
                        {item.file_name}
                        {item.is_current ? (
                          <span className="ml-2 text-success">atual</span>
                        ) : null}
                      </p>
                      <p className="text-xs/relaxed text-muted-foreground">
                        {formatDateTimeShort(item.exported_at)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2"
                      disabled={opening}
                      onClick={() => {
                        void handleOpenPdf(item.id)
                      }}
                    >
                      Abrir
                    </Button>
                  </li>
                ))}
              </ul>
            </StepCard>
          ) : null}

          <StepCard title="Limitações da coleta">
            <ul className="flex flex-col gap-1.5">
              {draft.document.limitations.map((line) => (
                <li
                  key={line}
                  className="text-xs/relaxed text-muted-foreground"
                >
                  · {line}
                </li>
              ))}
            </ul>
          </StepCard>
        </>
      )}

      {canEdit && unlocked && draft ? (
        <div
          className={cn(
            "sticky bottom-0 z-10 -mx-3 border-t border-border/70 bg-background/95 px-3 py-3 backdrop-blur-sm sm:-mx-4 sm:px-4",
          )}
        >
          <div className="flex flex-wrap items-center justify-end gap-2">
            {savedFlash ? (
              <span className="text-xs/relaxed text-success">
                Rascunho salvo
              </span>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              disabled={!dirty || saving || compiling || exporting}
              onClick={() => {
                void handleSave()
              }}
            >
              <RiSaveLine
                size={16}
                aria-hidden
                className={saving ? "animate-pulse" : undefined}
              />
              Salvar rascunho
            </Button>
            <Button
              type="button"
              disabled={saving || compiling || exporting}
              onClick={() => {
                void handleExport()
              }}
            >
              Exportar PDF
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
