/**
 * Fila de tarefas pagas — regras puras, sem rede e sem banco.
 *
 * Extraído de `lib/research/serp-queue.ts` quando a prospecção precisou da
 * mesma máquina. Eram quatro cópias do mesmo lease/attempts/readoção no
 * repositório — malha do GBP, PageSpeed, perfil do GBP e SERP da pesquisa — e
 * a quinta seria escrita de novo à mão. O que muda entre elas é o
 * **transporte**; o controle é idêntico.
 *
 * Cada regra aqui existe por um erro que já custou dinheiro: na malha do GBP,
 * 121 tarefas foram criadas, pagas e perdidas, e o poll recomprava a grade
 * inteira a cada passada — cerca de treze vezes o mesmo trabalho.
 *
 * Puro de propósito. A lição que fundou essa separação está no cabeçalho de
 * `lib/dataforseo/envelope.ts`: o `tag` era lido no nível errado do envelope, e
 * não havia teste possível porque o parsing morava dentro de um módulo
 * `server-only`.
 *
 * As constantes ficam de fora: teto de lote, teto de tentativa, janela de lease
 * e prazo são decisão de cada etapa, não da máquina. Quem chama traz o número.
 */

/**
 * `pending` ainda não tem tarefa. `queued` tem tarefa e espera resposta.
 * `done` foi coletado — e aí resultado vazio significa ausência **real**.
 * `failed` é coleta que **não aconteceu**, e é retentável.
 *
 * Quatro valores e não três. Confundir `done` vazio com `failed` fez, na
 * malha, uma coleta inteiramente falha parecer diagnóstico de que o cliente
 * não rankeia em lugar nenhum.
 */
export type QueueTaskStatus = "pending" | "queued" | "done" | "failed"

/** O mínimo que uma linha de fila precisa ter para a máquina funcionar. */
export type QueueRow = {
  id: string
  status: QueueTaskStatus
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
 * Usa o `id` da linha, nunca um rótulo de domínio: keyword, nome de empresa e
 * URL têm acento, espaço e barra, e virariam tag ambígua. O prefixo do `run_id`
 * é obrigatório porque o `tasks_ready` lista a **conta inteira** — tarefa de
 * outra execução não pode virar resultado desta.
 */
export function queueTaskTag(runId: string, rowId: string): string {
  return `${runId}:${rowId}`
}

export function parseQueueTaskTag(
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
 * desalinharia os índices e atribuiria o resultado de uma linha a outra —
 * silenciosamente, porque os dois lados são strings plausíveis.
 */
export function correlateCreatedTasks(
  runId: string,
  sentRowIds: string[],
  created: CreatedTask[],
): CorrelationResult {
  const taskIds: Record<string, string> = {}
  let byIndex = 0

  const algumaTag = created.some((t) => parseQueueTaskTag(runId, t.tag) !== null)

  for (const tarefa of created) {
    const porTag = parseQueueTaskTag(runId, tarefa.tag)
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
  leaseMs: number,
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
 * Genérica no tipo de propósito: quem chama traz a linha do banco com os
 * campos da etapa junto, e devolver `QueueRow` puro obrigaria a recasar cada
 * selecionada com a origem — que é exatamente o tipo de correlação manual que o
 * incidente da malha ensinou a não fazer à mão.
 */
export function selectForPost<T extends QueueRow>(
  rows: T[],
  batch: number,
  maxAttempts: number,
): T[] {
  return rows
    .filter((r) => r.status === "pending" && r.attempts < maxAttempts)
    .slice(0, batch)
}

/** As que têm tarefa enfileirada e cujo lease já venceu. */
export function selectForPoll<T extends QueueRow>(
  rows: T[],
  now: number,
  leaseMs: number,
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
 * Quem retenta volta a linha para `pending` **sem** `task_id`: reusar o
 * identificador de uma tarefa que falhou pediria de novo um resultado que não
 * existe.
 */
export function selectForRetry<T extends QueueRow>(
  rows: T[],
  maxAttempts: number,
): T[] {
  return rows.filter((r) => r.status === "failed" && r.attempts < maxAttempts)
}

/* -------------------------------------------------------------------------- */
/*  Progresso                                                                 */
/* -------------------------------------------------------------------------- */

export type QueueProgress = {
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

export function queueProgress(
  rows: QueueRow[],
  maxAttempts: number,
): QueueProgress {
  const conta = (s: QueueTaskStatus) => rows.filter((r) => r.status === s).length
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
      (r) => r.status === "failed" && r.attempts >= maxAttempts,
    ).length,
  }
}

/* -------------------------------------------------------------------------- */
/*  Prazo                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Passou do prazo da fila do provedor?
 *
 * Existe para a execução parar de esperar em vez de ficar consultando para
 * sempre uma tarefa que o provedor já descartou.
 */
export function deadlineReached(
  startedAt: string | null,
  now: number,
  deadlineMs: number,
): boolean {
  if (!startedAt) return false
  const desde = Date.parse(startedAt)
  if (Number.isNaN(desde)) return false
  return now - desde >= deadlineMs
}

/* -------------------------------------------------------------------------- */
/*  Orçamento de parede                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A passada ainda cabe no tempo que a plataforma dá?
 *
 * `maxDuration` do segmento de rota é o teto duro; a passada para **antes**
 * dele, e não no meio de uma escrita. Uma passada interrompida pelo runtime
 * deixa o lease marcado sem resultado, e a linha só se recupera quando o lease
 * vence — desperdiçando o ciclo seguinte inteiro.
 *
 * Existe aqui, e não dentro de cada action, porque o `pollResearchSerpTasks`
 * itera sequencialmente sem nenhum teto: com 200 linhas e um `task_get` de até
 * 20 s, ele estoura no meio. A fila nova não repete isso.
 */
export function budgetExhausted(
  startedAtMs: number,
  now: number,
  budgetMs: number,
): boolean {
  return now - startedAtMs >= budgetMs
}
