"use client"

import { useState } from "react"
import {
  RiAlertLine,
  RiFocus3Line,
  RiInformationLine,
  RiLinksLine,
  RiLinkUnlinkM,
  RiRefreshLine,
  RiServerLine,
} from "react-icons/ri"
import {
  analyzeLeadBacklinks,
  type LeadBacklinkAudit,
} from "@/app/actions/leads"
import {
  StepCard,
  StepCountCell,
  StepMeter,
  StepSectionLabel,
  StepStat,
} from "@/components/custom/LeadStepShell"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { cn } from "cn"
import { formatRelativeShort } from "@/lib/date-time"
import {
  backlinkMetrics,
  competitorReferringDomainsMedian,
  BACKLINK_LINK_SPAM_SCORE,
  type BacklinkSnapshot,
} from "@/lib/leads/backlinks-audit"
import {
  backlinkProfileShape,
  formatLinksPerDomain,
} from "@/lib/leads/backlinks-presenters"
import { LeadWebsiteStackedBar } from "./LeadWebsiteStackedBar"

/**
 * Cada métrica declara se foi medida. Ausente é `—`, nunca zero: um domínio sem
 * coleta não é um domínio sem autoridade, e a tela não pode confundir os dois.
 */
function count(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("pt-BR")
}

/**
 * Linha de achado com barra proporcional. A lista era `domínio · N domínios` em
 * cinza: proporção lida em texto não é comparada, é decorada. A barra é o gancho
 * que faz o maior cluster saltar antes da leitura.
 */
function RankedRow({
  label,
  value,
  share,
  tone = "warning",
  title,
}: {
  label: string
  value: string
  share: number
  tone?: "warning" | "danger" | "neutral"
  title?: string
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="truncate text-[11px] text-muted-foreground"
          title={title ?? label}
        >
          {label}
        </span>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-foreground">
          {value}
        </span>
      </div>
      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-accent">
        <span
          className={cn(
            "block h-full rounded-full",
            // Fração diminuta ainda tem que ser vista; zero não inventa pixel.
            share > 0 && "min-w-1",
            tone === "danger"
              ? "bg-destructive"
              : tone === "neutral"
                ? "bg-muted-foreground/40"
                : "bg-warning",
          )}
          style={{ width: `${Math.max(0, Math.min(1, share)) * 100}%` }}
        />
      </span>
    </div>
  )
}

export function LeadWebsiteAuthorityProfile({
  leadId,
  audit,
  canEdit,
  onAuditChange,
  onPendingChange,
}: {
  leadId: string
  audit: LeadBacklinkAudit | null
  canEdit: boolean
  onAuditChange: (audit: LeadBacklinkAudit) => void
  onPendingChange: (pending: boolean) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const snapshot = audit?.snapshot ?? null
  const metrics = snapshot ? backlinkMetrics(snapshot) : null
  const shape = snapshot ? backlinkProfileShape(snapshot) : null

  function handleAnalyze() {
    if (busy) return
    setBusy(true)
    onPendingChange(true)
    setError(null)
    const formData = new FormData()
    formData.set("lead_id", leadId)
    void analyzeLeadBacklinks(formData).then((result) => {
      setBusy(false)
      onPendingChange(false)
      if (result.status === "error") {
        setError(result.message)
        return
      }
      onAuditChange(result.audit)
    })
  }

  return (
    <StepCard title="Perfil do domínio">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs/relaxed text-muted-foreground">
          <RiLinksLine size={14} aria-hidden />
          {audit
            ? `Coletado ${formatRelativeShort(audit.fetched_at)}`
            : "Ainda não medido"}
        </span>
        {canEdit ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={handleAnalyze}
          >
            {busy ? (
              <Spinner
                data-icon="inline-start"
                aria-hidden
                className="size-3.5"
              />
            ) : (
              <RiRefreshLine data-icon="inline-start" aria-hidden />
            )}
            {audit ? "Atualizar backlinks" : "Analisar backlinks"}
          </Button>
        ) : null}
      </div>

      {snapshot ? (
        <>
          {shape ? (
            <p className="mt-2.5 text-xs/relaxed text-foreground">{shape}</p>
          ) : null}
          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StepCountCell value={count(snapshot.rank)} label="Rank" />
            <StepCountCell
              value={count(snapshot.backlinks)}
              label="Backlinks"
            />
            <StepCountCell
              value={count(snapshot.referringDomains)}
              label="Domínios"
            />
            <StepCountCell
              value={
                formatLinksPerDomain(metrics?.linksPerDomain ?? null) ?? "—"
              }
              label="Links/domínio"
            />
          </div>
        </>
      ) : (
        <p className="mt-2.5 text-xs/relaxed text-muted-foreground">
          O resumo de backlinks ainda não foi coletado para este domínio.
        </p>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-xs/relaxed text-destructive">
          {error}
        </p>
      ) : null}
    </StepCard>
  )
}

