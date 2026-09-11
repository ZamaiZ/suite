"use client"

import type { ReactNode } from "react"
import {
  RiCheckLine,
  RiCloseLine,
  RiSubtractLine,
} from "react-icons/ri"
import {
  StepCard,
  StepCountCell,
  StepSectionLabel,
} from "@/components/custom/LeadStepShell"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Badge } from "@/components/ui/badge"
import { cn } from "cn"
import { formatDate } from "@/lib/date-time"
import {
  GEO_META_MAX,
  GEO_META_MIN,
  GEO_TITLE_MAX,
  GEO_TITLE_MIN,
} from "@/lib/leads/geo-audit"
import { LeadGeoReview } from "./LeadGeoReview"
import type { GeoController } from "./use-geo-controller"

/**
 * Três estados, e o terceiro é o que a etapa inteira existe para preservar:
 * `unknown` é "não medimos", e é diferente de "medimos e está ruim". Pintar os
 * dois de vermelho faria o analista cobrar do lead um arquivo que ninguém
 * chegou a buscar.
 */
type CheckState = "ok" | "bad" | "unknown"

function CheckRow({
  state,
  label,
  detail,
}: {
  state: CheckState
  label: string
  detail?: string
}) {
  const Icon =
    state === "ok" ? RiCheckLine : state === "bad" ? RiCloseLine : RiSubtractLine
  return (
    <li className="flex items-start gap-2 border-b border-border/60 py-2 first:pt-0 last:border-b-0 last:pb-0">
      <Icon
        size={14}
        aria-hidden
        className={cn(
          "mt-0.5 shrink-0",
          state === "ok"
            ? "text-success"
            : state === "bad"
              ? "text-warning"
              : "text-muted-foreground/60",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs/relaxed text-foreground">{label}</p>
        {detail ? (
          <p className="text-xs/relaxed text-muted-foreground">{detail}</p>
        ) : null}
      </div>
    </li>
  )
}

function NoCollection({ children }: { children: ReactNode }) {
  return (
    <Empty className="py-8">
      <EmptyHeader>
        <EmptyTitle>Sem análise</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export function LeadGeoTabAccess({ controller }: { controller: GeoController }) {
  const snapshot = controller.snapshot
  if (!snapshot) {
    return (
      <NoCollection>
        Rode a análise para ver o que as IAs conseguem acessar neste site.
      </NoCollection>
    )
  }

  const access = snapshot.accessibility
  const extended = snapshot.sources.websiteCrawlExtended
  const blocked = access.aiCrawlers.filter((item) => item.blocked)

  return (
    <div className="grid min-h-0 gap-3.5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <StepCard title="Acesso dos robôs de IA">
        {!extended ? (
          <p className="mb-3 text-xs/relaxed text-muted-foreground">
            O crawl lido é anterior à coleta de robôs de IA. Estes campos não
            foram medidos — recolete o Website para preenchê-los.
          </p>
        ) : null}
        <div className="grid grid-cols-3 gap-2">
          <StepCountCell
            value={extended ? String(access.aiCrawlers.length) : "—"}
            label="declarados"
            dim={!extended}
          />
          <StepCountCell
            value={extended ? String(blocked.length) : "—"}
            label="bloqueados"
            dim={!extended}
          />
          <StepCountCell
            value={
              access.sitemap.urlCount === null
                ? "—"
                : String(access.sitemap.urlCount)
            }
            label="URLs no sitemap"
            dim={access.sitemap.urlCount === null}
          />
        </div>

        {extended && blocked.length > 0 ? (
          <div className="mt-3">
            <StepSectionLabel>Bloqueados no robots.txt</StepSectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {blocked.map((item) => (
                <Badge key={item.agent} variant="warning">
                  {item.agent}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </StepCard>

      <StepCard title="Checagens de acesso">
        <ul className="flex flex-col">
          <CheckRow
            state={
              !extended ? "unknown" : access.llmsTxt.found ? "ok" : "bad"
            }
            label="llms.txt publicado"
            detail={
              !extended
                ? "Não medido neste crawl"
                : access.llmsTxt.status === null
                  ? undefined
                  : `HTTP ${access.llmsTxt.status}`
            }
          />
          <CheckRow
            state={
              !extended ? "unknown" : blocked.length === 0 ? "ok" : "bad"
            }
            label="Robôs de IA liberados"
            detail={
              !extended
                ? "Não medido neste crawl"
                : blocked.length === 0
                  ? "Nenhum agente de IA bloqueado"
                  : `${blocked.length} bloqueado(s)`
            }
          />
          <CheckRow
            state={access.searchCrawlersBlocked ? "bad" : "ok"}
            label="Buscadores liberados"
          />
          <CheckRow
            state={access.sitemap.found ? "ok" : "bad"}
            label="Sitemap XML"
          />
          <CheckRow
            state={access.noindexTag ? "bad" : "ok"}
            label="Home sem noindex na tag"
          />
          <CheckRow
            state={access.noindexHeader ? "bad" : "ok"}
            label="Home sem noindex no header"
          />
          <CheckRow
            state={access.contentRequiresJs ? "bad" : "ok"}
            label="Conteúdo servido no HTML"
            detail={`${access.serverRenderedWords} palavras no HTML cru`}
          />
        </ul>
      </StepCard>
    </div>
  )
}

export function LeadGeoTabContent({
  controller,
  readingMode,
}: {
  controller: GeoController
  readingMode: boolean
}) {
  const snapshot = controller.snapshot
  if (!snapshot) {
    return (
      <NoCollection>
        Rode a análise para ver o que as IAs conseguem entender deste conteúdo.
      </NoCollection>
    )
  }

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
    <div className="grid min-h-0 gap-3.5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
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

      <LeadGeoReview controller={controller} readingMode={readingMode} />
    </div>
  )
}

export function LeadGeoTabCitations({
  controller,
}: {
  controller: GeoController
}) {
  const snapshot = controller.snapshot
  if (!snapshot) {
    return (
      <NoCollection>
        Rode a análise para ver onde este negócio já é citado.
      </NoCollection>
    )
  }

  const aiOverview = snapshot.aiOverview
  const citations = snapshot.citations

  return (
    <div className="grid min-h-0 gap-3.5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <StepCard title="Citações na visão geral de IA do Google">
        {aiOverview === null ? (
          <p className="text-xs/relaxed text-muted-foreground">
            Rode a análise de Visibilidade: estas linhas vêm da mesma coleta,
            já paga, e sem ela não há o que ler.
          </p>
        ) : aiOverview.keywords.length === 0 ? (
          <p className="text-xs/relaxed text-muted-foreground">
            {aiOverview.hasOrganicFootprint
              ? "O site ranqueia no orgânico e não é citado em nenhuma visão geral de IA."
              : "O site ainda não ranqueia no orgânico, então não há onde ser citado."}
          </p>
        ) : (
          <ul className="flex flex-col">
            {aiOverview.keywords.map((row) => (
              <li
                key={`${row.keyword}-${row.url ?? ""}`}
                className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 first:pt-0 last:border-b-0 last:pb-0"
              >
                <span className="min-w-0 flex-1 truncate text-xs/relaxed text-foreground">
                  {row.keyword}
                </span>
                <span className="shrink-0 text-xs/relaxed text-muted-foreground tabular-nums">
                  {row.volume === null ? "—" : `${row.volume}/mês`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </StepCard>

      <StepCard title="Fontes que a IA consulta">
        {citations === null ? (
          /* `null` é "não coletado". Dizer "nenhuma citação" aqui afirmaria
             ausência que ninguém mediu — o erro que a etapa inteira evita. */
          <p className="text-xs/relaxed text-muted-foreground">
            Não coletado. Wikipédia, Reddit e YouTube entram numa onda
            seguinte, junto com a demanda de busca em IA.
          </p>
        ) : citations.sources.length === 0 ? (
          <p className="text-xs/relaxed text-muted-foreground">
            Nenhuma citação encontrada no catálogo. Link ausente não prova
            ausência de menção — só de menção com link.
          </p>
        ) : (
          <ul className="flex flex-col">
            {citations.sources.map((source) => (
              <li
                key={source.domain}
                className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 first:pt-0 last:border-b-0 last:pb-0"
              >
                <span className="min-w-0 flex-1 truncate text-xs/relaxed text-foreground">
                  {source.domain}
                </span>
                <span className="shrink-0 text-xs/relaxed text-muted-foreground tabular-nums">
                  {source.links}
                </span>
              </li>
            ))}
          </ul>
        )}
      </StepCard>
    </div>
  )
}

export function LeadGeoTabProbe({ controller }: { controller: GeoController }) {
  const probe = controller.snapshot?.promptVisibility ?? null

  return (
    <StepCard title="Sondagem em LLM">
      {probe === null ? (
        <p className="text-xs/relaxed text-muted-foreground">
          Não sondado. A sondagem pergunta a ChatGPT, Claude, Gemini e
          Perplexity o que este mercado pergunta, e mede se a marca aparece.
          É a única parte desta etapa que custa dinheiro, e por isso tem botão
          próprio — que entra numa onda seguinte.
        </p>
      ) : (
        <p className="text-xs/relaxed text-muted-foreground">
          {probe.runs.length} resposta(s) analisada(s).
        </p>
      )}
    </StepCard>
  )
}
