/**
 * Trava a temperatura do prospect.
 *
 * Os dois eixos existem separados porque pedem ações opostas do SDR: aderência
 * alta com alcance baixo é trabalho de pesquisa, alcance alto com aderência
 * baixa é tempo perdido. Um número só esconderia a diferença — e é isso que
 * esta suíte impede que volte.
 */

import test from "node:test"
import assert from "node:assert/strict"

import { scoreFit, scoreProspect, scoreReach } from "./score.ts"
import { emailGuesses, genericGuesses } from "./email-patterns.ts"

const entrada = (over = {}) => ({
  listing: {
    isClaimed: true,
    rating: 4.8,
    votesCount: 300,
    domain: "empresa.com.br",
    phoneE164: "5511992154880",
  },
  identity: null,
  contacts: [],
  taxIdConfidence: 0,
  ...over,
})

const contato = (over = {}) => ({
  kind: "phone",
  value: "5511992154880",
  key: "5511992154880",
  source: "site",
  confidence: 80,
  ...over,
})

const ficha = (over = {}) => ({
  taxId: "11222333000181",
  legalName: "X LTDA",
  tradeName: null,
  shareCapital: null,
  size: null,
  legalNature: null,
  mainActivity: null,
  secondaryActivities: [],
  registrationStatus: "ATIVA",
  openedAt: null,
  simples: null,
  mei: false,
  zip: null,
  streetNumber: null,
  city: null,
  state: null,
  phones: [],
  emails: [],
  partners: [],
  sourceUpdatedAt: null,
  ...over,
})

/* -------------------------------------------------------------------------- */
/*  Aderência                                                                 */
/* -------------------------------------------------------------------------- */

test("empresa bem servida tem aderência baixa", () => {
  const { fit } = scoreFit(entrada())
  assert.ok(fit < 20, `aderência foi ${fit}`)
})

test("perfil não reivindicado é o sinal que mais pesa", () => {
  // É o problema que a agência resolve numa reunião.
  const { fit, reasons } = scoreFit(
    entrada({ listing: { ...entrada().listing, isClaimed: false } }),
  )
  assert.ok(fit >= 30)
  assert.ok(reasons.some((r) => r.label.includes("não reivindicado")))
})

test("sem site, sem perfil e com nota baixa é o lead mais quente", () => {
  const { fit } = scoreFit(
    entrada({
      listing: {
        isClaimed: false,
        rating: 3.4,
        votesCount: 8,
        domain: null,
        phoneE164: "5511992154880",
      },
    }),
  )
  assert.ok(fit >= 70, `aderência foi ${fit}`)
})

test("capital social entra na conta de quem tem com que pagar", () => {
  const sem = scoreFit(entrada({ identity: ficha() })).fit
  const com = scoreFit(entrada({ identity: ficha({ shareCapital: 250_000 }) })).fit
  assert.ok(com > sem)
})

test("MEI desconta — verba costuma ser curta", () => {
  const normal = scoreFit(entrada({ identity: ficha({ shareCapital: 50_000 }) })).fit
  const mei = scoreFit(
    entrada({ identity: ficha({ shareCapital: 50_000, mei: true }) }),
  ).fit
  assert.ok(mei < normal)
})

/* -------------------------------------------------------------------------- */
/*  Alcance                                                                   */
/* -------------------------------------------------------------------------- */

test("WhatsApp vale mais que qualquer outro canal", () => {
  const zap = scoreReach(entrada({ contacts: [contato({ kind: "whatsapp", confidence: 95 })] })).reach
  const email = scoreReach(entrada({ contacts: [contato({ kind: "email", confidence: 95 })] })).reach
  assert.ok(zap > email)
})

test("cinco telefones não valem cinco vezes um telefone", () => {
  const um = scoreReach(entrada({ contacts: [contato()] })).reach
  const cinco = scoreReach(
    entrada({
      contacts: [1, 2, 3, 4, 5].map((n) =>
        contato({ key: `551199999000${n}` }),
      ),
    }),
  ).reach
  assert.equal(um, cinco)
})

