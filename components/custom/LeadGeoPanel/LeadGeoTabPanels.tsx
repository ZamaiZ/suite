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
  type GeoSnapshot,
} from "@/lib/leads/geo-audit"
import {
  GEO_PROMPT_CONCENTRATION_MIN,
  promptConcentration,
} from "@/lib/leads/geo-mentions"
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

      <GeoDemandCard snapshot={snapshot} />

      <LeadGeoReview controller={controller} readingMode={readingMode} />
    </div>
  )
}

/**
 * Demanda de busca em IA, por keyword.
 *
 * **Nunca apresentada como fração do volume orgânico.** Medido em 2026-09-11:
 * `sanitarios` tem 12.559 buscas em IA contra 5.400 no Google, e
 * `banheiro químicos` tem 234 contra 18.100. Não há razão constante entre os
 * dois, e um percentual inventaria uma relação que não existe.
 */
function GeoDemandCard({ snapshot }: { snapshot: GeoSnapshot }) {
  const demand = snapshot.aiDemand
  return (
    <StepCard title="Demanda de busca em IA">
      {demand === null ? (
        /* Duas causas diferentes para o mesmo `null`, e a ação que resolve cada
           uma é outra. Mandar recoletar a Visibilidade quando ela já existe faz
           o analista pagar de novo por uma coleta que não era o problema. */
        <p className="text-xs/relaxed text-muted-foreground">
          {snapshot.sources.visibilityAuditAt === null
            ? "Não coletado. A demanda em IA lê as keywords da Visibilidade — rode aquela etapa antes."
            : "Não coletado nesta análise. Rode a análise de Presença em IA de novo para preencher."}
        </p>
      ) : demand.keywords.length === 0 ? (
        <p className="text-xs/relaxed text-muted-foreground">
          Nenhuma keyword para medir.
        </p>
      ) : (
        <>
          <p className="text-xs/relaxed text-muted-foreground">
            {demand.totalAiSearchVolume === null
              ? "—"
              : `${demand.totalAiSearchVolume.toLocaleString("pt-BR")} buscas/mês em IA`}{" "}
            · {demand.locationLabel}
          </p>
          <ul className="mt-3 flex flex-col">
            {demand.keywords.slice(0, 12).map((row) => (
              <li
                key={row.keyword}
                className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-b-0 last:pb-0"
              >
                <span className="min-w-0 flex-1 truncate text-xs/relaxed text-foreground">
                  {row.keyword}
                </span>
                {/* `0` é medida, não ausência: 49 das 110 keywords vieram zero
                    e nenhuma veio nula. "—" aqui mentiria sobre a coleta. */}
                <span className="shrink-0 text-xs/relaxed text-muted-foreground tabular-nums">
                  {row.aiSearchVolume === null
                    ? "—"
                    : row.aiSearchVolume === 0
                      ? "sem busca em IA"
                      : `${row.aiSearchVolume.toLocaleString("pt-BR")}/mês`}
                </span>
              </li>
            ))}
          </ul>
          {demand.keywords.length > 12 ? (
            <p className="mt-3 text-xs/relaxed text-muted-foreground">
              e mais {demand.keywords.length - 12} keyword(s).
            </p>
          ) : null}
        </>
      )}
    </StepCard>
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
          <>
            <ul className="flex flex-col">
              {aiOverview.keywords.map((row) => (
                <li
                  key={`${row.keyword}-${row.url ?? ""}`}
                  className="flex flex-col gap-1.5 border-b border-border/60 py-2 first:pt-0 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-xs/relaxed text-foreground">
                      {row.keyword}
                    </span>
                    {/* `rank_group`, e o rótulo diz qual posição é. Sem o "fonte"
                        o leitor lê como posição na busca, que é outro número. */}
                    <span className="shrink-0 text-xs/relaxed text-muted-foreground tabular-nums">
                      {row.position === null ? "—" : `${row.position}ª fonte`}
                    </span>
                    <span className="shrink-0 text-xs/relaxed text-muted-foreground tabular-nums">
                      {row.volume === null ? "—" : `${row.volume}/mês`}
                    </span>
                  </div>
                  {row.citedText ? (
                    <p className="line-clamp-2 border-l-2 border-border pl-2 text-xs/relaxed text-muted-foreground">
                      {row.citedText}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
            {/* Terceiro estado vazio: o campo não existia na versão da coleta.
                Dizer "a IA citou sem texto" afirmaria sobre o mundo; isto diz
                que o provedor não trouxe. */}
            {aiOverview.keywords.every((row) => row.citedText === null) ? (
              <p className="mt-3 text-xs/relaxed text-muted-foreground">
                O trecho citado entra na próxima análise de Visibilidade — esta
                coleta é anterior a esse campo.
              </p>
            ) : null}
          </>
        )}
      </StepCard>

      {/* O título diz exatamente o que a lista é. `sources_domain` traz o que
          a IA cita **nas respostas em que o lead aparece** — não quem linka
          para o lead. As duas leituras levam a ações opostas. */}
      <StepCard title="Fontes que a IA cita neste mercado">
        {citations === null ? (
          /* `null` é "não coletado". Dizer "nenhuma citação" aqui afirmaria
             ausência que ninguém mediu — o erro que a etapa inteira evita. */
          <p className="text-xs/relaxed text-muted-foreground">
            Não coletado. Rode a coleta de menções em IA para ver o que a IA lê
            quando fala deste mercado.
          </p>
        ) : citations.mentions === 0 ? (
          <p className="text-xs/relaxed text-muted-foreground">
            A IA não cita este negócio em nenhuma resposta deste mercado.
          </p>
        ) : (
          <>
            <p className="text-xs/relaxed text-muted-foreground">
              {citations.mentions} resposta(s) de IA citam este negócio.{" "}
              {citations.domainCitedAsSource
                ? "O site aparece entre as fontes."
                : "O site não aparece entre as fontes — a IA fala do mercado sem lê-lo."}
            </p>
            <ul className="mt-3 flex flex-col">
              {citations.sources.map((source) => (
                <li
                  key={source.domain}
                  className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-b-0 last:pb-0"
                >
                  <span className="min-w-0 flex-1 truncate text-xs/relaxed text-foreground">
                    {source.domain}
                  </span>
                  {source.isAuthority ? (
                    <span className="shrink-0 text-xs/relaxed text-primary">
                      fonte que a IA prefere
                    </span>
                  ) : null}
                  <span className="shrink-0 text-xs/relaxed text-muted-foreground tabular-nums">
                    {source.mentions}
                  </span>
                </li>
              ))}
            </ul>
            {citations.truncated ? (
              <p className="mt-3 text-xs/relaxed text-muted-foreground">
                A lista bateu no teto da coleta. Sobre o que ficou de fora, nada
                foi verificado.
              </p>
            ) : null}
          </>
        )}
      </StepCard>

      <GeoMentionsCard snapshot={snapshot} />
      <GeoPromptsCard snapshot={snapshot} />
    </div>
  )
}

/**
 * Quem mais a IA cita nas mesmas respostas.
 *
 * **O universo vai na tela, junto do percentual.** "10,6% das citações nas 7
 * respostas em que este negócio aparece" é uma frase verdadeira; "10,6% de
 * participação de mercado" não é, e a diferença entre as duas é a única coisa
 * que separa este número de propaganda.
 */
function GeoMentionsCard({ snapshot }: { snapshot: GeoSnapshot }) {
  const mentions = snapshot.aiMentions
  const citations = snapshot.citations
  if (mentions === null) {
    return (
      <StepCard title="Quem a IA cita junto">
        <p className="text-xs/relaxed text-muted-foreground">
          {citations === null
            ? "Não coletado. Entra junto com as menções em IA."
            : "Sem menções para comparar: a IA não cita este negócio em nenhuma resposta deste mercado."}
        </p>
      </StepCard>
    )
  }

  const concentracao = citations ? promptConcentration(citations) : null

  return (
    <StepCard title="Quem a IA cita junto">
      <ul className="flex flex-col">
        {mentions.targets.map((target) => (
          <li
            key={target.key}
            className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 first:pt-0 last:border-b-0 last:pb-0"
          >
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-xs/relaxed",
                target.isLead ? "font-medium text-primary" : "text-foreground",
              )}
            >
              {target.label}
              {target.isLead ? " · este lead" : ""}
            </span>
            <span className="shrink-0 text-xs/relaxed text-muted-foreground tabular-nums">
              {target.mentions} de {mentions.promptCount}
            </span>
          </li>
        ))}
      </ul>
      {mentions.share !== null ? (
        <p className="mt-3 text-xs/relaxed text-muted-foreground">
          {pct(mentions.share)} de todas as citações nas {mentions.promptCount}{" "}
          respostas medidas. Não é participação de mercado.
        </p>
      ) : null}
      {/* A amostra vem do que o domínio ranqueia, não de perguntas escolhidas.
          Uma pergunta genérica pode arrastar a lista inteira, e o analista
          precisa ver isso antes de levar o número para a reunião. */}
      {concentracao && concentracao.share >= GEO_PROMPT_CONCENTRATION_MIN ? (
        <p className="mt-2 text-xs/relaxed text-muted-foreground">
          {pct(concentracao.share)} das fontes vêm de uma pergunta só — “
          {concentracao.question}”. Ela pode estar puxando nomes de fora deste
          mercado.
        </p>
      ) : null}
    </StepCard>
  )
}

/**
 * O detalhe por pergunta — a segunda chamada, condicional.
 *
 * `null` é "não pedido", e é o estado normal de um lead sem menção: a chamada
 * custa os mesmos US$ 0,10 mesmo devolvendo zero linha.
 */
function GeoPromptsCard({ snapshot }: { snapshot: GeoSnapshot }) {
  const prompts = snapshot.citations?.prompts ?? null
  if (prompts === null) return null
  return (
    <StepCard title="Perguntas em que a IA cita este mercado">
      {prompts.length === 0 ? (
        <p className="text-xs/relaxed text-muted-foreground">
          A coleta respondeu e não trouxe nenhuma pergunta.
        </p>
      ) : (
        <ul className="flex flex-col">
          {prompts.slice(0, 10).map((prompt) => (
            <li
              key={prompt.question}
              className="flex flex-col gap-1 border-b border-border/60 py-2 first:pt-0 last:border-b-0 last:pb-0"
            >
              <p className="text-xs/relaxed text-foreground">
                {prompt.question}
              </p>
              <p className="text-xs/relaxed text-muted-foreground">
                {prompt.sources.length} fonte(s)
                {prompt.leadCited ? " · este site entre elas" : ""}
                {prompt.at ? ` · ${formatDate(prompt.at)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </StepCard>
  )
}

const PROVIDER_LABELS: Record<string, string> = {
  chat_gpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  perplexity: "Perplexity",
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function LeadGeoTabProbe({ controller }: { controller: GeoController }) {
  const probe = controller.snapshot?.promptVisibility ?? null

  if (probe === null) {
    return (
      <StepCard title="Sondagem em LLM">
        <p className="text-xs/relaxed text-muted-foreground">
          Não sondado. A sondagem pergunta a ChatGPT, Claude, Gemini e
          Perplexity o que este mercado pergunta, e mede se a marca aparece.
          São {controller.probeRuns} respostas, e é a coleta mais cara desta
          etapa — por isso tem botão próprio.
        </p>
      </StepCard>
    )
  }

  const executadas = probe.runs.filter((run) => run.status === "ok")
  const naoExecutadas = probe.runs.filter((run) => run.status !== "ok")

  return (
    <div className="grid min-h-0 gap-3.5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-3.5">
        <StepCard title="A marca nas respostas de IA">
          <div className="grid grid-cols-3 gap-2">
            <StepCountCell
              value={pct(probe.metrics.mentionRate)}
              label="das respostas citam"
            />
            <StepCountCell
              value={
                probe.metrics.averagePosition === null
                  ? "—"
                  : probe.metrics.averagePosition.toFixed(1)
              }
              label="ordem média"
              dim={probe.metrics.averagePosition === null}
            />
            <StepCountCell
              value={String(executadas.length)}
              label="respostas lidas"
            />
          </div>
          {/* Duas ressalvas que o número não carrega sozinho, e sem as quais
              ele é lido como precisão que não tem. */}
          <p className="mt-3 text-xs/relaxed text-muted-foreground">
            Indicação direcional: a mesma pergunta no mesmo modelo devolve
            respostas diferentes entre execuções.
          </p>
          <p className="mt-1 text-xs/relaxed text-muted-foreground">
            A ordem é a posição da marca entre as marcas citadas no texto — não
            é posição em lista numerada.
          </p>
        </StepCard>

        <StepCard title="Por plataforma">
          <ul className="flex flex-col">
            {probe.metrics.byProvider.map((row) => (
              <li
                key={row.provider}
                className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 first:pt-0 last:border-b-0 last:pb-0"
              >
                <span className="min-w-0 flex-1 truncate text-xs/relaxed text-foreground">
                  {PROVIDER_LABELS[row.provider] ?? row.provider}
                  {/* O Gemini recusa os dois campos de localização da API: ele
                      mede sem recorte geográfico. Comparar a coluna dele com as
                      outras sem dizer isso compara coisas diferentes. */}
                  {row.provider === "gemini" ? (
                    <span className="text-muted-foreground"> · sem recorte de cidade</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs/relaxed text-muted-foreground tabular-nums">
                  {pct(row.mentionRate)}
                </span>
                <span className="shrink-0 text-xs/relaxed text-muted-foreground tabular-nums">
                  {row.averagePosition === null
                    ? "—"
                    : row.averagePosition.toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
        </StepCard>

        {naoExecutadas.length > 0 ? (
          <StepCard title="Não executadas">
            {/* Execução que o provedor recusou não é "não mencionou": ela fica
                fora do denominador e aparece aqui com o motivo. Contá-la como
                ausência inventaria um resultado — e de graça, porque esses
                erros não cobram. */}
            <p className="text-xs/relaxed text-muted-foreground">
              {naoExecutadas.length} de {probe.runs.length} não rodaram e ficam
              fora da conta.
            </p>
            <ul className="mt-3 flex flex-col">
              {naoExecutadas.slice(0, 8).map((run) => (
                <li
                  key={`${run.promptId}-${run.provider}`}
                  className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-b-0 last:pb-0"
                >
                  <span className="min-w-0 flex-1 truncate text-xs/relaxed text-foreground">
                    {PROVIDER_LABELS[run.provider] ?? run.provider}
                  </span>
                  <span className="shrink-0 text-xs/relaxed text-muted-foreground">
                    {run.statusMessage ?? "não respondeu"}
                  </span>
                </li>
              ))}
            </ul>
          </StepCard>
        ) : null}
      </div>

      <StepCard title="Marcas citadas junto">
        {probe.metrics.competitors.length === 0 ? (
          <p className="text-xs/relaxed text-muted-foreground">
            Nenhuma marca conhecida foi detectada nas respostas.
          </p>
        ) : (
          <ul className="flex flex-col">
            {probe.metrics.competitors.slice(0, 14).map((row) => (
              <li
                key={row.name}
                className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 first:pt-0 last:border-b-0 last:pb-0"
              >
                <span className="min-w-0 flex-1 truncate text-xs/relaxed text-foreground">
                  {row.name}
                </span>
                <span className="shrink-0 text-xs/relaxed text-muted-foreground tabular-nums">
                  {pct(row.mentionRate)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {/* A lista de casamento é o nome do lead mais os concorrentes da malha
            do Google. Quem está fora dela não foi detectado — e silêncio sobre
            o que ficou de fora não é afirmação de que não há nada lá. */}
        <p className="mt-3 text-xs/relaxed text-muted-foreground">
          {probe.metrics.dominance === null
            ? "Nenhum concorrente estava na lista de marcas conhecidas, então a participação da marca não foi medida — só o que aparece acima foi detectado."
            : `${pct(probe.metrics.dominance)} das menções detectadas são da marca do lead. Quem está fora da lista de marcas conhecidas não foi medido.`}
        </p>
      </StepCard>
    </div>
  )
}
