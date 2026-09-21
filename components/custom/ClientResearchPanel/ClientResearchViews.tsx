"use client"

import {
  RiExternalLinkLine,
  RiGroupLine,
  RiPriceTag3Line,
  RiQuestionLine,
} from "react-icons/ri"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import {
  StepCard,
  StepMeter,
  StepSectionLabel,
  STEP_TONE_TEXT,
} from "@/components/custom/LeadStepShell"
import type { ClientResearchSnapshot } from "@/lib/research/types"
import {
  EMPTY_VALUE,
  VERDICT_LABEL,
  VERDICT_TONE,
  competitorOriginLabel,
  groupedClusters,
  platformCompetitors,
  referenceCompetitors,
  verdictShare,
} from "./presenters"

/**
 * As três leituras do mesmo snapshot.
 *
 * Moram no mesmo arquivo porque são a mesma peça vista de três ângulos — e
 * porque as três compartilham as regras de ausência e de tom. Separá-las em
 * três arquivos duplicaria os imports sem separar responsabilidade nenhuma.
 */

/* -------------------------------------------------------------------------- */
/*  Clusters                                                                  */
/* -------------------------------------------------------------------------- */

export function ClientResearchClusters({
  snapshot,
}: {
  snapshot: ClientResearchSnapshot
}) {
  const agrupados = groupedClusters(snapshot.clusters)
  const sozinhos = snapshot.clusters.length - agrupados.length

  if (snapshot.clusters.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RiPriceTag3Line aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Nenhum agrupamento saiu da coleta</EmptyTitle>
          <EmptyDescription>
            Nenhuma busca trouxe resultado orgânico suficiente para comparar.
            Confira se as palavras do briefing têm demanda na cidade escolhida.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <StepCard title="Temas encontrados">
        <StepSectionLabel aside="agrupadas pela busca que elas devolvem">
          {agrupados.length === 1 ? "1 tema" : `${agrupados.length} temas`}
        </StepSectionLabel>

        <ItemGroup>
          {agrupados.map((cluster) => (
            <Item key={cluster.id} variant="outline" size="sm">
              <ItemContent>
                <ItemTitle>{cluster.headKeyword}</ItemTitle>
                <ItemDescription>
                  {cluster.keywords.length} palavras ·{" "}
                  {cluster.sharedUrls.length} páginas em comum
                </ItemDescription>
                <ul className="mt-1.5 flex flex-wrap gap-1">
                  {cluster.keywords.slice(0, 8).map((keyword) => (
                    <li key={keyword}>
                      <Badge variant="muted">{keyword}</Badge>
                    </li>
                  ))}
                  {cluster.keywords.length > 8 ? (
                    <li>
                      <Badge variant="ghost">
                        +{cluster.keywords.length - 8}
                      </Badge>
                    </li>
                  ) : null}
                </ul>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>

        {sozinhos > 0 ? (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Outras {sozinhos} palavras não encontraram parentesco na busca e
            ficaram sozinhas. Cada uma pediria página própria.
          </p>
        ) : null}
      </StepCard>

      {snapshot.peopleAlsoAsk.length > 0 ? (
        <StepCard title="Perguntas que a busca mostra">
          <StepSectionLabel aside="vieram junto com os resultados">
            {snapshot.peopleAlsoAsk.length} perguntas
          </StepSectionLabel>
          <ul className="flex flex-col gap-1.5">
            {snapshot.peopleAlsoAsk.map((pergunta) => (
              <li
                key={pergunta}
                className="flex items-start gap-1.5 text-xs text-foreground"
              >
                <RiQuestionLine
                  aria-hidden
                  className="mt-0.5 shrink-0 text-muted-foreground"
                />
                <span>{pergunta}</span>
              </li>
            ))}
          </ul>
        </StepCard>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Concorrentes                                                              */
/* -------------------------------------------------------------------------- */

export function ClientResearchCompetitors({
  snapshot,
}: {
  snapshot: ClientResearchSnapshot
}) {
  const referencia = referenceCompetitors(snapshot.competitors)
  const plataformas = platformCompetitors(snapshot.competitors)

  if (snapshot.competitors.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RiGroupLine aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Nenhum concorrente saiu da coleta</EmptyTitle>
          <EmptyDescription>
            As buscas não devolveram resultado orgânico. Sem top 10 não há de
            onde tirar quem disputa a página.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <StepCard title="Quem disputa as palavras-alvo">
        <StepSectionLabel aside="ocupam o top 10 das buscas do cliente">
          {referencia.length === 0
            ? "nenhum concorrente direto"
            : `${referencia.length} de referência`}
        </StepSectionLabel>

        {referencia.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Todo o top 10 das palavras-alvo é ocupado por plataforma ou pelo
            próprio site. Não há concorrente direto para comparar.
          </p>
        ) : (
          <ItemGroup>
            {referencia.map((competitor) => (
              <Item key={competitor.domain} variant="outline" size="sm">
                <ItemContent>
                  <ItemTitle className="flex items-center gap-1.5">
                    {competitor.domain}
                    <a
                      href={`https://${competitor.domain}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={`Abrir ${competitor.domain} em nova aba`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <RiExternalLinkLine aria-hidden size={13} />
                    </a>
                  </ItemTitle>
                  <ItemDescription>
                    {competitor.serpAppearances === null
                      ? competitorOriginLabel(competitor)
                      : `aparece em ${competitor.serpAppearances} das palavras-alvo`}
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        )}
      </StepCard>

      {plataformas.length > 0 ? (
        <StepCard title="Também ocupam a busca">
          <StepSectionLabel aside="fora da comparação, dentro do relatório">
            {plataformas.length} domínios
          </StepSectionLabel>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Rede social, diretório e o próprio site não são concorrentes — mas
            ocupam posição que o cliente poderia ocupar.
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {plataformas.map((competitor) => (
              <li key={competitor.domain}>
                <Badge variant={competitor.isSelf ? "primary" : "muted"}>
                  {competitor.domain}
                  {competitor.isSelf ? " · o próprio site" : ""}
                </Badge>
              </li>
            ))}
          </ul>
        </StepCard>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Vereditos                                                                 */
/* -------------------------------------------------------------------------- */

export function ClientResearchVerdicts({
  snapshot,
}: {
  snapshot: ClientResearchSnapshot
}) {
  const { share, count } = verdictShare(snapshot.verdicts)

  if (snapshot.verdicts.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RiPriceTag3Line aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Nenhuma palavra do briefing foi julgada</EmptyTitle>
          <EmptyDescription>
            O veredito sai das palavras que o cliente escolheu. Confira se o
            briefing tem palavras-chave preenchidas.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <StepCard title="As palavras do briefing">
      <StepSectionLabel aside="a pesquisa recomenda, quem decide é você">
        {count ? `${count.value} ${count.noun}` : EMPTY_VALUE}
      </StepSectionLabel>

      {/* Fração onde cheio é bom: todas as palavras escolhidas seguem de pé. */}
      {share === null ? null : (
        <StepMeter
          share={share}
          tone={share >= 0.6 ? "success" : "warning"}
          className="mb-3"
        />
      )}

      <ItemGroup>
        {snapshot.verdicts.map((verdict) => (
          <Item key={verdict.keyword} variant="outline" size="sm">
            <ItemContent>
              <ItemTitle className="flex flex-wrap items-center gap-1.5">
                {verdict.keyword}
                <span
                  className={`text-[11px] font-semibold ${STEP_TONE_TEXT[VERDICT_TONE[verdict.label]]}`}
                >
                  {VERDICT_LABEL[verdict.label]}
                </span>
              </ItemTitle>
              <ItemDescription>{verdict.reason}</ItemDescription>
              {verdict.alternatives.length > 0 ? (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  No lugar dela, do mesmo tema:{" "}
                  <span className="text-foreground">
                    {verdict.alternatives.join(", ")}
                  </span>
                </p>
              ) : null}
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
    </StepCard>
  )
}
