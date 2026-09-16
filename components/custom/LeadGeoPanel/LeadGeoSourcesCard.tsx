"use client"

import { StepCard, StepSectionLabel } from "@/components/custom/LeadStepShell"
import { LeadVisibilityRankedList } from "@/components/custom/LeadVisibilityPanel/LeadVisibilityRankedList"
import { formatDate } from "@/lib/date-time"
import type { GeoSnapshot } from "@/lib/leads/geo-audit"
import {
  GEO_PROMPT_CONCENTRATION_MIN,
  promptConcentration,
} from "@/lib/leads/geo-mentions"
import { pct } from "./geo-format"

/**
 * Quem mais a IA cita nas mesmas respostas.
 *
 * **O universo vai na tela, junto do percentual.** "10,6% das citações nas 7
 * respostas em que este negócio aparece" é uma frase verdadeira; "10,6% de
 * participação de mercado" não é, e a diferença entre as duas é a única coisa
 * que separa este número de propaganda.
 */
export function LeadGeoMentionsCard({ snapshot }: { snapshot: GeoSnapshot }) {
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
      <StepSectionLabel aside="barra relativa ao mais citado">
        Citações por alvo
      </StepSectionLabel>
      {/* O lead é a ênfase e o resto é contexto: `primary` nele, `neutral` nos
          outros. Numa lista de seis nomes parecidos, procurar o dele é
          trabalho que a cor resolve antes da leitura. */}
      <LeadVisibilityRankedList
        rows={mentions.targets.map((target) => ({
          id: target.key,
          label: target.isLead ? (
            <span className="font-medium text-primary">
              {target.label} · este lead
            </span>
          ) : (
            target.label
          ),
          title: target.label,
          value: target.mentions,
          note: `de ${mentions.promptCount}`,
          tone: target.isLead ? "primary" : "neutral",
        }))}
        formatValue={(value) => value.toLocaleString("pt-BR")}
        emptyLabel="Nenhum alvo comparado."
      />
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
export function LeadGeoPromptsCard({ snapshot }: { snapshot: GeoSnapshot }) {
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

/** Citações na visão geral de IA do Google — a aba Citações, card 1. */
export function LeadGeoAiOverviewCard({ snapshot }: { snapshot: GeoSnapshot }) {
  const aiOverview = snapshot.aiOverview
  return (
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
  )
}

/** Fontes que a IA cita neste mercado — a aba Citações, card 2. */
export function LeadGeoSourcesList({ snapshot }: { snapshot: GeoSnapshot }) {
  const citations = snapshot.citations
  /* O título diz exatamente o que a lista é. `sources_domain` traz o que a IA
     cita **nas respostas em que o lead aparece** — não quem linka para o lead.
     As duas leituras levam a ações opostas. */
  return (
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
          <div className="mt-3">
            <StepSectionLabel aside="barra relativa à mais citada">
              Domínios citados
            </StepSectionLabel>
            <LeadVisibilityRankedList
              rows={citations.sources.map((source) => ({
                id: source.domain,
                label: source.isAuthority ? (
                  <>
                    {source.domain}
                    <span className="text-primary"> · fonte preferida</span>
                  </>
                ) : (
                  source.domain
                ),
                title: source.domain,
                value: source.mentions,
              }))}
              formatValue={(value) => value.toLocaleString("pt-BR")}
              emptyLabel="Nenhuma fonte listada."
            />
          </div>
          {citations.truncated ? (
            <p className="mt-3 text-xs/relaxed text-muted-foreground">
              A lista bateu no teto da coleta. Sobre o que ficou de fora, nada
              foi verificado.
            </p>
          ) : null}
        </>
      )}
    </StepCard>
  )
}
