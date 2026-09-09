"use client"

import { useState } from "react"
import { RiLinksLine, RiRefreshLine } from "react-icons/ri"
import {
  analyzeLeadBacklinks,
  type LeadBacklinkAudit,
} from "@/app/actions/leads"
import { LeadGbpCard } from "@/components/custom/LeadGbpPanel/LeadGbpCard"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { formatRelativeShort } from "@/lib/date-time"
import {
  backlinkMetrics,
  BACKLINK_LINK_SPAM_SCORE,
} from "@/lib/leads/backlinks-audit"
import {
  backlinkProfileShape,
  formatBacklinkDistribution,
  formatBacklinkShare,
  formatLinksPerDomain,
} from "@/lib/leads/backlinks-presenters"

function count(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("pt-BR")
}

/**
 * Cada métrica declara se foi medida. Ausente é `—`, nunca zero: um domínio sem
 * coleta não é um domínio sem autoridade, e a tela não pode confundir os dois.
 */
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs/relaxed text-muted-foreground">{label}</p>
      <p className="text-xs/relaxed font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  )
}

export function LeadWebsiteBacklinksCard({
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
  const metrics = snapshot
    ? backlinkMetrics(snapshot)
    : {
        linksPerDomain: null,
        dofollowShare: null,
        subdomainSpread: null,
        topTldShare: null,
        topCountryShare: null,
      }
  const shape = snapshot ? backlinkProfileShape(snapshot) : null
  const tldLine = snapshot ? formatBacklinkDistribution(snapshot.topTlds) : null
  const countryLine = snapshot
    ? formatBacklinkDistribution(snapshot.topCountries)
    : null
  const locationLine = snapshot?.linkLocations
    ? formatBacklinkDistribution(snapshot.linkLocations)
    : null

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
    <LeadGbpCard title="Autoridade externa">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs/relaxed text-muted-foreground">
            <RiLinksLine
              size={14}
              aria-hidden
              className="text-muted-foreground"
            />
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
              <p className="text-xs/relaxed text-foreground">{shape}</p>
            ) : null}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric label="Rank" value={count(snapshot.rank)} />
              <Metric label="Backlinks" value={count(snapshot.backlinks)} />
              <Metric
                label="Domínios"
                value={count(snapshot.referringDomains)}
              />
              <Metric
                label="Links por domínio"
                value={formatLinksPerDomain(metrics.linksPerDomain) ?? "—"}
              />
              <Metric
                label="Dofollow"
                value={formatBacklinkShare(metrics.dofollowShare) ?? "—"}
              />
              <Metric
                label="Quebrados"
                value={count(snapshot.brokenBacklinks)}
              />
              <Metric
                label="Spam score"
                value={
                  snapshot.spamScore === null
                    ? "—"
                    : count(Math.round(snapshot.spamScore))
                }
              />
              {/* `—` aqui significa não coletado, não zero. */}
              <Metric
                label="Sub-redes"
                value={count(snapshot.referringSubnets)}
              />
            </div>
            {/*
              As distribuições contam links, não domínios, e ficam ao lado de
              "Domínios" — sem dizer isso o leitor soma errado.
            */}
            {tldLine ? (
              <p className="text-xs/relaxed text-muted-foreground">
                Links por TLD: {tldLine}
              </p>
            ) : null}
            {countryLine ? (
              <p className="text-xs/relaxed text-muted-foreground">
                Links por país: {countryLine}
              </p>
            ) : null}
            {locationLine ? (
              <p className="text-xs/relaxed text-muted-foreground">
                Onde o link mora: {locationLine}
              </p>
            ) : null}
            {snapshot.competitors && snapshot.competitors.length > 0 ? (
              <div className="flex flex-col gap-1">
                <p className="text-xs/relaxed text-foreground">
                  Quem divide os mesmos domínios de referência
                </p>
                <ul className="flex flex-col gap-0.5">
                  {snapshot.competitors.map((competitor) => (
                    <li
                      key={competitor.domain}
                      className="flex items-baseline justify-between gap-2 text-xs/relaxed text-muted-foreground"
                    >
                      <span className="truncate">{competitor.domain}</span>
                      <span className="shrink-0 tabular-nums">
                        {count(competitor.referringDomains)} domínios ·{" "}
                        {count(competitor.backlinks)} links
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {snapshot.scheme ? (
              <div className="flex flex-col gap-1">
                {/*
                  Três sinais que a pontuação de domínio do resumo não enxerga:
                  ela marcou 2 de 100 no perfil onde 52 dos 399 domínios
                  amostrados vinham pontuados de 30 para cima.
                */}
                <p className="text-xs/relaxed text-foreground">
                  Rede de links · {count(snapshot.scheme.spammyDomains)} de{" "}
                  {count(snapshot.scheme.sampled)} domínios amostrados com
                  pontuação de spam {BACKLINK_LINK_SPAM_SCORE} ou mais
                </p>
                {snapshot.scheme.anchorClusters.length > 0 ? (
                  <ul className="flex flex-col gap-0.5">
                    {snapshot.scheme.anchorClusters.map((cluster) => (
                      <li
                        key={cluster.anchor}
                        className="flex items-baseline justify-between gap-2 text-xs/relaxed text-muted-foreground"
                      >
                        <span className="truncate">“{cluster.anchor}”</span>
                        <span className="shrink-0 tabular-nums">
                          {count(cluster.domains)} domínios
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {snapshot.scheme.ipClusters.length > 0 ? (
                  <p className="text-xs/relaxed text-muted-foreground">
                    Domínios no mesmo IP:{" "}
                    {snapshot.scheme.ipClusters
                      .map((item) => `${item.ip} (${count(item.domains)})`)
                      .join(" · ")}
                  </p>
                ) : null}
                {snapshot.scheme.spammySamples.length > 0 ? (
                  <ul className="flex flex-col gap-0.5">
                    {snapshot.scheme.spammySamples.map((item) => (
                      <li
                        key={item.domain}
                        className="flex items-baseline justify-between gap-2 text-xs/relaxed"
                      >
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-muted-foreground hover:underline"
                          >
                            {item.domain}
                          </a>
                        ) : (
                          <span className="truncate text-muted-foreground">
                            {item.domain}
                          </span>
                        )}
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          spam {count(item.spamScore)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {/*
                  Sem achado e sem truncamento, "nada aqui" é afirmação. Com
                  truncamento, é só silêncio sobre o que ficou de fora — e a
                  tela não pode dizer as duas coisas com a mesma frase.
                */}
                {snapshot.scheme.spammyDomains === 0 &&
                snapshot.scheme.anchorClusters.length === 0 &&
                snapshot.scheme.ipClusters.length === 0 ? (
                  <p className="text-xs/relaxed text-muted-foreground">
                    {snapshot.scheme.truncated
                      ? "A amostra bateu no teto e não cobre o perfil inteiro; sobre o resto, nada foi verificado."
                      : "Nenhum sinal de rede artificial na amostra."}
                  </p>
                ) : snapshot.scheme.truncated ? (
                  <p className="text-xs/relaxed text-muted-foreground">
                    A amostra bateu no teto: os sinais acima valem para os{" "}
                    {count(snapshot.scheme.sampled)} domínios lidos, e o que
                    ficou de fora não foi verificado.
                  </p>
                ) : null}
                <p className="text-xs/relaxed text-muted-foreground">
                  A pontuação é do provider e diz “parece”, não “é”. Abrir a
                  página é o que decide.
                </p>
              </div>
            ) : null}
            {snapshot.linkLocations === null || snapshot.scheme === null ? (
              <p className="text-xs/relaxed text-muted-foreground">
                {snapshot.linkLocations === null
                  ? "Origem e rede dos links entram na próxima análise — esta coleta é anterior a esses campos."
                  : "A leitura de rede de links entra na próxima análise — esta coleta é anterior a ela."}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-xs/relaxed text-muted-foreground">
            O resumo de backlinks ainda não foi coletado para este domínio.
          </p>
        )}

        {error ? (
          <p className="text-xs/relaxed text-destructive">{error}</p>
        ) : null}
      </div>
    </LeadGbpCard>
  )
}
