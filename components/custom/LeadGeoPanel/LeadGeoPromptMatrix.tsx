"use client"

import { useState, type ReactNode } from "react"
import { RiLinkM } from "react-icons/ri"
import {
  StepCard,
  StepMeter,
  StepSectionLabel,
} from "@/components/custom/LeadStepShell"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "cn"
import { GEO_PROMPT_PLATFORMS } from "@/lib/dataforseo/limits"
import { fold } from "@/lib/leads/geo-answer-list"
import type { GeoPromptRun, GeoPromptVisibility } from "@/lib/leads/geo-audit"
import { brandVariants, GEO_PROMPT_FAMILY_LABELS } from "@/lib/leads/geo-prompts"
import type { GeoPromptSet } from "@/lib/leads/geo-review"
import { PROVIDER_LABELS } from "./geo-format"

/**
 * Onde a marca aparece na resposta de cada modelo, pergunta por pergunta.
 *
 * **O número não é rank.** Medido em 2026-09-11: o ChatGPT declara no próprio
 * texto que sua lista está em *"ordem alfabética"* — e está —, e as outras três
 * não declaram ordem nenhuma. Nenhuma das quatro afirma ordenar por qualidade.
 * Por isso o chip é neutro, diz `6ª de 8` em vez de `#6`, e o rótulo da coluna
 * do ChatGPT carrega a ressalva. Faixa de cor aqui pintaria de verde quem tem
 * nome começando com A.
 *
 * **Três estados, e o terceiro é o motivo da etapa existir.** Execução que o
 * provedor recusou não é "não citou": ela está fora do denominador de propósito
 * e custa zero, então o erro não apareceria nem na conta.
 *
 * Evidência: `docs/auditoria/evidencias/2026-09-11-lista-ordenada/README.md`.
 */

const DENSITY_KEY = "geo:matrix-density"
const NAMES_SHOWN = 8

/** Colunas que medem sem recorte geográfico ou com ordem declarada. */
const COLUMN_NOTE: Record<string, string> = {
  chat_gpt: "ordem alfabética",
  gemini: "sem recorte de cidade",
}

type Density = "compacto" | "completo"

function cellKey(promptId: string, provider: string): string {
  return `${promptId}:${provider}`
}

function Chip({
  children,
  domainCited,
}: {
  children: ReactNode
  domainCited: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-accent px-1.5 py-0.5 text-[10px] font-medium text-foreground tabular-nums">
      {children}
      {domainCited ? (
        <RiLinkM
          size={10}
          aria-label="O site aparece entre as fontes desta resposta"
          className="text-primary"
        />
      ) : null}
    </span>
  )
}

function Cell({
  run,
  density,
  isLead,
}: {
  run: GeoPromptRun | undefined
  density: Density
  isLead: (name: string) => boolean
}) {
  if (!run) {
    return <span className="text-[10px] text-muted-foreground">—</span>
  }

  // Execução que não rodou traz o motivo, e fica fora de qualquer conta.
  if (run.status !== "ok") {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span className="cursor-help text-[10px] text-muted-foreground underline decoration-dotted underline-offset-2" />
          }
        >
          não rodou
        </TooltipTrigger>
        <TooltipContent>
          {run.statusMessage ?? "O provedor não respondeu."}
        </TooltipContent>
      </Tooltip>
    )
  }

  // `answerList` ausente é sondagem anterior ao campo: cai para `brands`, que é
  // só quem estava na lista de casamento. O rodapé da matriz declara isso.
  const lista =
    run.answerList ??
    run.brands.map((brand) => ({ name: brand.name, rank: brand.position }))

  if (!run.mentioned && run.listRank === null) {
    return <span className="text-[10px] text-muted-foreground">não citou</span>
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Chip domainCited={run.domainCited}>
        {run.listRank === null
          ? "citada"
          : `${run.listRank}ª de ${lista.length}`}
      </Chip>
      {density === "completo" && lista.length > 0 ? (
        <ol className="flex min-w-0 flex-col gap-0.5">
          {lista.slice(0, NAMES_SHOWN).map((entry) => (
            <li
              key={`${entry.rank}-${entry.name}`}
              className="flex min-w-0 gap-1"
            >
              <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                {entry.rank}
              </span>
              <span
                className={cn(
                  "min-w-0 truncate text-[10px]",
                  isLead(entry.name)
                    ? "font-medium text-primary"
                    : "text-muted-foreground",
                )}
                title={entry.name}
              >
                {entry.name}
              </span>
            </li>
          ))}
          {lista.length > NAMES_SHOWN ? (
            <li className="text-[10px] text-muted-foreground">
              e mais {lista.length - NAMES_SHOWN}
            </li>
          ) : null}
        </ol>
      ) : null}
    </div>
  )
}

