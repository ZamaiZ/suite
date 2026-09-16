/**
 * A regra que decide se um texto do diagnóstico é do analista ou nosso.
 *
 * Nasceu de um defeito no PDF do cliente: o gancho comercial copia os três
 * primeiros itens do roteiro, ficou salvo no rascunho, e uma coleta nova tirou
 * do roteiro o item que ele anunciava. O documento se contradizia na primeira
 * linha — o gancho pedia "Conquistar citação na visão geral de IA" e o roteiro
 * logo abaixo não tinha o item.
 *
 * O que estes testes travam é o **lado seguro do erro**: na dúvida, o texto do
 * analista fica. Apagar o que ele escreveu não tem desfazer; manter uma frase
 * velha tem.
 */

import test from "node:test"
import assert from "node:assert/strict"

import { keepOrReseed } from "./diagnosis-document.ts"
import { readDiagnosisDocument } from "./diagnosis-read.ts"

const SEMENTE_VELHA = "Foco sugerido: A; B; Conquistar citação em IA."
const SEMENTE_NOVA = "Foco sugerido: A; B; Consolidar o tráfego."
const ESCRITO = "Ele está perdendo ligação para o concorrente da esquina."

test("semente intocada cede lugar à semente nova", () => {
  assert.equal(
    keepOrReseed(SEMENTE_VELHA, SEMENTE_VELHA, SEMENTE_NOVA),
    SEMENTE_NOVA,
  )
})

test("espaço a mais não transforma intocado em editado", () => {
  assert.equal(
    keepOrReseed(`  ${SEMENTE_VELHA}\n`, SEMENTE_VELHA, SEMENTE_NOVA),
    SEMENTE_NOVA,
  )
})

test("texto do analista sobrevive à recompilação", () => {
  assert.equal(keepOrReseed(ESCRITO, SEMENTE_VELHA, SEMENTE_NOVA), ESCRITO)
})

test("sem semente registrada, preserva — documento antigo não se distingue", () => {
  assert.equal(keepOrReseed(SEMENTE_VELHA, undefined, SEMENTE_NOVA), SEMENTE_VELHA)
})

test("campo vazio recebe a semente nova, com ou sem semente anterior", () => {
  assert.equal(keepOrReseed("", SEMENTE_VELHA, SEMENTE_NOVA), SEMENTE_NOVA)
  assert.equal(keepOrReseed("   ", undefined, SEMENTE_NOVA), SEMENTE_NOVA)
})

/* -------------------------------------------------------------------------- */

function lerDocumento(extra) {
  return readDiagnosisDocument({
    version: 1,
    meta: {
      companyName: "Busca Orgânica",
      domain: "buscaorganica.com.br",
      generatedAt: "2026-09-11T00:00:00.000Z",
    },
    facts: { scorecard: {}, pillars: {}, roadmap: [], findings: [] },
    prose: {
      executiveSummary: "",
      commercialHook: SEMENTE_VELHA,
      pillarNarratives: {},
    },
    limitations: [],
    ...extra,
  })
}

test("semente ausente lê como `undefined`, não como prosa vazia", () => {
  const doc = lerDocumento({})
  assert.ok(doc)
  // Prosa vazia aqui diria "o analista apagou tudo" para todo rascunho salvo
  // antes do campo, e a recompilação seguinte reescreveria o texto dele.
  assert.equal(doc.proseSeed, undefined)
})

test("semente gravada volta inteira", () => {
  const doc = lerDocumento({
    proseSeed: {
      executiveSummary: "resumo semeado",
      commercialHook: SEMENTE_VELHA,
      pillarNarratives: { geo: "frase do pilar" },
    },
  })
  assert.ok(doc)
  assert.equal(doc.proseSeed?.commercialHook, SEMENTE_VELHA)
  assert.equal(doc.proseSeed?.pillarNarratives.geo, "frase do pilar")
  // Pilar ausente na semente é string vazia, que `keepOrReseed` compara com
  // texto salvo não-vazio e conclui "editado" — preserva. Lado seguro.
  assert.equal(doc.proseSeed?.pillarNarratives.google, "")
})
