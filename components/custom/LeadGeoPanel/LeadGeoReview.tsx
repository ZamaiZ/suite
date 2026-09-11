"use client"

import { StepCard } from "@/components/custom/LeadStepShell"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "cn"
import type { GeoSnapshot } from "@/lib/leads/geo-audit"
import {
  GEO_REVIEW_CATALOG,
  GEO_REVIEW_NOTE_MAX,
  GEO_REVIEW_VERDICT_LABEL,
  type GeoReviewCriterion,
  type GeoReviewCriterionId,
  type GeoReviewVerdict,
} from "@/lib/leads/geo-review"
import type { GeoController } from "./use-geo-controller"

/**
 * Evidência de máquina: chip, não parágrafo cinza indistinguível do rótulo.
 * É o que o dado já sabe — o critério existe justamente para o humano dizer o
 * que o dado não alcança.
 */
function Evidence({ children }: { children: string }) {
  return (
    <span className="mt-1 inline-flex h-[22px] items-center rounded-md bg-accent px-2 text-[11px] text-accent-foreground">
      {children}
    </span>
  )
}

function evidenceFor(
  id: GeoReviewCriterionId,
  snapshot: GeoSnapshot | null,
): string | null {
  if (!snapshot) return null
  if (id === "entity_definition") {
    const schema = snapshot.content.identitySchema
    return schema.length === 0
      ? "Nenhum schema de identidade declarado"
      : `Schema declara: ${schema.join(", ")}`
  }
  if (id === "citation_readiness") {
    // O dado só sabe se existe formato de pergunta e resposta. Se o conteúdo
    // é citável de verdade é o que o humano responde.
    if (!snapshot.sources.websiteCrawlExtended) {
      return "Headings não medidos neste crawl"
    }
    return snapshot.content.hasFaqSchema
      ? "FAQ declarada em schema"
      : `${snapshot.content.questionHeadings} heading(s) em forma de pergunta`
  }
  if (id === "authority_trust") {
    const citations = snapshot.citations
    if (citations === null) return "Fontes de autoridade não coletadas"
    return citations.sources.length === 0
      ? "Nenhuma citação encontrada nas fontes do catálogo"
      : `${citations.sources.length} fonte(s): ${citations.sources.map((item) => item.domain).join(", ")}`
  }
  return null
}

function VerdictControl({
  id,
  label,
  value,
  allowsNa,
  disabled,
  onChange,
}: {
  id: string
  label: string
  value: GeoReviewVerdict | null
  allowsNa: boolean
  disabled: boolean
  onChange: (verdict: GeoReviewVerdict) => void
}) {
  const options: GeoReviewVerdict[] = allowsNa
    ? ["ok", "issue", "na"]
    : ["ok", "issue"]
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={label}
      className="flex flex-wrap justify-end gap-1"
    >
      {options.map((option) => {
        const selected = value === option
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cn(
              "inline-flex h-7 cursor-pointer items-center rounded-md border px-2",
              "text-xs/relaxed transition-[colors,transform] duration-150 ease-out",
              "active:scale-[0.97]",
              selected
                ? option === "issue"
                  ? "border-warning/25 bg-warning/10 text-warning"
                  : option === "na"
                    ? "border-border bg-accent text-muted-foreground"
                    : "border-primary bg-primary/10 text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            {GEO_REVIEW_VERDICT_LABEL[option]}
          </button>
        )
      })}
    </div>
  )
}

function CriterionRow({
  criterion,
  controller,
  editable,
}: {
  criterion: GeoReviewCriterion
  controller: GeoController
  editable: boolean
}) {
  const answer = controller.review[criterion.id]
  const evidence = evidenceFor(criterion.id, controller.snapshot)
  // A nota só abre depois do veredito: campo em branco antes do julgamento é
  // convite a escrever o que a próxima pergunta já ia cobrir.
  const showNote = answer.verdict !== null

  function patch(next: Partial<typeof answer>) {
    controller.handleReviewDraftChange({
      ...controller.review,
      [criterion.id]: { ...answer, ...next },
    })
  }

  return (
    <li className="border-b border-border/60 py-3 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs/relaxed font-medium text-foreground">
            {criterion.label}
          </p>
          <p className="text-xs/relaxed text-muted-foreground">
            {criterion.placeholder}
          </p>
          {evidence ? <Evidence>{evidence}</Evidence> : null}
        </div>
        <VerdictControl
          id={`geo-verdict-${criterion.id}`}
          label={criterion.label}
          value={answer.verdict}
          allowsNa={criterion.allowsNa}
          disabled={!editable}
          onChange={(verdict) => patch({ verdict })}
        />
      </div>
      {showNote ? (
        <Textarea
          className="mt-2 min-h-16"
          value={answer.note}
          maxLength={GEO_REVIEW_NOTE_MAX}
          disabled={!editable}
          aria-label={`Nota de ${criterion.label}`}
          placeholder="O que você viu?"
          onChange={(event) => patch({ note: event.target.value })}
        />
      ) : null}
    </li>
  )
}

/**
 * Os três checks que nenhuma API responde.
 *
 * Nenhuma LLM os julga — decisão explícita da spec: nesta etapa a LLM é objeto
 * de medição, nunca instrumento de análise. Veredito em branco não gera
 * oportunidade, porque ausência de resposta não é ausência de problema.
 */
export function LeadGeoReview({
  controller,
  readingMode,
}: {
  controller: GeoController
  readingMode: boolean
}) {
  const editable = controller.canEdit && !readingMode
  const criteria = GEO_REVIEW_CATALOG.filter((item) => item.hasVerdict)

  return (
    <StepCard title="Julgamento do analista">
      <ul className="flex flex-col">
        {criteria.map((criterion) => (
          <CriterionRow
            key={criterion.id}
            criterion={criterion}
            controller={controller}
            editable={editable}
          />
        ))}
      </ul>
    </StepCard>
  )
}
