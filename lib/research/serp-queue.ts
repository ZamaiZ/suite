/**
 * Fila da coleta de SERP — os números desta etapa, sobre a máquina genérica.
 *
 * Isto é o passo caro da fase: até 200 chamadas pagas por execução. As regras
 * que eram daqui moram agora em `lib/queue/task-queue.ts`, porque a prospecção
 * precisou das mesmas e a alternativa era a quinta cópia do mesmo
 * lease/attempts/readoção no repositório.
 *
 * O que sobrou aqui são as constantes da etapa e a assinatura que o resto do
 * código já usa. A máquina não conhece tetos; quem chama traz o número.
 */

import {
  correlateCreatedTasks as correlateGeneric,
  deadlineReached as deadlineGeneric,
  leaseExpired as leaseGeneric,
  parseQueueTaskTag,
  queueProgress,
  queueTaskTag,
  selectForPoll as selectForPollGeneric,
  selectForPost as selectForPostGeneric,
  selectForRetry as selectForRetryGeneric,
  type CorrelationResult,
  type CreatedTask,
  type QueueProgress,
  type QueueRow,
  type QueueTaskStatus,
} from "../queue/task-queue.ts"

export type { CorrelationResult, CreatedTask }

/** Teto do `task_post`. Acima disso a própria API recusa com 40006. */
export const SERP_POST_BATCH = 100

/**
 * Uma tentativa original mais uma repescagem.
 *
 * Sem teto, keyword que falha de verdade é reenfileirada a cada passada — e
 * **cada reenfileiramento é pago**.
 */
export const SERP_MAX_ATTEMPTS = 2

/** Janela em que um poll segura a execução antes de outro poder assumir. */
export const SERP_LEASE_MS = 120_000

/** Teto da fila padrão do DataForSEO; passou disso, para de esperar. */
export const SERP_DEADLINE_MS = 45 * 60_000

/**
 * `pending` ainda não tem tarefa. `queued` tem tarefa e espera resposta.
 * `done` foi coletado — e aí `snapshot` sem orgânico significa ausência real.
 * `failed` é coleta que **não aconteceu**, e é retentável.
 *
 * Confundir `done` vazio com `failed` faria o clustering tratar a keyword como
 * órfã e inventar cluster de um item só.
 */
export type SerpTaskStatus = QueueTaskStatus

export type SerpQueueRow = QueueRow & { keyword: string }

/* -------------------------------------------------------------------------- */
/*  Tag — a correlação primária                                               */
/* -------------------------------------------------------------------------- */

/**
 * A tag identifica a linha na volta do `task_get` e do `tasks_ready`.
 *
 * Usa o `id` da linha, não a keyword: keyword tem acento, espaço e barra, e
 * viraria tag ambígua. O prefixo do `run_id` é obrigatório porque o
 * `tasks_ready` lista a **conta inteira**.
 */
export function serpTaskTag(runId: string, rowId: string): string {
  return queueTaskTag(runId, rowId)
}

export function parseSerpTaskTag(
  runId: string,
  tag: string | null,
): string | null {
  return parseQueueTaskTag(runId, tag)
}

/* -------------------------------------------------------------------------- */
/*  Correlação, lease, seleção e progresso — com os números desta etapa       */
/* -------------------------------------------------------------------------- */

export function correlateCreatedTasks(
  runId: string,
  sentRowIds: string[],
  created: CreatedTask[],
): CorrelationResult {
  return correlateGeneric(runId, sentRowIds, created)
}

export function leaseExpired(
  pollingAt: string | null,
  now: number,
  leaseMs = SERP_LEASE_MS,
): boolean {
  return leaseGeneric(pollingAt, now, leaseMs)
}

export function selectForPost<T extends SerpQueueRow>(
  rows: T[],
  batch = SERP_POST_BATCH,
): T[] {
  return selectForPostGeneric(rows, batch, SERP_MAX_ATTEMPTS)
}

export function selectForPoll<T extends SerpQueueRow>(
  rows: T[],
  now: number,
  leaseMs = SERP_LEASE_MS,
): T[] {
  return selectForPollGeneric(rows, now, leaseMs)
}

export function selectForRetry<T extends SerpQueueRow>(rows: T[]): T[] {
  return selectForRetryGeneric(rows, SERP_MAX_ATTEMPTS)
}

export type SerpQueueProgress = QueueProgress

export function serpQueueProgress(rows: SerpQueueRow[]): SerpQueueProgress {
  return queueProgress(rows, SERP_MAX_ATTEMPTS)
}

export function deadlineReached(
  startedAt: string | null,
  now: number,
  deadlineMs = SERP_DEADLINE_MS,
): boolean {
  return deadlineGeneric(startedAt, now, deadlineMs)
}