export function LeadGeoPromptMatrix({
  promptSet,
  probe,
  companyName,
}: {
  promptSet: GeoPromptSet
  probe: GeoPromptVisibility
  companyName: string
}) {
  const [density, setDensity] = useState<Density>(() => {
    if (typeof window === "undefined") return "completo"
    return window.localStorage.getItem(DENSITY_KEY) === "compacto"
      ? "compacto"
      : "completo"
  })

  function changeDensity(next: Density) {
    setDensity(next)
    window.localStorage.setItem(DENSITY_KEY, next)
  }

  const variantes = brandVariants(companyName).map(fold)
  const isLead = (name: string) => {
    const dobrado = fold(name)
    return variantes.some(
      (variante) => dobrado === variante || dobrado.includes(variante),
    )
  }

  const porCelula = new Map<string, GeoPromptRun>()
  for (const run of probe.runs) {
    porCelula.set(cellKey(run.promptId, run.provider), run)
  }

  // Só os prompts que a sondagem de fato rodou: prompt set trocado depois da
  // coleta deixaria linhas inteiras vazias, dizendo "não rodou" sobre uma
  // pergunta que nunca foi feita.
  const linhas = promptSet.items.filter((item) =>
    GEO_PROMPT_PLATFORMS.some((platform) =>
      porCelula.has(cellKey(item.id, platform)),
    ),
  )

  const semListaLida = probe.runs.some(
    (run) => run.status === "ok" && run.answerList === null,
  )

  return (
    <StepCard title="Pergunta por pergunta">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <StepSectionLabel aside="ordem de aparição, não ranking">
          Onde a marca aparece em cada IA
        </StepSectionLabel>
        <ToggleGroup
          value={[density]}
          onValueChange={(value) => {
            const next = value[0]
            if (next === "compacto" || next === "completo") changeDensity(next)
          }}
          variant="outline"
          size="sm"
          aria-label="Densidade da matriz"
          className="shrink-0"
        >
          <ToggleGroupItem value="compacto">Compacto</ToggleGroupItem>
          <ToggleGroupItem value="completo">Completo</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {linhas.length === 0 ? (
        <p className="text-xs/relaxed text-muted-foreground">
          Nenhuma pergunta desta sondagem casa com o conjunto de prompts atual.
        </p>
      ) : (
        /* Rola no próprio contêiner; a página nunca rola na horizontal. */
        <div className="overflow-x-auto">
          <Table className="w-full min-w-[52rem] border-collapse text-left">
            <TableHeader>
              <TableRow className="border-b border-border/70">
                <TableHead className="sticky left-0 z-10 bg-card px-1 py-2 text-xs/relaxed font-medium text-muted-foreground">
                  Pergunta
                </TableHead>
                {GEO_PROMPT_PLATFORMS.map((platform) => (
                  <TableHead
                    key={platform}
                    className="px-1 py-2 align-bottom text-xs/relaxed font-medium text-muted-foreground"
                  >
                    <span className="block">
                      {PROVIDER_LABELS[platform] ?? platform}
                    </span>
                    {/* Ressalva fixa da coluna, não detectada no texto: a
                        evidência é estável e heurística de declaração seria
                        frágil. */}
                    {COLUMN_NOTE[platform] ? (
                      <span className="block text-[10px] font-normal">
                        {COLUMN_NOTE[platform]}
                      </span>
                    ) : null}
                  </TableHead>
                ))}
                <TableHead className="px-1 py-2 align-bottom text-xs/relaxed font-medium text-muted-foreground">
                  Citaram
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((item) => {
                const runs = GEO_PROMPT_PLATFORMS.map((platform) =>
                  porCelula.get(cellKey(item.id, platform)),
                )
                const executadas = runs.filter((run) => run?.status === "ok")
                const citaram = executadas.filter((run) => run?.mentioned)
                return (
                  <TableRow
                    key={item.id}
                    className="border-b border-border/50 align-top last:border-b-0"
                  >
                    <TableCell className="sticky left-0 z-10 max-w-[17rem] bg-card px-1 py-2">
                      {/* A família carrega o que o enunciado não carrega:
                          separa "a IA não te conhece" de "a IA não te
                          recomenda". */}
                      <span className="block text-[10px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                        {GEO_PROMPT_FAMILY_LABELS[item.family]}
                      </span>
                      <span
                        className="line-clamp-2 text-xs/relaxed text-foreground"
                        title={item.text}
                      >
                        {item.text}
                      </span>
                    </TableCell>
                    {GEO_PROMPT_PLATFORMS.map((platform, index) => (
                      <TableCell
                        key={platform}
                        className="max-w-[11rem] px-1 py-2"
                      >
                        <Cell
                          run={runs[index]}
                          density={density}
                          isLead={isLead}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="w-20 px-1 py-2">
                      {executadas.length === 0 ? (
                        <span className="text-[10px] text-muted-foreground">
                          —
                        </span>
                      ) : (
                        <>
                          <span className="block text-[10px] text-muted-foreground tabular-nums">
                            {citaram.length} de {executadas.length}
                          </span>
                          {/* Fração legítima: toda resposta lida citando a
                              marca é o melhor resultado possível. O
                              denominador é o das execuções que rodaram. */}
                          <StepMeter
                            share={citaram.length / executadas.length}
                            tone="primary"
                            className="mt-1"
                            trackClassName="h-1"
                          />
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Procedência, sempre visível. A ressalva já existia solta na aba; aqui
          ela fica presa à peça que qualifica. */}
      <p className="mt-3 text-xs/relaxed text-muted-foreground">
        A lista é o que o modelo escreveu naquela execução, na ordem em que
        escreveu — não é ranking de qualidade, e a mesma pergunta devolve
        resposta diferente entre execuções.
      </p>
      {semListaLida ? (
        <p className="mt-1 text-xs/relaxed text-muted-foreground">
          Esta sondagem é anterior à leitura da lista ordenada: o que aparece
          são só as marcas conhecidas detectadas no texto. Sondar de novo
          preenche a lista inteira.
        </p>
      ) : null}
    </StepCard>
  )
}
