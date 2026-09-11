"use client"

import {
  StepCard,
  StepCountCell,
  StepSectionLabel,
} from "@/components/custom/LeadStepShell"
import { LeadWebsiteStackedBar } from "@/components/custom/LeadWebsitePanel/LeadWebsiteStackedBar"
import { formatDate } from "@/lib/date-time"
import {
  visibilityCanonicalTrafficShare,
  visibilityIntentBreakdown,
  visibilityPages,
} from "@/lib/leads/visibility-pages"
import { formatVisibilityMetric } from "@/lib/leads/visibility-presenters"
import { LeadVisibilityIndexAgeGauge } from "./LeadVisibilityIndexAgeGauge"
import { LeadVisibilityKeywordsTable } from "./LeadVisibilityKeywordsTable"
import { LeadVisibilityRankedList } from "./LeadVisibilityRankedList"
import { LeadVisibilityReview } from "./LeadVisibilityReview"
import type { VisibilityController } from "./use-visibility-controller"

/**
 * Cada aba tem o próprio vazio. "Sem coleta" numa etapa cara não é erro: é o
 * estado inicial de todo lead, e o botão que resolve mora no cabeçalho fixo.
 */
function EmptyState({ children }: { children: string }) {
  return <p className="text-xs/relaxed text-muted-foreground">{children}</p>
}

export function LeadVisibilityTabPanorama({
  controller,
}: {
  controller: VisibilityController
}) {
  const { snapshot } = controller
  if (!snapshot) {
    return (
      <StepCard title="Panorama">
        <EmptyState>
          Analise a visibilidade orgânica do domínio para ver o panorama.
        </EmptyState>
      </StepCard>
    )
  }

  const buckets = snapshot.metrics.positionBuckets
  const indexAge = snapshot.indexAge
  const { coverage } = snapshot

  return (
    <div className="flex flex-col gap-3">
      <StepCard title="Distribuição de posições">
        <StepSectionLabel
          aside={
            snapshot.metrics.keywordCount === null
              ? undefined
              : `${formatVisibilityMetric(snapshot.metrics.keywordCount)} no índice`
          }
        >
          Onde o domínio aparece
        </StepSectionLabel>
        {buckets ? (
          /*
            Barra empilhada, e a rampa sequencial `chart-*` é legítima aqui: as
            faixas são **ordenadas** de melhor para pior, e a legenda declara a
            ordem. Num eixo sem ordem natural ela mentiria.
          */
          <LeadWebsiteStackedBar
            items={[
              { label: "Top 3", count: buckets.top3 },
              { label: "4–10", count: buckets.pos4to10 },
              { label: "11–20", count: buckets.pos11to20 },
              { label: "21–50", count: buckets.pos21to50 },
              { label: "51–100", count: buckets.pos51to100 },
            ]}
            total={snapshot.metrics.keywordCount ?? undefined}
          />
        ) : (
          <EmptyState>
            Sem footprint medido nesta coleta — a amostra não substitui o total.
          </EmptyState>
        )}
      </StepCard>

      <StepCard title="Idade do índice">
        <StepSectionLabel aside="recente · envelhecendo · velho">
          De quando é a posição
        </StepSectionLabel>
        {indexAge ? (
          <>
            <LeadVisibilityIndexAgeGauge
              medianDays={indexAge.serpMedianDays}
              maxDays={indexAge.serpMaxDays}
            />
            <p className="mt-2.5 text-[11px]/relaxed text-muted-foreground">
              A coleta é de agora; o índice, não. É a diferença entre os dois
              que explica divergência contra outras ferramentas — cada uma
              reindexa num ciclo próprio.
            </p>
          </>
        ) : (
          <EmptyState>Esta coleta não registrou a data do índice.</EmptyState>
        )}
      </StepCard>

      <StepCard title="Cobertura da coleta">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StepCountCell
            value={formatVisibilityMetric(snapshot.metrics.keywordCount)}
            label="keywords no índice"
          />
          <StepCountCell
            value={formatVisibilityMetric(coverage.returned)}
            label={coverage.truncated ? "na amostra" : "coletadas"}
            dim={coverage.truncated}
          />
          <StepCountCell
            value={
              snapshot.costUsd === null
                ? "—"
                : `US$ ${snapshot.costUsd.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}`
            }
            label="custo da coleta"
          />
          <StepCountCell
            value={formatDate(snapshot.collectedAt)}
            label="coletado em"
          />
        </div>
        {coverage.truncated ? (
          <p className="mt-2.5 text-[11px]/relaxed text-muted-foreground">
            A amostra vem ordenada por tráfego, então as keywords de cauda podem
            não estar nela. As regras que procuram ausência ficam em silêncio
            enquanto isso for verdade.
          </p>
        ) : null}
      </StepCard>
    </div>
  )
}

