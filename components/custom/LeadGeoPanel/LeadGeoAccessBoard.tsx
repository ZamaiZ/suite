"use client"

import { RiCheckLine, RiCloseLine, RiSubtractLine } from "react-icons/ri"
import { StepCard, StepCountCell } from "@/components/custom/LeadStepShell"
import { cn } from "cn"
import { LeadGeoCrawlerStrip } from "./LeadGeoCrawlerStrip"
import type { GeoSnapshot } from "@/lib/leads/geo-audit"

/**
 * Três estados, e o terceiro é o que a etapa inteira existe para preservar:
 * `unknown` é "não medimos", e é diferente de "medimos e está ruim". Pintar os
 * dois de vermelho faria o analista cobrar do lead um arquivo que ninguém
 * chegou a buscar.
 */
export type CheckState = "ok" | "bad" | "unknown"

export function CheckRow({
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

/** Os dois cards da aba Acesso. */
export function LeadGeoAccessBoard({ snapshot }: { snapshot: GeoSnapshot }) {
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

        {/* Substituiu a nuvem de `Badge` que listava só os bloqueados. Aquela
            forma tinha um estado só: liberado e não declarado sumiam no mesmo
            silêncio, e não dava para ver de qual plataforma era o robô. */}
        <div className="mt-3">
          <LeadGeoCrawlerStrip access={access} extended={extended} />
        </div>
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
