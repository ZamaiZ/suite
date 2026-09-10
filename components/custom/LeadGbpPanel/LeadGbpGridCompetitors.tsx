"use client"

import { RiMapPinLine } from "react-icons/ri"
import { StepMeter, StepSectionLabel, StepStat } from "@/components/custom/LeadStepShell"
import { cn } from "cn"
import type { GbpGridPositionSnapshot } from "@/lib/leads/gbp-grid-competitors"

const MAX_ROWS = 8

function num(value: number, digits = 0): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: digits })
}

/** Mesma faixa do chip de posição do ranking no Maps, para os dois concordarem. */
function positionTone(position: number): string {
  if (position <= 3) return "bg-success/10 text-success"
  if (position <= 10) return "bg-warning/10 text-warning"
  return "bg-accent text-muted-foreground"
}

/**
 * Quem ocupa a região, como leaderboard.
 *
 * A ausência do perfil vem primeiro e sozinha: ela é o resultado da malha
 * inteira, e estava como fragmento no fim de uma frase. Depois a lista, com
 * barra para a comparação ser vista em vez de calculada — "5 células" contra
 * "3 células" é aritmética que não deveria ser pedida ao leitor.
 */
export function LeadGbpGridCompetitors({
  position,
}: {
  position: GbpGridPositionSnapshot
}) {
  const rows = position.competitors.slice(0, MAX_ROWS)
  const hidden = Math.max(0, position.competitors.length - rows.length)
  // Base da barra é o líder, não o total de células: com 5 de 49 no topo,
  // normalizar pelo total deixaria todas as barras num fio indistinguível. O
  // número absoluto fica em cada linha, e o rótulo da seção declara a base.
  const top = rows[0]?.cells ?? 0
  const absentShare =
    position.measured > 0 ? position.ownAbsent / position.measured : 0
  const visible = position.measured - position.ownAbsent

  return (
    <div className="flex flex-col gap-3.5">
      <StepStat
        icon={RiMapPinLine}
        label="Presença na malha"
        value={num(position.ownAbsent)}
        unit={`de ${num(position.measured)} células sem o perfil`}
        tone={absentShare >= 0.5 ? "danger" : "warning"}
        hint={
          position.ownTop3 > 0
            ? `Aparece em ${num(visible)} · no top 3 em ${num(position.ownTop3)}`
            : `Aparece em ${num(visible)} · nenhuma no top 3`
        }
      >
        <StepMeter
          share={absentShare}
          tone={absentShare >= 0.5 ? "danger" : "warning"}
          trackClassName="mt-2"
        />
      </StepStat>

      {rows.length > 0 ? (
        <section>
          <StepSectionLabel aside="barra relativa ao líder">
            Quem ocupa a região
          </StepSectionLabel>
          <ol className="flex flex-col gap-2">
            {rows.map((competitor, index) => (
              <li
                key={competitor.key}
                className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2.5"
              >
                <span className="text-right text-[11px] tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs/[1.5] text-foreground">
                    {competitor.title}
                  </p>
                  <StepMeter
                    share={top > 0 ? competitor.cells / top : 0}
                    tone="primary"
                    className="mt-1"
                    trackClassName="h-1"
                  />
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={cn(
                      "inline-flex h-[18px] items-center rounded-md px-1.5 text-[10px] font-medium tabular-nums",
                      positionTone(competitor.averagePosition),
                    )}
                  >
                    pos. {num(competitor.averagePosition, 1)}
                  </span>
                  <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                    {num(competitor.cells)}{" "}
                    {competitor.cells === 1 ? "célula" : "células"}
                    {competitor.cellsAhead > 0
                      ? ` · à frente em ${num(competitor.cellsAhead)}`
                      : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          {hidden > 0 ? (
            <p className="mt-2 pl-[1.875rem] text-[10px] text-muted-foreground">
              mais {num(hidden)}{" "}
              {hidden === 1 ? "concorrente" : "concorrentes"}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
