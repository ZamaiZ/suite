/**
 * Trava a máquina de etapas.
 *
 * Os dois erros que esta suíte existe para impedir são de dinheiro:
 *
 *   1. Comprar SERP para descobrir uma rede social que o site já entregou.
 *   2. Enfileirar a etapa mais cara (`person`) em lote, sem pedido do SDR.
 *
 * E um de leitura: confundir "rodou e não achou" com "falhou", que faria a
 * campanha nunca fechar.
 */

import test from "node:test"
import assert from "node:assert/strict"

import {
  nextStageToWork,
  pipelineProgress,
  PROSPECT_PASS_BUDGET_MS,
  remainingMinutes,
  selectForPoll,
  selectForPost,
  STAGE_CONFIG,
  stagesToEnqueue,
} from "./pipeline.ts"

const estado = (over = {}) => ({
  prospectId: "p1",
  hasDomain: false,
  hasSocialFromListing: false,
  siteSettled: false,
  siteFoundSocial: false,
  identitySettled: false,
  identityFoundPerson: false,
  personRequested: false,
  ...over,
})

const tarefa = (over = {}) => ({
  id: "t1",
  prospectId: "p1",
  stage: "site",
  status: "pending",
  taskId: null,
  attempts: 0,
  pollingAt: null,
  found: null,
  ...over,
})

/* -------------------------------------------------------------------------- */
/*  Portões                                                                   */
/* -------------------------------------------------------------------------- */

test("sem domínio, a etapa de site não nasce", () => {
  const stages = stagesToEnqueue(estado({ hasDomain: false }))
  assert.ok(!stages.includes("site"))
  // A ausência da linha É o "pulado". Criá-la inflaria o denominador da barra.
})

test("site vem antes de identidade — o CNPJ do rodapé é exato e grátis", () => {
  const stages = stagesToEnqueue(estado({ hasDomain: true }))
  assert.ok(stages.indexOf("site") < stages.indexOf("identity"))
})

test("identidade roda mesmo sem site — telefone e CEP têm mais alcance", () => {
  // Medido: 71% a 85% têm telefone e 95% a 99% têm CEP, contra 21% a 40% com
  // site. Amarrar a identidade ao site perderia a maioria.
  const stages = stagesToEnqueue(estado({ hasDomain: false }))
  assert.ok(stages.includes("identity"))
})

test("rede social vinda do listing evita a SERP paga", () => {
  const stages = stagesToEnqueue(
    estado({ hasDomain: false, hasSocialFromListing: true }),
  )
  assert.ok(!stages.includes("social"))
})

test("rede social achada no site também evita a SERP paga", () => {
  const stages = stagesToEnqueue(
    estado({ hasDomain: true, siteSettled: true, siteFoundSocial: true }),
  )
  assert.ok(!stages.includes("social"))
})

test("social espera o site responder antes de gastar", () => {
  // Enfileirar as duas juntas compraria SERP para quem o site ia resolver.
  const stages = stagesToEnqueue(estado({ hasDomain: true, siteSettled: false }))
  assert.ok(!stages.includes("social"))
})

test("site sem rede nenhuma libera a SERP", () => {
  const stages = stagesToEnqueue(
    estado({ hasDomain: true, siteSettled: true, siteFoundSocial: false }),
  )
  assert.ok(stages.includes("social"))
})

test("a busca do dono nunca entra sem pedido explícito", () => {
  const stages = stagesToEnqueue(
    estado({ identitySettled: true, identityFoundPerson: true, personRequested: false }),
  )
  assert.ok(!stages.includes("person"))
})

test("a busca do dono exige pedido E sócio pessoa física no QSA", () => {
  const semSocio = stagesToEnqueue(
    estado({ personRequested: true, identitySettled: true, identityFoundPerson: false }),
  )
  assert.ok(!semSocio.includes("person"), "sem insumo, não se compra tarefa")

  const comSocio = stagesToEnqueue(
    estado({ personRequested: true, identitySettled: true, identityFoundPerson: true }),
  )
  assert.ok(comSocio.includes("person"))
})

/* -------------------------------------------------------------------------- */
/*  Seleção                                                                   */
/* -------------------------------------------------------------------------- */

