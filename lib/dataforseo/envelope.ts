/**
 * Leitura dos envelopes do DataForSEO — puro, sem `server-only`.
 *
 * Separado de `client.ts` pelo mesmo motivo que `usage.ts` foi separado de
 * `user-data.ts`: aquele importa `server-only`, que lança fora do servidor, e
 * isso torna o parsing impossível de testar. O preço de não ter esse teste já
 * foi cobrado: o `tag` era lido no nível errado do envelope, uma malha inteira
 * de 121 tarefas foi paga e os identificadores foram jogados fora sem que nada
 * acusasse.
 */

export const DATAFORSEO_OK = 20000
export const DATAFORSEO_TASK_CREATED = 20100

/**
 * 40601 "Task Handed" e 40602 "Task In Queue": a tarefa existe e o resultado
 * ainda vem. Não é erro, é espera — e confundir os dois marca o ponto como
 * falho antes da hora.
 */
export const DATAFORSEO_TASK_PENDING = new Set([40601, 40602])

/** Teto do `task_post`: mais que isso e a própria API recusa com 40006. */
export const DATAFORSEO_TASKS_PER_POST = 100

export type DataForSeoTaskRow<T> = {
  id?: string
  status_code?: number
  status_message?: string
  cost?: number
  result_count?: number
  /**
   * Eco dos parâmetros enviados no post. O `tag` mora **aqui**, não no nível
   * da task: ler `row.tag` devolve `undefined` para sempre.
   */
  data?: Record<string, unknown>
  result?: T[] | null
}

export type DataForSeoEnvelope<T> = {
  status_code?: number
  status_message?: string
  cost?: number
  tasks?: Array<DataForSeoTaskRow<T>>
}

/** `cost` vem em toda resposta e é o custo real em USD daquela chamada. */
export function dataForSeoEnvelopeCost(body: {
  cost?: number
}): number | undefined {
  return typeof body.cost === "number" && Number.isFinite(body.cost)
    ? body.cost
    : undefined
}

export function dataForSeoTaskTag(row: {
  data?: Record<string, unknown>
}): string | null {
  const tag = row.data?.tag
  return typeof tag === "string" && tag.trim().length > 0 ? tag.trim() : null
}

function taskStatusCode(row: { status_code?: number }): number | null {
  return typeof row.status_code === "number" ? row.status_code : null
}

function taskStatusMessage(row: { status_message?: string }): string | null {
  return typeof row.status_message === "string" && row.status_message.trim()
    ? row.status_message.trim()
    : null
}

export type DataForSeoCreatedTask = {
  /** Posição na resposta, usada como correlação de reserva. */
  index: number
  id: string
  tag: string | null
}

export type DataForSeoRejectedTask = {
  index: number
  code: number | null
  message: string
  tag: string | null
}

export type DataForSeoTaskPostEnvelope =
  | { status: "error"; message: string }
  | {
      status: "ok"
      cost: number
      created: DataForSeoCreatedTask[]
      rejected: DataForSeoRejectedTask[]
    }

/**
 * Lê a resposta de um `task_post` em lote.
 *
 * Toda task recusada vira `rejected` com o código e a mensagem que a própria
 * API devolveu, em vez de sumir: uma task descartada em silêncio é uma busca
 * que o usuário pagou e nunca vai ver.
 */
export function readTaskPostEnvelope<T>(
  body: DataForSeoEnvelope<T>,
  errorMessage: string,
): DataForSeoTaskPostEnvelope {
  if (body.status_code !== DATAFORSEO_OK) {
    return { status: "error", message: errorMessage }
  }

  const created: DataForSeoCreatedTask[] = []
  const rejected: DataForSeoRejectedTask[] = []
  const rows = body.tasks ?? []

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if (!row) continue
    const tag = dataForSeoTaskTag(row)
    const code = taskStatusCode(row)
    const id = typeof row.id === "string" ? row.id.trim() : ""
    if (code === DATAFORSEO_TASK_CREATED && id) {
      created.push({ index, id, tag })
      continue
    }
    rejected.push({
      index,
      code,
      message: taskStatusMessage(row) ?? errorMessage,
      tag,
    })
  }

  if (created.length === 0) {
    return {
      status: "error",
      message: rejected[0]?.message ?? errorMessage,
    }
  }

  return {
    status: "ok",
    cost: dataForSeoEnvelopeCost(body) ?? 0,
    created,
    rejected,
  }
}

export type DataForSeoTaskGetEnvelope<T> =
  | { status: "ok"; data: T; cost: number }
  /** Status 20000 sem `result`: a tarefa terminou e não trouxe nada. */
  | { status: "empty"; cost: number }
  | { status: "pending" }
  | { status: "error"; code: number | null; message: string }

/**
 * Lê a resposta de um `task_get`.
 *
 * A espera é reconhecida no envelope **e** na task: a API responde com o
 * envelope em 20000 e o código de fila dentro da task, mas checar os dois custa
 * nada e evita que uma mudança de formato transforme espera em falha.
 */
export function readTaskGetEnvelope<T>(
  body: DataForSeoEnvelope<T>,
  errorMessage: string,
): DataForSeoTaskGetEnvelope<T> {
  const envelopeCode = typeof body.status_code === "number" ? body.status_code : null
  if (envelopeCode !== null && DATAFORSEO_TASK_PENDING.has(envelopeCode)) {
    return { status: "pending" }
  }
  if (envelopeCode !== DATAFORSEO_OK) {
    return { status: "error", code: envelopeCode, message: errorMessage }
  }

  const row = body.tasks?.[0]
  if (!row) {
    return { status: "error", code: null, message: errorMessage }
  }

  const code = taskStatusCode(row)
  if (code !== null && DATAFORSEO_TASK_PENDING.has(code)) {
    return { status: "pending" }
  }
  if (code !== DATAFORSEO_OK) {
    return {
      status: "error",
      code,
      message: taskStatusMessage(row) ?? errorMessage,
    }
  }

  const cost = dataForSeoEnvelopeCost(body) ?? 0
  const data = row.result?.[0]
  if (data === undefined || data === null) {
    return { status: "empty", cost }
  }
  return { status: "ok", data, cost }
}

export type DataForSeoReadyTask = { id: string; tag: string | null }

/**
 * Lê a resposta de um `tasks_ready`. Aqui `result` é a própria lista de
 * tarefas prontas, e não um resultado único como nos demais endpoints.
 */
export function readTasksReadyEnvelope(
  body: DataForSeoEnvelope<Record<string, unknown>>,
  errorMessage: string,
): { status: "ok"; tasks: DataForSeoReadyTask[] } | { status: "error"; message: string } {
  if (body.status_code !== DATAFORSEO_OK) {
    return { status: "error", message: errorMessage }
  }
  const row = body.tasks?.[0]
  if (!row) return { status: "error", message: errorMessage }
  if (taskStatusCode(row) !== DATAFORSEO_OK) {
    return { status: "error", message: taskStatusMessage(row) ?? errorMessage }
  }

  const tasks: DataForSeoReadyTask[] = []
  for (const item of row.result ?? []) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const entry = item as Record<string, unknown>
    const id = typeof entry.id === "string" ? entry.id.trim() : ""
    if (!id) continue
    const tag =
      typeof entry.tag === "string" && entry.tag.trim().length > 0
        ? entry.tag.trim()
        : null
    tasks.push({ id, tag })
  }
  return { status: "ok", tasks }
}
