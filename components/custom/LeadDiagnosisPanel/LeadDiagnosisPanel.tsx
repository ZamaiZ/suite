"use client"

import { useEffect, useState } from "react"
import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import {
  RiAlertLine,
  RiLightbulbLine,
  RiSaveLine,
} from "react-icons/ri"
import {
  compileLeadDiagnosis,
  exportLeadDiagnosisPdf,
  getLeadDiagnosisPdfUrl,
  updateLeadDiagnosisDraft,
} from "@/app/actions/leads"
import { LeadGbpCard } from "@/components/custom/LeadGbpPanel/LeadGbpCard"
import { LeadGbpOpportunitiesCard } from "@/components/custom/LeadGbpPanel/LeadGbpOpportunitiesCard"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/cn"
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
  const stale = Boolean(
    draft && draft.facts_fingerprint !== liveFingerprint,
  )

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
    },
  )
  const [compiling, setCompiling] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    setExecutiveSummary(draft?.document.prose.executiveSummary ?? "")
    setCommercialHook(draft?.document.prose.commercialHook ?? "")
    setNarratives(
      draft?.document.prose.pillarNarratives ?? {
        google: "",
        website: "",
        presence: "",
        visibility: "",
      },
    )
  }, [draft])

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
        <p role="alert" className="font-sans text-caption text-danger">
          {error}
        </p>
      ) : null}

      {!unlocked ? (
        <LeadGbpCard title="Etapa bloqueada">
          <p className="font-sans text-caption text-fg-muted">
            Conclua Perfil no Google, Website, Presença digital e Visibilidade
            para liberar o diagnóstico.
          </p>
        </LeadGbpCard>
      ) : !draft ? (
        <LeadGbpCard title="Pronto para compilar">
          <p className="font-sans text-caption text-fg-muted">
            Monte o diagnóstico para gerar scorecard, achados cross-pillar,
            roadmap e textos editáveis antes do PDF da reunião.
          </p>
        </LeadGbpCard>
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
            <LeadGbpCard title="Gancho comercial">
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
                  <p className="mt-1 text-right font-sans text-caption tabular-nums text-fg-muted">
                    {commercialHook.length}/{DIAGNOSIS_HOOK_MAX}
                  </p>
                </>
              ) : (
                <p className="font-sans text-body-sm text-fg">
                  {draft.document.prose.commercialHook}
                </p>
              )}
            </LeadGbpCard>
          ) : null}

          <LeadGbpCard title="Resumo executivo">
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
                <p className="mt-1 text-right font-sans text-caption tabular-nums text-fg-muted">
                  {executiveSummary.length}/{DIAGNOSIS_PROSE_MAX}
                </p>
              </>
            ) : (
              <p className="whitespace-pre-wrap font-sans text-body-sm text-fg">
                {draft.document.prose.executiveSummary}
              </p>
            )}
          </LeadGbpCard>

          {draft.document.facts.findings.length > 0 ? (
            <LeadGbpCard title="Achados prioritários">
              <ul className="flex flex-col gap-3">
                {draft.document.facts.findings.map((item) => (
                  <li key={item.id} className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"
                    >
                      <RiAlertLine size={14} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-sans text-caption font-semibold text-fg">
                        {item.title}
                      </p>
                      <p className="mt-0.5 font-sans text-caption text-fg-muted">
                        {item.detail}
                      </p>
                      <p className="mt-1 font-sans text-caption text-fg-secondary">
                        {item.pillars
                          .map((pillar) => DIAGNOSIS_PILLAR_LABELS[pillar])
                          .join(" · ")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </LeadGbpCard>
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
            <LeadGbpCard
              key={pillar}
              title={DIAGNOSIS_PILLAR_LABELS[pillar]}
            >
              <div className="mb-3 flex flex-wrap gap-2">
                {draft.document.facts.pillars[pillar].keyMetrics.map((metric) => (
                  <span
                    key={metric.id}
                    className="rounded-md border border-border-subtle bg-elevated px-2 py-1 font-sans text-caption text-fg-secondary"
                  >
                    <span className="text-fg-muted">{metric.label}: </span>
                    {metric.value}
                  </span>
                ))}
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
                  <p className="mt-1 text-right font-sans text-caption tabular-nums text-fg-muted">
                    {narratives[pillar].length}/{DIAGNOSIS_PROSE_MAX}
                  </p>
                </>
              ) : (
                <p className="font-sans text-caption text-fg">
                  {draft.document.prose.pillarNarratives[pillar]}
                </p>
              )}
              {draft.document.facts.pillars[pillar].opportunities.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-1.5 border-t border-border-subtle pt-3">
                  {draft.document.facts.pillars[pillar].opportunities
                    .slice(0, 5)
                    .map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start gap-2 font-sans text-caption text-fg-secondary"
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
            </LeadGbpCard>
          ))}

          {exports.length > 0 ? (
            <LeadGbpCard title="PDFs exportados">
              <ul className="flex flex-col gap-2">
                {exports.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-sans text-caption text-fg">
                        {item.file_name}
                        {item.is_current ? (
                          <span className="ml-2 text-success">atual</span>
                        ) : null}
                      </p>
                      <p className="font-sans text-caption text-fg-muted">
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
            </LeadGbpCard>
          ) : null}

          <LeadGbpCard title="Limitações da coleta">
            <ul className="flex flex-col gap-1.5">
              {draft.document.limitations.map((line) => (
                <li
                  key={line}
                  className="font-sans text-caption text-fg-muted"
                >
                  · {line}
                </li>
              ))}
            </ul>
          </LeadGbpCard>
        </>
      )}

      {canEdit && unlocked && draft ? (
        <div
          className={cn(
            "sticky bottom-0 z-10 -mx-3 border-t border-border-subtle bg-canvas/95 px-3 py-3 backdrop-blur-sm sm:-mx-4 sm:px-4",
          )}
        >
          <div className="flex flex-wrap items-center justify-end gap-2">
            {savedFlash ? (
              <span className="font-sans text-caption text-success">
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
