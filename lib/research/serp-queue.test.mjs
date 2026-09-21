/**
 * Trava as quatro proteções do passo pago.
 *
 * Cada teste aqui corresponde a um erro que já custou dinheiro de verdade na
 * malha do GBP — 121 tarefas pagas, identificadores descartados, poll
 * recomprando a grade inteira a cada passada.
 */

import test from "node:test"
import assert from "node:assert/strict"

import {
  SERP_LEASE_MS,
  SERP_MAX_ATTEMPTS,
  SERP_POST_BATCH,
  correlateCreatedTasks,
  deadlineReached,
  leaseExpired,
  parseSerpTaskTag,
  selectForPoll,
  selectForPost,
  selectForRetry,
  serpQueueProgress,
  serpTaskTag,
} from "./serp-queue.ts"

const RUN = "11111111-1111-1111-1111-111111111111"
const OUTRA_RUN = "22222222-2222-2222-2222-222222222222"

const linha = (over = {}) => ({
  id: "row-1",
  keyword: "loja de tintas em itu",
  status: "pending",
  taskId: null,
  attempts: 0,
  pollingAt: null,
  ...over,
})

/* -------------------------------------------------------------------------- */
/*  Tag — não pegar tarefa de outra execução                                  */
/* -------------------------------------------------------------------------- */

test("a tag volta para o id da linha", () => {
  const tag = serpTaskTag(RUN, "row-abc")
  assert.equal(parseSerpTaskTag(RUN, tag), "row-abc")
})

test("tag de outra execução é recusada", () => {
  // `tasks_ready` lista a conta inteira. Sem este prefixo, a tarefa de outro
  // cliente viraria resultado deste.
  const tag = serpTaskTag(OUTRA_RUN, "row-abc")
  assert.equal(parseSerpTaskTag(RUN, tag), null)
})

test("tag ausente ou vazia não vira id", () => {
  assert.equal(parseSerpTaskTag(RUN, null), null)
  assert.equal(parseSerpTaskTag(RUN, `${RUN}:`), null)
  assert.equal(parseSerpTaskTag(RUN, `${RUN}:   `), null)
})

/* -------------------------------------------------------------------------- */
/*  Correlação — o erro que descartou 121 identificadores                     */
/* -------------------------------------------------------------------------- */

test("correlaciona pela tag", () => {
  const r = correlateCreatedTasks(RUN, ["a", "b"], [
    { index: 0, id: "task-a", tag: serpTaskTag(RUN, "a") },
    { index: 1, id: "task-b", tag: serpTaskTag(RUN, "b") },
  ])
  assert.deepEqual(r.taskIds, { a: "task-a", b: "task-b" })
  assert.deepEqual(r.unmapped, [])
  assert.equal(r.byIndex, 0)
})

test("sem tag nenhuma, a posição é a reserva", () => {
  const r = correlateCreatedTasks(RUN, ["a", "b"], [
    { index: 0, id: "task-a", tag: null },
    { index: 1, id: "task-b", tag: null },
  ])
  assert.deepEqual(r.taskIds, { a: "task-a", b: "task-b" })
  assert.equal(r.byIndex, 2)
})

test("resposta parcial COM tag não usa posição — desalinharia tudo", () => {
  // Se alguma tag veio e outra não, cair no índice atribuiria o resultado de
  // uma keyword a outra, em silêncio: os dois lados são strings plausíveis.
  const r = correlateCreatedTasks(RUN, ["a", "b", "c"], [
    { index: 0, id: "task-a", tag: serpTaskTag(RUN, "a") },
    { index: 1, id: "task-x", tag: null },
  ])
  assert.deepEqual(r.taskIds, { a: "task-a" })
  assert.equal(r.byIndex, 0)
  assert.deepEqual(r.unmapped.sort(), ["b", "c"])
})

test("tag de linha que não foi enviada é ignorada", () => {
  const r = correlateCreatedTasks(RUN, ["a"], [
    { index: 0, id: "task-z", tag: serpTaskTag(RUN, "z") },
  ])
  assert.deepEqual(r.taskIds, {})
  assert.deepEqual(r.unmapped, ["a"])
})

test("o que não correlacionou é reportado, não some", () => {
  // Tarefa paga que some sem registro é a definição do incidente da malha.
  const r = correlateCreatedTasks(RUN, ["a", "b"], [])
  assert.deepEqual(r.unmapped.sort(), ["a", "b"])
})

/* -------------------------------------------------------------------------- */
/*  Lease — dois polls simultâneos                                            */
/* -------------------------------------------------------------------------- */