export function LeadVisibilityTabKeywords({
  controller,
}: {
  controller: VisibilityController
}) {
  const { snapshot } = controller
  if (!snapshot) {
    return (
      <StepCard title="Keywords orgânicas">
        <EmptyState>Nenhuma coleta nesta etapa ainda.</EmptyState>
      </StepCard>
    )
  }
  return <LeadVisibilityKeywordsTable snapshot={snapshot} />
}

export function LeadVisibilityTabPages({
  controller,
}: {
  controller: VisibilityController
}) {
  const { snapshot } = controller
  if (!snapshot) {
    return (
      <StepCard title="Páginas e hosts">
        <EmptyState>Nenhuma coleta nesta etapa ainda.</EmptyState>
      </StepCard>
    )
  }

  const pages = visibilityPages(snapshot)
  const hosts = snapshot.hosts
  const canonicalShare = visibilityCanonicalTrafficShare(hosts)
  const intents = visibilityIntentBreakdown(snapshot)

  return (
    <div className="flex flex-col gap-3">
      {hosts.length > 0 ? (
        <StepCard title="Hosts">
          <StepSectionLabel
            aside={
              canonicalShare === null
                ? undefined
                : `${Math.round(canonicalShare * 100)}% no principal`
            }
          >
            Onde o tráfego cai
          </StepSectionLabel>
          <LeadVisibilityRankedList
            rows={hosts.map((host) => ({
              id: host.host,
              title: host.host,
              label: host.isCanonical ? (
                host.host
              ) : (
                /* Estado nunca só por cor: o rótulo acompanha o tom. */
                <span className="text-warning">
                  {host.host} · fora do host principal
                </span>
              ),
              value: host.traffic,
              note: `${formatVisibilityMetric(host.keywords)} kw`,
              tone: host.isCanonical ? "primary" : "warning",
            }))}
            formatValue={(value) =>
              `${formatVisibilityMetric(value, 1)} cl/mês`
            }
            emptyLabel="Nenhum host identificado nesta coleta."
          />
        </StepCard>
      ) : null}

      <StepCard title="Páginas ranqueadas">
        <StepSectionLabel
          aside={`${formatVisibilityMetric(pages.length)} no total`}
        >
          O que sustenta o domínio
        </StepSectionLabel>
        <LeadVisibilityRankedList
          rows={pages.slice(0, 12).map((page) => ({
            id: page.url.full ?? page.url.path,
            title: page.url.full ?? page.url.path,
            label:
              page.url.isCanonicalHost === false && page.url.host ? (
                <>
                  <span className="text-warning">{page.url.host}</span>
                  {page.url.path}
                </>
              ) : (
                page.url.path
              ),
            value: page.traffic,
            note: `${formatVisibilityMetric(page.keywords)} kw`,
            tone: page.url.isCanonicalHost === false ? "warning" : "primary",
          }))}
          formatValue={(value) => `${formatVisibilityMetric(value, 1)} cl/mês`}
          emptyLabel="Nenhuma página com URL identificada."
        />
      </StepCard>

      <StepCard title="Intenção de busca">
        <StepSectionLabel aside="estimativa do modelo, não medida">
          O que o visitante procura
        </StepSectionLabel>
        {/*
          Linha ranqueada, **não** barra empilhada: intenção é categórica sem
          ordem natural, e a única rampa deste sistema (`chart-*`) é sequencial
          — usá-la faria o leitor ver hierarquia onde não existe. Inventar quatro
          matizes violaria "cor só por token semântico".
        */}
        <LeadVisibilityRankedList
          rows={intents.map((row) => ({
            id: row.id,
            title: row.label,
            label: row.label,
            value: row.keywords,
            tone: row.id === "unclassified" ? "neutral" : "primary",
          }))}
          formatValue={(value) => `${formatVisibilityMetric(value)} kw`}
          emptyLabel="Nenhuma keyword nesta coleta."
        />
      </StepCard>
    </div>
  )
}

export function LeadVisibilityTabReview({
  controller,
  readingMode,
}: {
  controller: VisibilityController
  readingMode: boolean
}) {
  return (
    <LeadVisibilityReview controller={controller} readingMode={readingMode} />
  )
}
