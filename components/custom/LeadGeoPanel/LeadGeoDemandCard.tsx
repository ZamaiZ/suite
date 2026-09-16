"use client"

import { StepCard, StepSectionLabel } from "@/components/custom/LeadStepShell"
import { LeadVisibilityRankedList } from "@/components/custom/LeadVisibilityPanel/LeadVisibilityRankedList"
import type { GeoSnapshot } from "@/lib/leads/geo-audit"

/**
 * Demanda de busca em IA, por keyword.
 *
 * **Nunca apresentada como fração do volume orgânico.** Medido em 2026-09-11:
 * `sanitarios` tem 12.559 buscas em IA contra 5.400 no Google, e
 * `banheiro químicos` tem 234 contra 18.100. Não há razão constante entre os
 * dois, e um percentual inventaria uma relação que não existe.
 */
export function LeadGeoDemandCard({ snapshot }: { snapshot: GeoSnapshot }) {
  const demand = snapshot.aiDemand
  // `null` é "não medida" e sai da comparação; `0` é medida e fica.
  const medidas =
    demand?.keywords.filter((row) => row.aiSearchVolume !== null) ?? []
  const naoMedidas = (demand?.keywords.length ?? 0) - medidas.length
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
          <div className="mt-3">
            <StepSectionLabel aside="barra relativa à maior">
              Por keyword
            </StepSectionLabel>
            {/* `0` é medida, não ausência: 49 das 110 keywords vieram zero e
                nenhuma veio nula. A barra fica vazia e a linha diz "sem busca
                em IA" — esconder a linha mentiria sobre o que foi medido. */}
            <LeadVisibilityRankedList
              rows={medidas.slice(0, 12).map((row) => ({
                id: row.keyword,
                label: row.keyword,
                title: row.keyword,
                value: row.aiSearchVolume ?? 0,
              }))}
              formatValue={(value) =>
                value === 0
                  ? "sem busca em IA"
                  : `${value.toLocaleString("pt-BR")}/mês`
              }
              emptyLabel="Nenhuma keyword medida."
            />
          </div>
          {medidas.length > 12 ? (
            <p className="mt-3 text-xs/relaxed text-muted-foreground">
              e mais {medidas.length - 12} keyword(s).
            </p>
          ) : null}
          {/* Fora da lista, e não com barra vazia: sem valor não há escala
              contra a qual medir, e trilha sem escala mente pior que trilha
              ausente. */}
          {naoMedidas > 0 ? (
            <p className="mt-2 text-xs/relaxed text-muted-foreground">
              {naoMedidas} keyword(s) sem volume medido ficam fora da
              comparação.
            </p>
          ) : null}
        </>
      )}
    </StepCard>
  )
}
