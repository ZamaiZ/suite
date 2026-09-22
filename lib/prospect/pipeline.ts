/**
 * A máquina de etapas do enriquecimento — puro, sem rede e sem banco.
 *
 * Uma fila com coluna `stage`, e não uma tabela por etapa. As etapas diferem
 * no **transporte** — `site` e `identity` são HTTP nosso, `social` e `person`
 * compram tarefa de SERP —, nunca no controle. Os números que mudam entre elas
 * moram nesta tabela, e não no schema, pelo mesmo motivo que
 * `lib/dataforseo/limits.ts` existe sem imports.
 *
 * O contrato de fila vem de `lib/queue/task-queue.ts`, que nasceu do incidente
 * das 121 tarefas pagas treze vezes na malha do GBP.
 */

import {
  budgetExhausted,
  deadlineReached,
  leaseExpired,
  queueProgress,
  selectForPoll as selectForPollGeneric,
  selectForPost as selectForPostGeneric,
  selectForRetry as selectForRetryGeneric,
  type QueueProgress,
  type QueueRow,
  type QueueTaskStatus,
} from "../queue/task-queue.ts"
import { PROSPECT_STAGES, type ProspectStage } from "./types.ts"

export type { QueueTaskStatus }

/**
 * Orçamento de parede de uma passada.
 *
 * Quarenta e cinco segundos, e não sessenta. `maxDuration` do segmento de rota
 * é o teto duro da plataforma, e a passada precisa parar **antes** dele — nunca
 * no meio de uma escrita. Uma passada interrompida pelo runtime deixa o lease
 * marcado sem resultado, e a linha só se recupera quando o lease vence,
 * desperdiçando o ciclo seguinte inteiro.
 *
 * É a correção do defeito que a implementação de referência tem:
 * `pollResearchSerpTasks` itera sequencialmente sem nenhum teto de relógio, e
 * com 200 linhas e um `task_get` de até 20 s ele estoura no meio.
 */
export const PROSPECT_PASS_BUDGET_MS = 45_000

/** Prazo de uma execução inteira. Teto da fila padrão do provedor. */
export const PROSPECT_RUN_DEADLINE_MS = 45 * 60_000

export type StageConfig = {
  /** Compra tarefa no provedor? Define se a linha passa por `queued`. */
  paid: boolean
  /** Quantas linhas uma passada processa. */
  batch: number
  /** Uma tentativa e uma repescagem. Cada reenvio de etapa paga é pago. */
  maxAttempts: number
  /** Janela em que uma passada segura a linha antes de outra poder assumir. */
  leaseMs: number
  /** Rótulo em português para a barra de progresso. */
  label: string
}

/**
 * Os números de cada etapa.
 *
 * `site` tem lote pequeno porque cada linha é um fetch a um servidor de
 * terceiro, que pode levar segundos; `identity` tem lote grande porque é
 * consulta barata; as pagas seguem o teto de 100 do `task_post`.
 */
export const STAGE_CONFIG: Record<ProspectStage, StageConfig> = {
  site: {
    paid: false,
    batch: 30,
    maxAttempts: 2,
    leaseMs: 120_000,
    label: "Site",
  },
  identity: {
    paid: false,
    batch: 40,
    maxAttempts: 2,
    leaseMs: 120_000,
    label: "CNPJ e sócios",
  },
  social: {
    paid: true,
    batch: 100,
    maxAttempts: 2,
    leaseMs: 120_000,
    label: "Redes sociais",
  },
  person: {
    paid: true,
    batch: 20,
    maxAttempts: 2,
    leaseMs: 120_000,
    label: "Contato do dono",
  },
}

export type ProspectTaskRow = QueueRow & {
  prospectId: string
  stage: ProspectStage
  found: boolean | null
}

/* -------------------------------------------------------------------------- */
/*  Portões — quais etapas nascem, e quando                                   */
/* -------------------------------------------------------------------------- */

/** O que a máquina sabe de um prospect na hora de decidir a próxima etapa. */
export type ProspectGateState = {
  prospectId: string
  /** Tem domínio? Sem ele a etapa `site` não tem o que buscar. */
  hasDomain: boolean
  /** O listing já trouxe alguma rede social? */
  hasSocialFromListing: boolean
  /** A etapa `site` já assentou, e achou alguma coisa? */
  siteSettled: boolean
  siteFoundSocial: boolean
  /** A identidade já assentou, e trouxe sócio pessoa física? */
  identitySettled: boolean
  identityFoundPerson: boolean
  /** O SDR pediu a busca do dono para este prospect? */
  personRequested: boolean
}

/**
 * Quais etapas devem existir agora para este prospect.
 *
 * A ausência da linha **é** o "pulado". Criar uma linha de `site` para quem não
 * tem domínio inflaria o denominador da barra e faria a tela mentir sobre
 * quanto falta — e por isso não existe um quinto status.
 */
