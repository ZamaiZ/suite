"use client"

import { StepCard } from "@/components/custom/LeadStepShell"
import { formatDate } from "@/lib/date-time"
import {
  GEO_META_MAX,
  GEO_META_MIN,
  GEO_TITLE_MAX,
  GEO_TITLE_MIN,
  type GeoSnapshot,
} from "@/lib/leads/geo-audit"
import { CheckRow, type CheckState } from "./LeadGeoAccessBoard"

/** Os dois cards de checagem da aba Conteúdo. */
export function LeadGeoContentChecks({ snapshot }: { snapshot: GeoSnapshot }) {
  const content = snapshot.content
  const extended = snapshot.sources.websiteCrawlExtended
  const freshness = content.freshness
  const freshest =
    freshness.dateModified ?? freshness.datePublished ?? freshness.sitemapLastmod

  function bandState(
    value: number | null,
    min: number,
    max: number,
  ): CheckState {
    if (value === null) return "unknown"
    return value >= min && value <= max ? "ok" : "bad"
  }

  return (
      <div className="flex min-w-0 flex-col gap-3.5">
        <StepCard title="Conteúdo para motores generativos">
          <ul className="flex flex-col">
            <CheckRow
              state={content.identitySchema.length > 0 ? "ok" : "bad"}
              label="Schema de identidade"
              detail={
                content.identitySchema.length > 0
                  ? content.identitySchema.join(", ")
                  : "Nenhum tipo que declare a empresa"
              }
            />
            <CheckRow
              state={
                content.hasFaqSchema
                  ? "ok"
                  : !extended
                    ? "unknown"
                    : content.questionHeadings >= 3
                      ? "ok"
                      : "bad"
              }
              label="Conteúdo em pergunta e resposta"
              detail={
                content.hasFaqSchema
                  ? "FAQPage declarada em schema"
                  : !extended
                    ? "Headings não medidos neste crawl"
                    : `${content.questionHeadings} heading(s) em forma de pergunta`
              }
            />
            <CheckRow
              state={
                !extended
                  ? "unknown"
                  : content.headingDepth.skips
                    ? "bad"
                    : "ok"
              }
              label="Hierarquia de headings"
              detail={
                !extended
                  ? "Headings não medidos neste crawl"
                  : `${content.headingDepth.levels} nível(is)${content.headingDepth.skips ? ", com salto" : ""}`
              }
            />
            <CheckRow
              state={
                content.contactPoints.phone ||
                content.contactPoints.email ||
                content.contactPoints.address
                  ? "ok"
                  : "bad"
              }
              label="Contato legível por máquina"
              detail={
                [
                  content.contactPoints.phone ? "telefone" : null,
                  content.contactPoints.email ? "e-mail" : null,
                  content.contactPoints.address ? "endereço" : null,
                  content.contactPoints.whatsapp ? "WhatsApp" : null,
                ]
                  .filter(Boolean)
                  .join(", ") || "Nenhum ponto de contato estruturado"
              }
            />
            <CheckRow
              state={
                !freshness.collected ? "unknown" : freshest ? "ok" : "bad"
              }
              label="Sinal de conteúdo atualizado"
              detail={
                !freshness.collected
                  ? "Datas não coletadas neste crawl"
                  : freshest
                    ? `Mais recente: ${formatDate(freshest)}`
                    : "Nenhuma data declarada"
              }
            />
          </ul>
        </StepCard>

        <StepCard title="On-page">
          <ul className="flex flex-col">
            <CheckRow
              state={bandState(content.titleLength, GEO_TITLE_MIN, GEO_TITLE_MAX)}
              label="Title tag"
              detail={
                content.titleLength === null
                  ? "Sem title"
                  : `${content.titleLength} caracteres · ideal ${GEO_TITLE_MIN}–${GEO_TITLE_MAX}`
              }
            />
            <CheckRow
              state={bandState(
                content.metaDescriptionLength,
                GEO_META_MIN,
                GEO_META_MAX,
              )}
              label="Meta description"
              detail={
                content.metaDescriptionLength === null
                  ? "Sem meta description"
                  : `${content.metaDescriptionLength} caracteres · ideal ${GEO_META_MIN}–${GEO_META_MAX}`
              }
            />
          </ul>
        </StepCard>
      </div>
  )
}