test("sem lease, qualquer poll assume", () => {
  assert.equal(leaseExpired(null, Date.now()), true)
})

test("lease fresco segura o segundo poll", () => {
  const agora = Date.now()
  const recem = new Date(agora - 1000).toISOString()
  assert.equal(leaseExpired(recem, agora), false)
})

test("lease vencido libera", () => {
  const agora = Date.now()
  const velho = new Date(agora - SERP_LEASE_MS - 1).toISOString()
  assert.equal(leaseExpired(velho, agora), true)
})

test("lease com data ilegível libera em vez de travar para sempre", () => {
  assert.equal(leaseExpired("não é data", Date.now()), true)
})

/* -------------------------------------------------------------------------- */
/*  Seleção e teto de tentativas                                              */
/* -------------------------------------------------------------------------- */

test("só entra no post quem não tem tarefa", () => {
  const rows = [
    linha({ id: "a", status: "pending" }),
    linha({ id: "b", status: "queued", taskId: "t" }),
    linha({ id: "c", status: "done" }),
  ]
  assert.deepEqual(selectForPost(rows).map((r) => r.id), ["a"])
})

test("o post respeita o teto de lote", () => {
  const rows = Array.from({ length: SERP_POST_BATCH + 30 }, (_, i) =>
    linha({ id: `r${i}` }),
  )
  assert.equal(selectForPost(rows).length, SERP_POST_BATCH)
})

test("quem esgotou as tentativas não volta para o post — cada retry é pago", () => {
  const rows = [linha({ id: "a", attempts: SERP_MAX_ATTEMPTS })]
  assert.deepEqual(selectForPost(rows), [])
})

test("o poll só pega quem tem tarefa e lease vencido", () => {
  const agora = Date.now()
  const rows = [
    linha({ id: "a", status: "queued", taskId: "t", pollingAt: null }),
    linha({
      id: "b",
      status: "queued",
      taskId: "t",
      pollingAt: new Date(agora - 1000).toISOString(),
    }),
    linha({ id: "c", status: "queued", taskId: null }),
    linha({ id: "d", status: "pending" }),
  ]
  assert.deepEqual(selectForPoll(rows, agora).map((r) => r.id), ["a"])
})

test("retry só pega falha com tentativa restante", () => {
  const rows = [
    linha({ id: "a", status: "failed", attempts: 1 }),
    linha({ id: "b", status: "failed", attempts: SERP_MAX_ATTEMPTS }),
    linha({ id: "c", status: "done" }),
  ]
  assert.deepEqual(selectForRetry(rows).map((r) => r.id), ["a"])
})

/* -------------------------------------------------------------------------- */
/*  Progresso — failed não é done vazio                                       */
/* -------------------------------------------------------------------------- */

test("conta os quatro estados separadamente", () => {
  const rows = [
    linha({ status: "pending" }),
    linha({ status: "queued", taskId: "t" }),
    linha({ status: "done" }),
    linha({ status: "done" }),
    linha({ status: "failed", attempts: SERP_MAX_ATTEMPTS }),
  ]
  const p = serpQueueProgress(rows)
  assert.deepEqual(
    { total: p.total, pending: p.pending, queued: p.queued, done: p.done, failed: p.failed },
    { total: 5, pending: 1, queued: 1, done: 2, failed: 1 },
  )
  assert.equal(p.settled, false)
  assert.equal(p.exhausted, 1)
})

test("settled exige nada pendente nem enfileirado — falha esgotada não impede", () => {
  const rows = [
    linha({ status: "done" }),
    linha({ status: "failed", attempts: SERP_MAX_ATTEMPTS }),
  ]
  const p = serpQueueProgress(rows)
  assert.equal(p.settled, true)
  assert.equal(p.exhausted, 1)
})

test("fila vazia é settled e não erro", () => {
  const p = serpQueueProgress([])
  assert.equal(p.settled, true)
  assert.equal(p.total, 0)
})

/* -------------------------------------------------------------------------- */
/*  Prazo                                                                     */
/* -------------------------------------------------------------------------- */

test("sem início, não há prazo a cobrar", () => {
  assert.equal(deadlineReached(null, Date.now()), false)
})

test("prazo vencido para de esperar tarefa que o provedor já descartou", () => {
  const agora = Date.now()
  const velho = new Date(agora - 46 * 60_000).toISOString()
  assert.equal(deadlineReached(velho, agora), true)
})

test("dentro do prazo, continua esperando", () => {
  const agora = Date.now()
  const recente = new Date(agora - 60_000).toISOString()
  assert.equal(deadlineReached(recente, agora), false)
})