test("a confiança do contato escala o peso dele", () => {
  const forte = scoreReach(entrada({ contacts: [contato({ confidence: 90 })] })).reach
  const fraco = scoreReach(entrada({ contacts: [contato({ confidence: 50 })] })).reach
  assert.ok(forte > fraco)
})

test("saber quem decide é metade do alcance", () => {
  const sem = scoreReach(entrada({ contacts: [contato()] })).reach
  const com = scoreReach(
    entrada({
      contacts: [contato()],
      identity: ficha({
        partners: [
          { name: "João da Silva", maskedTaxId: "***123456**", qualification: "Sócio-Administrador", since: null, isCompany: false },
        ],
      }),
    }),
  ).reach
  assert.ok(com > sem)
})

test("sócio pessoa jurídica não é alguém para ligar", () => {
  const r = scoreReach(
    entrada({
      identity: ficha({
        partners: [
          { name: "HOLDING X LTDA", maskedTaxId: null, qualification: "Sócia", since: null, isCompany: true },
        ],
      }),
    }),
  )
  assert.ok(!r.reasons.some((x) => x.label.includes("sócio identificado")))
})

test("CNPJ incerto desconta — o QSA pode ser de outra empresa", () => {
  const certo = scoreReach(entrada({ contacts: [contato()], taxIdConfidence: 95 })).reach
  const incerto = scoreReach(entrada({ contacts: [contato()], taxIdConfidence: 45 })).reach
  assert.ok(incerto < certo)
})

/* -------------------------------------------------------------------------- */
/*  Temperatura                                                               */
/* -------------------------------------------------------------------------- */

test("quente exige os dois eixos", () => {
  const s = scoreProspect(
    entrada({
      listing: { isClaimed: false, rating: 3.2, votesCount: 5, domain: null, phoneE164: "5511992154880" },
      contacts: [contato({ kind: "whatsapp", confidence: 95 }), contato()],
      identity: ficha({
        shareCapital: 120_000,
        partners: [
          { name: "Maria Souza", maskedTaxId: "***1**", qualification: "Sócia", since: null, isCompany: false },
        ],
      }),
      taxIdConfidence: 95,
    }),
  )
  assert.equal(s.temperature, "quente")
})

test("boa empresa sem como abordar não é quente — é pesquisa", () => {
  const s = scoreProspect(
    entrada({
      listing: { isClaimed: false, rating: 3.2, votesCount: 5, domain: null, phoneE164: null },
      contacts: [],
    }),
  )
  assert.notEqual(s.temperature, "quente")
  assert.ok(s.fit > s.reach)
})

test("fácil de falar e não serve também não é quente", () => {
  const s = scoreProspect(
    entrada({ contacts: [contato({ kind: "whatsapp", confidence: 95 })] }),
  )
  assert.notEqual(s.temperature, "quente")
})

/* -------------------------------------------------------------------------- */
/*  Padrões de e-mail                                                         */
/* -------------------------------------------------------------------------- */

test("os padrões saem na ordem de probabilidade", () => {
  const g = emailGuesses("João da Silva", "empresa.com.br")
  assert.equal(g[0].email, "joao@empresa.com.br")
  assert.ok(g.some((x) => x.email === "joao.silva@empresa.com.br"))
  assert.ok(g.some((x) => x.email === "jsilva@empresa.com.br"))
})

test("preposição não entra no e-mail", () => {
  const g = emailGuesses("Maria de Souza dos Santos", "x.com.br")
  assert.equal(g[0].email, "maria@x.com.br")
  assert.ok(g.some((x) => x.email === "maria.santos@x.com.br"))
})

test("sem sobrenome, nenhum sobrenome é inventado", () => {
  const g = emailGuesses("Madonna", "x.com.br")
  assert.deepEqual(g.map((x) => x.email), ["madonna@x.com.br"])
})

test("domínio inválido não gera nada", () => {
  assert.deepEqual(emailGuesses("João Silva", "localhost"), [])
  assert.deepEqual(genericGuesses(""), [])
})

test("caixas genéricas ficam separadas das inferências sobre a pessoa", () => {
  const g = genericGuesses("empresa.com.br")
  assert.ok(g.every((x) => x.pattern.startsWith("genérico:")))
  assert.ok(g.some((x) => x.email === "contato@empresa.com.br"))
})
