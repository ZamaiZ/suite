/**
 * Fila da coleta de SERP — regras puras, sem rede e sem banco.
 *
 * Isto é o passo caro da fase: até 200 chamadas pagas por execução. Cada regra
 * aqui existe por um erro que o repositório já pagou na malha do GBP, onde 121
 * tarefas foram criadas, pagas e perdidas, e o poll recomprava tudo a cada
 * passada — cerca de treze vezes o mesmo trabalho.
 *
 * Fica puro para ser testável. A lição que fundou essa separação está no
 * cabeçalho de `lib/dataforseo/envelope.ts`: o `tag` era lido no nível errado
 * do envelope, e não havia teste possível porque o parsing morava dentro de um
 * módulo `server-only`.
 */

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
export type SerpTaskStatus = "pending" | "queued" | "done" | "failed"

export type SerpQueueRow = {
  id: string
  keyword: string
  status: SerpTaskStatus
  taskId: string | null
  attempts: number
  pollingAt: string | null
}

/* -------------------------------------------------------------------------- */
/*  Tag — a correlação primária                                               */
/* -------------------------------------------------------------------------- */

/**
 * A tag identifica a linha na volta do `task_get` e do `tasks_ready`.
 *
 * Usa o `id` da linha, não a keyword: keyword tem acento, espaço e barra, e
 * viraria tag ambígua. O prefixo do `run_id` é obrigatório porque o
 * `tasks_ready` lista a **conta inteira** — tarefa de outra execução não pode
 * virar resultado desta.
 */
export function serpTaskTag(runId: string, rowId: string): string {
  return `${runId}:${rowId}`
}

export function parseSerpTaskTag(
  runId: string,
  tag: string | null,
): string | null {
  if (!tag) return null
  const prefixo = `${runId}:`
  if (!tag.startsWith(prefixo)) return null
  const resto = tag.slice(prefixo.length).trim()
  return resto.length > 0 ? resto : null
}

/* -------------------------------------------------------------------------- */
/*  Correlação do task_post                                                   */
/* -------------------------------------------------------------------------- */

export type CreatedTask = { index: number; id: string; tag: string | null }

export type CorrelationResult = {
  /** `rowId` → `taskId`. É isto que precisa ser gravado **antes** de tudo. */
  taskIds: Record<string, string>
  /** Linhas enviadas cujo identificador não voltou de forma utilizável. */
  unmapped: string[]
  /** Quantas correlações vieram da posição, e não da tag. */
  byIndex: number
}

/**
 * Casa o que o `task_post` criou com as linhas de origem.
 *
 * A tag é a correlação primária. A posição na resposta é reserva, e só vale
 * quando **nenhuma** tag voltou: se alguma veio, uma resposta parcial
 * desalinharia os índices e atribuiria o resultado de uma keyword a outra —
 * silenciosamente, porque os dois lados são strings plausíveis.
 */
export function correlateCreatedTasks(
  runId: string,
  sentRowIds: string[],
  created: CreatedTask[],
): CorrelationResult {
  const taskIds: Record<string, string> = {}
  let byIndex = 0

  const algumaTag = created.some((t) => parseSerpTaskTag(runId, t.tag) !== null)

  for (const tarefa of created) {
    const porTag = parseSerpTaskTag(runId, tarefa.tag)
    if (porTag && sentRowIds.includes(porTag)) {
      taskIds[porTag] = tarefa.id
      continue
    }
    if (algumaTag) continue
    const porIndice = sentRowIds[tarefa.index]
    if (porIndice) {
      taskIds[porIndice] = tarefa.id
      byIndex += 1
    }
  }

  const unmapped = sentRowIds.filter((id) => !taskIds[id])
  return { taskIds, unmapped, byIndex }
}

/* -------------------------------------------------------------------------- */
/*  Lease                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * O lease expirou? Só então outro poll pode assumir.
 *
 * A trava real é o `UPDATE ... WHERE polling_at is null or polling_at < ?`
 * atômico no banco; esta função é o predicado que o teste consegue exercitar.
 * Comparar o status contra ele mesmo **não trava nada**: dois polls em `queued`
 * passavam os dois.
 */
export function leaseExpired(
  pollingAt: string | null,
  now: number,
  leaseMs = SERP_LEASE_MS,
): boolean {
  if (!pollingAt) return true
  const desde = Date.parse(pollingAt)
  if (Number.isNaN(desde)) return true
  return now - desde >= leaseMs
}

/* -------------------------------------------------------------------------- */
/*  Seleção                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * As que ainda não têm tarefa e ainda têm tentativa.
 *
 * Genérica de propósito: quem chama traz a linha do banco com `locationCode` e
 * `languageCode` junto, e devolver `SerpQueueRow` puro obrigaria a recasar cada
 * selecionada com a origem — que é exatamente o tipo de correlação manual que o
 * incidente da malha ensinou a não fazer à mão.
 */
export function selectForPost<T extends SerpQueueRow>(
  rows: T[],
  batch = SERP_POST_BATCH,
): T[] {
  return rows
    .filter((r) => r.status === "pending" && r.attempts < SERP_MAX_ATTEMPTS)
    .slice(0, batch)
}

/** As que têm tarefa enfileirada e cujo lease já venceu. */
export function selectForPoll<T extends SerpQueueRow>(
  rows: T[],
  now: number,
  leaseMs = SERP_LEASE_MS,
): T[] {
  return rows.filter(
    (r) =>
      r.status === "queued" &&
      r.taskId !== null &&
      leaseExpired(r.pollingAt, now, leaseMs),
  )
}

/**
 * Falhou e ainda pode tentar de novo.
 *
 * Volta a `pending` sem `task_id`: reusar o identificador de uma tarefa que
 * falhou pediria de novo um resultado que não existe.
 */
export function selectForRetry<T extends SerpQueueRow>(rows: T[]): T[] {
  return rows.filter(
    (r) => r.status === "failed" && r.attempts < SERP_MAX_ATTEMPTS,
  )
}

/* -------------------------------------------------------------------------- */
/*  Progresso                                                                 */
/* -------------------------------------------------------------------------- */

export type SerpQueueProgress = {
  total: number
  pending: number
  queued: number
  done: number
  failed: number
  /** Terminou de verdade: nada pendente nem enfileirado. */
  settled: boolean
  /** Falhas sem tentativa restante. Contam como perda, não como espera. */
  exhausted: number
}

export function serpQueueProgress(rows: SerpQueueRow[]): SerpQueueProgress {
  const conta = (s: SerpTaskStatus) => rows.filter((r) => r.status === s).length
  const pending = conta("pending")
  const queued = conta("queued")
  return {
    total: rows.length,
    pending,
    queued,
    done: conta("done"),
    failed: conta("failed"),
    settled: pending === 0 && queued === 0,
    exhausted: rows.filter(
      (r) => r.status === "failed" && r.attempts >= SERP_MAX_ATTEMPTS,
    ).length,
  }
}

/**
 * Passou do prazo da fila do provedor?
 *
 * Existe para a execução parar de esperar em vez de ficar consultando para
 * sempre uma tarefa que o provedor já descartou.
 */
export function deadlineReached(
  startedAt: string | null,
  now: number,
  deadlineMs = SERP_DEADLINE_MS,
): boolean {
  if (!startedAt) return false
  const desde = Date.parse(startedAt)
  if (Number.isNaN(desde)) return false
  return now - desde >= deadlineMs
}