export function LeadWebsiteAuthorityComposition({
  snapshot,
}: {
  snapshot: BacklinkSnapshot
}) {
  const metrics = backlinkMetrics(snapshot)
  const backlinks = snapshot.backlinks
  const dofollow =
    metrics.dofollowShare === null || backlinks === null
      ? null
      : Math.round(backlinks * metrics.dofollowShare)

  return (
    <StepCard title="Composição">
      <div className="flex flex-col gap-4">
        {dofollow !== null && backlinks !== null ? (
          <div>
            <StepSectionLabel aside="transferem autoridade">
              Dofollow
            </StepSectionLabel>
            <LeadWebsiteStackedBar
              items={[
                { label: "Dofollow", count: dofollow },
                { label: "Nofollow", count: backlinks - dofollow },
              ]}
              total={backlinks}
            />
          </div>
        ) : null}

        {/*
          As distribuições contam links, não domínios, e ficam ao lado de
          "Domínios" — sem dizer isso o leitor soma errado.
        */}
        {snapshot.topTlds.length > 0 ? (
          <div>
            <StepSectionLabel aside="conta links, não domínios">
              Por TLD
            </StepSectionLabel>
            <LeadWebsiteStackedBar
              items={snapshot.topTlds}
              total={backlinks ?? undefined}
            />
          </div>
        ) : null}

        {snapshot.topCountries.length > 0 ? (
          <div>
            <StepSectionLabel aside="conta links, não domínios">
              Por país
            </StepSectionLabel>
            <LeadWebsiteStackedBar
              items={snapshot.topCountries}
              total={backlinks ?? undefined}
            />
          </div>
        ) : null}

        {snapshot.linkLocations === null ? (
          <p className="text-[11px] text-muted-foreground">
            Origem dos links entra na próxima análise — esta coleta é anterior a
            esse campo.
          </p>
        ) : snapshot.linkLocations.length > 0 ? (
          <div>
            <StepSectionLabel aside="conta links, não domínios">
              Onde o link mora
            </StepSectionLabel>
            <LeadWebsiteStackedBar
              items={snapshot.linkLocations}
              total={backlinks ?? undefined}
            />
          </div>
        ) : null}
      </div>
    </StepCard>
  )
}

/** Faixa do provider: o mesmo número lido em três severidades. */
function spamTone(score: number | null): "neutral" | "warning" | "danger" {
  if (score === null) return "neutral"
  if (score >= 70) return "danger"
  if (score >= 30) return "warning"
  return "neutral"
}

const SPAM_CHIP = {
  neutral: "bg-accent text-muted-foreground",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
} as const