test("cada etapa usa o próprio lote", () => {
  const linhas = Array.from({ length: 200 }, (_, i) =>
    tarefa({ id: `s${i}`, stage: "site" }),
  )
  assert.equal(selectForPost(linhas, "site").length, STAGE_CONFIG.site.batch)
})

test("a seleção não mistura etapas", () => {
  const linhas = [
    tarefa({ id: "a", stage: "site" }),
    tarefa({ id: "b", stage: "identity" }),
  ]
  assert.deepEqual(
    selectForPost(linhas, "identity").map((r) => r.id),
    ["b"],
  )
})

test("linha sem tentativa restante não volta para a fila", () => {
  const linhas = [tarefa({ attempts: STAGE_CONFIG.site.maxAttempts })]
  assert.deepEqual(selectForPost(linhas, "site"), [])
})

test("o poll só pega quem tem tarefa e lease vencido", () => {
  const agora = Date.now()
  const linhas = [
    tarefa({ id: "a", status: "queued", taskId: "x", pollingAt: null }),
    tarefa({
      id: "b",
      status: "queued",
      taskId: "y",
      pollingAt: new Date(agora - 1_000).toISOString(),
    }),
    tarefa({ id: "c", status: "queued", taskId: null }),
  ]
  assert.deepEqual(
    selectForPoll(linhas, "site", agora).map((r) => r.id),
    ["a"],
  )
})

/* -------------------------------------------------------------------------- */
/*  Ordem de trabalho                                                         */
/* -------------------------------------------------------------------------- */

test("a passada trabalha a primeira etapa pendente do funil", () => {
  const linhas = [
    tarefa({ id: "a", stage: "identity", status: "pending" }),
    tarefa({ id: "b", stage: "site", status: "pending" }),
  ]
  assert.equal(nextStageToWork(linhas), "site")
})

test("etapa toda assentada é pulada", () => {
  const linhas = [
    tarefa({ id: "a", stage: "site", status: "done", found: true }),
    tarefa({ id: "b", stage: "identity", status: "pending" }),
  ]
  assert.equal(nextStageToWork(linhas), "identity")
})

test("nada pendente devolve null, e a execução para", () => {
  const linhas = [tarefa({ status: "done", found: false })]
  assert.equal(nextStageToWork(linhas), null)
})

/* -------------------------------------------------------------------------- */
/*  Progresso                                                                 */
/* -------------------------------------------------------------------------- */

test("'rodou e não achou' conta como concluído, não como falha", () => {
  const linhas = [
    tarefa({ id: "a", status: "done", found: true }),
    tarefa({ id: "b", status: "done", found: false }),
    tarefa({ id: "c", status: "failed" }),
  ]
  const p = pipelineProgress(linhas)
  const site = p.stages.find((s) => s.stage === "site")
  assert.equal(site.done, 2, "os dois rodaram")
  assert.equal(site.hits, 1, "mas só um achou")
  assert.equal(site.failed, 1)
  assert.equal(p.settled, true, "falha esgotada também assenta a campanha")
})

test("etapa sem nenhuma linha não aparece na barra", () => {
  const p = pipelineProgress([tarefa({ stage: "site", status: "pending" })])
  assert.deepEqual(
    p.stages.map((s) => s.stage),
    ["site"],
  )
})

test("campanha com pendente não está assentada", () => {
  const p = pipelineProgress([
    tarefa({ id: "a", status: "done", found: true }),
    tarefa({ id: "b", status: "pending" }),
  ])
  assert.equal(p.settled, false)
})

test("o que falta é dito em minutos, porque a aba precisa ficar aberta", () => {
  const linhas = Array.from({ length: 100 }, (_, i) => tarefa({ id: `x${i}` }))
  const p = pipelineProgress(linhas)
  assert.equal(remainingMinutes(p, 1_500), 3)
})

test("nada faltando não mostra tempo", () => {
  const p = pipelineProgress([tarefa({ status: "done", found: true })])
  assert.equal(remainingMinutes(p), null)
})

/* -------------------------------------------------------------------------- */

test("o orçamento da passada é menor que o teto da plataforma", () => {
  // `maxDuration = 60`. Parar em 45 s deixa margem para a última escrita.
  assert.ok(PROSPECT_PASS_BUDGET_MS < 60_000)
})
