/**
 * Trava a leitura da ficha de CNPJ, contra payload REAL.
 *
 * O que sai daqui vai direto para a tela como fato sobre uma empresa: capital
 * social, sócios, situação cadastral. Errar o parsing não produz exceção —
 * produz um número plausível e falso, que ninguém confere.
 *
 * A fixture foi capturada em 2026-09-21 de `api.opencnpj.org`.
 */

import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import { parseBrNumber, parseCnpjPayload } from "./payload.ts"

const AQUI = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(readFileSync(join(AQUI, "payload.fixture.json"), "utf8"))

const OKBR = fixture.payloads["19131243000197"]
const BB = fixture.payloads["00000000000191"]

/* -------------------------------------------------------------------------- */
/*  Número em formato brasileiro                                              */
/* -------------------------------------------------------------------------- */

test("capital social vem como string brasileira, não como número", () => {
  // `Number("120000000000,00")` é NaN. O campo chega assim do provedor.
  assert.equal(parseBrNumber("120000000000,00"), 120000000000)
  assert.equal(parseBrNumber("0,00"), 0)
})

test("ponto de milhar não vira decimal", () => {
  // Este é o erro perigoso: `Number("1.234,56")` dá NaN, mas `parseFloat` dá
  // 1.234 — um número plausível, mil vezes menor, que vai para a tela.
  assert.equal(parseBrNumber("1.234,56"), 1234.56)
  assert.equal(parseBrNumber("1.500.000,00"), 1500000)
})

test("número que já vem número passa", () => {
  assert.equal(parseBrNumber(50000), 50000)
})

test("lixo vira ausência, não zero", () => {
  // Zero significaria "capital social de R$ 0,00", que é uma afirmação.
  assert.equal(parseBrNumber("abc"), null)
  assert.equal(parseBrNumber(null), null)
  assert.equal(parseBrNumber(undefined), null)
})

/* -------------------------------------------------------------------------- */
/*  Ficha completa                                                            */
/* -------------------------------------------------------------------------- */

test("a ficha traz o que o SDR precisa antes de ligar", () => {
  const f = parseCnpjPayload(OKBR)
  assert.ok(f)
  assert.equal(f.taxId, "19131243000197")
  assert.equal(f.legalName, "OPEN KNOWLEDGE BRASIL")
  assert.equal(f.tradeName, "REDE PELO CONHECIMENTO LIVRE")
  assert.equal(f.registrationStatus, "Ativa")
  assert.equal(f.city, "SAO PAULO")
  assert.equal(f.state, "SP")
  assert.equal(f.zip, "01311902")
  assert.equal(f.openedAt, "2013-10-03")
})

test("capital social de bilhões não perde escala", () => {
  const f = parseCnpjPayload(BB)
  assert.equal(f.shareCapital, 120000000000)
})

test("CNAE principal e secundários saem separados", () => {
  const f = parseCnpjPayload(OKBR)
  assert.equal(f.mainActivity.code, "9430800")
  assert.ok(f.mainActivity.text.length > 0)
  assert.ok(f.secondaryActivities.length >= 5)
  assert.ok(
    !f.secondaryActivities.some((c) => c.code === f.mainActivity.code),
    "o principal não se repete nos secundários",
  )
})

/* -------------------------------------------------------------------------- */
/*  Telefones                                                                 */
/* -------------------------------------------------------------------------- */

test("telefone vira E.164 juntando DDD e número", () => {
  const f = parseCnpjPayload(OKBR)
  assert.deepEqual(f.phones, ["551123851939"])
})

test("fax não entra — discar para um desqualifica o lead", () => {
  const f = parseCnpjPayload(BB)
  // O Banco do Brasil tem dois: 34939002 e o fax 34931040.
  assert.deepEqual(f.phones, ["556134939002"])
})

/* -------------------------------------------------------------------------- */
/*  QSA                                                                       */
/* -------------------------------------------------------------------------- */

test("o QSA traz nome, qualificação e entrada", () => {
  const f = parseCnpjPayload(OKBR)
  const [socio] = f.partners
  assert.equal(socio.name, "HAYDEE SVAB")
  assert.equal(socio.qualification, "Presidente")
  assert.equal(socio.since, "2024-02-27")
  assert.equal(socio.isCompany, false)
})

test("o CPF fica mascarado, como a Receita publica", () => {
  const f = parseCnpjPayload(OKBR)
  assert.equal(f.partners[0].maskedTaxId, "***112108**")
  assert.ok(f.partners[0].maskedTaxId.includes("*"))
})

test("faixa etária NÃO é carregada", () => {
  // Existe no payload e é atributo pessoal sem valor de prospecção. Guardar
  // dado que não se usa só aumenta a exposição.
  assert.ok("faixa_etaria" in OKBR.QSA[0], "o provedor manda")
  const f = parseCnpjPayload(OKBR)
  assert.equal("faixaEtaria" in f.partners[0], false, "e nós não guardamos")
  assert.equal(JSON.stringify(f).includes("41 a 50"), false)
})

test("sócio pessoa jurídica é marcado como tal", () => {
  const f = parseCnpjPayload({
    ...OKBR,
    QSA: [{ nome_socio: "HOLDING X LTDA", identificador_socio: "Pessoa Jurídica" }],
  })
  assert.equal(f.partners[0].isCompany, true)
})

/* -------------------------------------------------------------------------- */
/*  Defesa                                                                    */
/* -------------------------------------------------------------------------- */

test("CNPJ inválido no payload derruba a ficha inteira", () => {
  // Melhor não afirmar nada do que afirmar sobre um CNPJ que não existe.
  assert.equal(parseCnpjPayload({ ...OKBR, cnpj: "11111111111111" }), null)
  assert.equal(parseCnpjPayload({}), null)
  assert.equal(parseCnpjPayload(null), null)
})

test("campo ausente vira null, não string vazia", () => {
  const f = parseCnpjPayload({ cnpj: "19131243000197" })
  assert.ok(f)
  assert.equal(f.legalName, null)
  assert.equal(f.shareCapital, null)
  assert.deepEqual(f.phones, [])
  assert.deepEqual(f.partners, [])
})

test("'SN' no número do logradouro é ausência", () => {
  const f = parseCnpjPayload(BB)
  assert.equal(f.streetNumber, null)
})

test("S e N viram booleano; vazio vira 'não informado'", () => {
  const sim = parseCnpjPayload({ ...OKBR, opcao_mei: "S" })
  const nao = parseCnpjPayload({ ...OKBR, opcao_mei: "N" })
  const vazio = parseCnpjPayload({ ...OKBR, opcao_mei: "" })
  assert.equal(sim.mei, true)
  assert.equal(nao.mei, false)
  assert.equal(vazio.mei, null, "vazio não é 'não'")
})