export function stagesToEnqueue(state: ProspectGateState): ProspectStage[] {
  const stages: ProspectStage[] = []

  // `site` antes de `identity`, e não o contrário.
  //
  // O CNPJ no rodapé é um match exato, gratuito e auto-declarado pela própria
  // empresa. Rodar o matcher pago antes dele seria pagar por um "provável" que
  // o exato teria derrubado.
  if (state.hasDomain) stages.push("site")

  // `identity` roda sempre: mesmo sem site há telefone (71% a 85% da amostra)
  // e CEP (95% a 99%), que são as chaves de maior alcance.
  stages.push("identity")

  // `social` só para quem ainda não tem rede nenhuma. Comprar SERP para
  // descobrir um Instagram que o rodapé do site já entregou é dinheiro jogado
  // fora — e é o tipo de desperdício que só aparece na fatura.
  const jaTemRede = state.hasSocialFromListing || state.siteFoundSocial
  const siteJaRespondeu = !state.hasDomain || state.siteSettled
  if (!jaTemRede && siteJaRespondeu) stages.push("social")

  // `person` nunca em lote.
  //
  // É a etapa mais cara, a mais lenta e a única que trata dado de pessoa
  // física. Exige pedido explícito do SDR — que fica registrado em
  // `prospect_enrichments.requested_by` — e exige que o QSA tenha trazido um
  // sócio pessoa física para procurar.
  if (state.personRequested && state.identitySettled && state.identityFoundPerson) {
    stages.push("person")
  }

  return stages
}

/* -------------------------------------------------------------------------- */
/*  Seleção, com os números de cada etapa                                     */
/* -------------------------------------------------------------------------- */

export function selectForPost(
  rows: ProspectTaskRow[],
  stage: ProspectStage,
): ProspectTaskRow[] {
  const cfg = STAGE_CONFIG[stage]
  return selectForPostGeneric(
    rows.filter((r) => r.stage === stage),
    cfg.batch,
    cfg.maxAttempts,
  )
}

export function selectForPoll(
  rows: ProspectTaskRow[],
  stage: ProspectStage,
  now: number,
): ProspectTaskRow[] {
  const cfg = STAGE_CONFIG[stage]
  return selectForPollGeneric(
    rows.filter((r) => r.stage === stage),
    now,
    cfg.leaseMs,
  )
}

export function selectForRetry(
  rows: ProspectTaskRow[],
  stage: ProspectStage,
): ProspectTaskRow[] {
  return selectForRetryGeneric(
    rows.filter((r) => r.stage === stage),
    STAGE_CONFIG[stage].maxAttempts,
  )
}

/**
 * A próxima etapa a trabalhar nesta passada.
 *
 * Na ordem do funil, e uma por vez: a passada tem 45 s, e alternar entre
 * etapas dentro dela só tornaria o progresso ilegível. Devolve `null` quando
 * não há nada pendente.
 */
export function nextStageToWork(rows: ProspectTaskRow[]): ProspectStage | null {
  for (const stage of PROSPECT_STAGES) {
    const daEtapa = rows.filter((r) => r.stage === stage)
    if (daEtapa.some((r) => r.status === "pending" || r.status === "queued")) {
      return stage
    }
  }
  return null
}

/* -------------------------------------------------------------------------- */
/*  Progresso                                                                 */
/* -------------------------------------------------------------------------- */

export type StageProgress = QueueProgress & {
  stage: ProspectStage
  label: string
  /** Assentou e achou. É diferente de `done`, que inclui quem não achou. */
  hits: number
}

export type PipelineProgress = {
  stages: StageProgress[]
  total: number
  done: number
  failed: number
  settled: boolean
}

export function pipelineProgress(rows: ProspectTaskRow[]): PipelineProgress {
  const stages: StageProgress[] = []

  for (const stage of PROSPECT_STAGES) {
    const daEtapa = rows.filter((r) => r.stage === stage)
    if (daEtapa.length === 0) continue
    const base = queueProgress(daEtapa, STAGE_CONFIG[stage].maxAttempts)
    stages.push({
      ...base,
      stage,
      label: STAGE_CONFIG[stage].label,
      // `done` com `found = false` é "rodou e não achou" — resultado legítimo,
      // não falha. Somar os dois faria "nenhuma empresa publica CNPJ no site"
      // parecer "a coleta quebrou".
      hits: daEtapa.filter((r) => r.status === "done" && r.found === true).length,
    })
  }

  return {
    stages,
    total: rows.length,
    done: rows.filter((r) => r.status === "done").length,
    failed: rows.filter((r) => r.status === "failed").length,
    settled: rows.every((r) => r.status === "done" || r.status === "failed"),
  }
}

/**
 * Quanto falta, em minutos.
 *
 * A tela mostra tempo, e não só porcentagem, porque o scheduler é a aba do
 * navegador: quem precisa decidir se espera ou volta depois precisa do número
 * em minutos, não de uma barra em 37%.
 */
export function remainingMinutes(
  progress: PipelineProgress,
  msPerRow = 1_500,
): number | null {
  const faltam = progress.total - progress.done - progress.failed
  if (faltam <= 0) return null
  return Math.max(1, Math.ceil((faltam * msPerRow) / 60_000))
}

export { budgetExhausted, deadlineReached, leaseExpired }