export function LeadWebsiteAuthorityRisk({
  snapshot,
}: {
  snapshot: BacklinkSnapshot
}) {
  const scheme = snapshot.scheme
  const hasRisk =
    (snapshot.spamScore !== null && snapshot.spamScore >= 30) ||
    (scheme !== null &&
      (scheme.spammyDomains > 0 ||
        scheme.anchorClusters.length > 0 ||
        scheme.ipClusters.length > 0))

  const anchorMax = Math.max(
    1,
    ...(scheme?.anchorClusters.map((item) => item.domains ?? 0) ?? [0]),
  )
  const sampledShare =
    scheme && scheme.sampled > 0 ? scheme.spammyDomains / scheme.sampled : 0

  return (
    <StepCard
      title="Risco"
      className={cn(hasRisk && "border-warning/25 bg-warning/[0.05]")}
    >
      <div className="grid grid-cols-2 gap-2">
        <StepStat
          icon={RiAlertLine}
          label="Spam score"
          value={
            snapshot.spamScore === null
              ? "—"
              : Math.round(snapshot.spamScore).toLocaleString("pt-BR")
          }
          unit={snapshot.spamScore === null ? "sem dado" : "do provider"}
          tone={
            snapshot.spamScore === null
              ? "neutral"
              : snapshot.spamScore >= 30
                ? "warning"
                : "success"
          }
        />
        <StepStat
          icon={RiLinkUnlinkM}
          label="Quebrados"
          value={count(snapshot.brokenBacklinks)}
          unit="backlinks em erro"
          tone={
            snapshot.brokenBacklinks && snapshot.brokenBacklinks > 0
              ? "warning"
              : "neutral"
          }
        />
      </div>

      {scheme ? (
        <div className="mt-3.5 flex flex-col gap-3.5 border-t border-border/70 pt-3.5">
          {/*
            Três sinais que a pontuação de domínio do resumo não enxerga: ela
            marcou 2 de 100 no perfil onde 52 dos 399 domínios amostrados vinham
            pontuados de 30 para cima.
          */}
          <div>
            <StepSectionLabel aside={`spam ${BACKLINK_LINK_SPAM_SCORE}+`}>
              Rede de links
            </StepSectionLabel>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                domínios pontuados na amostra
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                <span className="text-[15px] font-semibold text-warning">
                  {count(scheme.spammyDomains)}
                </span>{" "}
                de {count(scheme.sampled)}
              </span>
            </div>
            <StepMeter
              share={sampledShare}
              tone={sampledShare > 0 ? "warning" : "neutral"}
              className="mt-1.5"
              trackClassName="h-1"
            />
          </div>

          {scheme.anchorClusters.length > 0 ? (
            <div>
              <StepSectionLabel aside="domínios por âncora">
                Âncoras repetidas
              </StepSectionLabel>
              <div className="flex flex-col gap-2">
                {scheme.anchorClusters.map((cluster) => (
                  <RankedRow
                    key={cluster.anchor}
                    label={`“${cluster.anchor}”`}
                    value={count(cluster.domains)}
                    share={(cluster.domains ?? 0) / anchorMax}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {scheme.ipClusters.length > 0 ? (
            <div>
              <StepSectionLabel aside="domínios por IP">
                Mesmo endereço
              </StepSectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {scheme.ipClusters.map((item) => (
                  <span
                    key={item.ip}
                    className="inline-flex h-[22px] items-center gap-1.5 rounded-md bg-accent px-2 text-[11px] text-accent-foreground"
                  >
                    <RiServerLine
                      size={12}
                      aria-hidden
                      className="text-muted-foreground"
                    />
                    {item.ip}
                    <span className="font-semibold tabular-nums">
                      {count(item.domains)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {scheme.spammySamples.length > 0 ? (
            <div>
              <StepSectionLabel aside="abrir a página decide">
                Domínios pontuados
              </StepSectionLabel>
              <ul className="flex flex-col">
                {scheme.spammySamples.map((item) => {
                  const tone = spamTone(item.spamScore)
                  return (
                    <li
                      key={item.domain}
                      className="flex items-center justify-between gap-2 border-t border-border/70 py-1.5 first:border-t-0 first:pt-0"
                    >
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-[11px] text-muted-foreground underline-offset-2 transition-colors duration-150 hover:text-foreground hover:underline"
                        >
                          {item.domain}
                        </a>
                      ) : (
                        <span className="truncate text-[11px] text-muted-foreground">
                          {item.domain}
                        </span>
                      )}
                      <span
                        className={cn(
                          "inline-flex h-[18px] shrink-0 items-center rounded-md px-1.5 text-[10px] font-semibold tabular-nums",
                          SPAM_CHIP[tone],
                        )}
                      >
                        {count(item.spamScore)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          {/*
            Sem achado e sem truncamento, "nada aqui" é afirmação. Com
            truncamento, é só silêncio sobre o que ficou de fora — e a tela não
            pode dizer as duas coisas com a mesma frase.
          */}
          {scheme.spammyDomains === 0 &&
          scheme.anchorClusters.length === 0 &&
          scheme.ipClusters.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              {scheme.truncated
                ? "A amostra bateu no teto e não cobre o perfil inteiro; sobre o resto, nada foi verificado."
                : "Nenhum sinal de rede artificial na amostra."}
            </p>
          ) : scheme.truncated ? (
            <p className="text-[11px] text-muted-foreground">
              A amostra bateu no teto: os sinais acima valem para os{" "}
              {count(scheme.sampled)} domínios lidos, e o que ficou de fora não
              foi verificado.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 border-t border-border/70 pt-3 text-xs/relaxed text-muted-foreground">
          A leitura de rede de links entra na próxima análise — esta coleta é
          anterior a ela.
        </p>
      )}

      <p className="mt-3 flex items-start gap-1.5 border-t border-border/70 pt-2.5 text-[10px]/[1.45] text-muted-foreground">
        <RiInformationLine size={12} aria-hidden className="mt-px shrink-0" />
        A pontuação é do provider e diz “parece”, não “é”. Abrir a página é o que
        decide.
      </p>
    </StepCard>
  )
}

export function LeadWebsiteAuthorityMarket({
  snapshot,
}: {
  snapshot: BacklinkSnapshot
}) {
  const competitors = snapshot.competitors ?? []
  if (competitors.length === 0) return null

  // O provider nem sempre devolve `referringDomains` do concorrente. Quando não
  // devolve, a comparação passa a ser o que ele mede de fato — quantos domínios
  // de referência o concorrente divide com este site. Trocar o eixo é honesto;
  // desenhar barra vazia sobre `—` não é.
  const hasDomains = competitors.some((item) => item.referringDomains !== null)
  const axisOf = (value: (typeof competitors)[number]) =>
    hasDomains ? value.referringDomains : value.intersections
  const hasAxis = competitors.some((item) => axisOf(item) !== null)
  const own = snapshot.referringDomains
  const max = Math.max(
    1,
    hasDomains && own !== null ? own : 0,
    ...competitors.map((item) => axisOf(item) ?? 0),
  )
  const median = hasDomains
    ? competitorReferringDomainsMedian(competitors)
    : null

  return (
    <StepCard title="Mercado">
      <p className="text-xs/relaxed text-muted-foreground">
        Quem divide os mesmos domínios de referência.
      </p>

      {own !== null ? (
        <div className="mt-2.5 rounded-lg bg-primary/[0.05] px-2.5 py-2 ring-1 ring-primary/20">
          <div className="flex items-baseline justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary">
              <RiFocus3Line size={12} aria-hidden />
              Este site
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              <span className="text-[15px] font-semibold tabular-nums text-primary">
                {count(own)}
              </span>{" "}
              domínios
            </span>
          </div>
          {hasDomains ? (
            <StepMeter
              share={own / max}
              tone="primary"
              className="mt-1.5"
              trackClassName="h-1"
            />
          ) : null}
        </div>
      ) : null}

      {hasAxis ? (
        <div className="mt-3">
          <StepSectionLabel
            aside={hasDomains ? "domínios de referência" : "domínios em comum"}
          >
            Concorrentes
          </StepSectionLabel>
          <div className="flex flex-col gap-2">
            {competitors.map((competitor) => {
              const value = axisOf(competitor)
              return (
                <RankedRow
                  key={competitor.domain}
                  label={competitor.domain}
                  value={value === null ? "—" : value.toLocaleString("pt-BR")}
                  share={value === null ? 0 : value / max}
                  tone="neutral"
                />
              )
            })}
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <StepSectionLabel aside="sem números nesta coleta">
            Concorrentes
          </StepSectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {competitors.map((competitor) => (
              <span
                key={competitor.domain}
                className="inline-flex h-[22px] max-w-full items-center truncate rounded-md bg-accent px-2 text-[11px] text-accent-foreground"
              >
                {competitor.domain}
              </span>
            ))}
          </div>
        </div>
      )}

      {median !== null ? (
        <p className="mt-2.5 text-[11px] text-muted-foreground">
          Mediana do conjunto: {median.toLocaleString("pt-BR")} domínios.
        </p>
      ) : null}
    </StepCard>
  )
}
