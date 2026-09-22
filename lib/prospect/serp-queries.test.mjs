/**
 * Trava as buscas pagas.
 *
 * Busca mal formada não falha: devolve resultado errado pelo mesmo preço. O
 * caso que esta suíte protege é o das aspas — sem elas o buscador relaxa os
 * termos e traz a franquia de outro município, que é exatamente o erro que o
 * matcher depois gasta 40 pontos para derrubar.
 */

import test from "node:test"
import assert from "node:assert/strict"

import { isValidCnpj } from "../br-documents.ts"
import {
  personQuery,
  primaryPartner,
  socialFromSerpUrl,
  socialQuery,
  taxIdQuery,
  taxIdsFromSerpText,
} from "./serp-queries.ts"

const socio = (over = {}) => ({
  name: "João da Silva",
  maskedTaxId: "***123456**",
  qualification: "Sócio",
  since: "2015-01-01",
  isCompany: false,
  ...over,
})

/* -------------------------------------------------------------------------- */

test("a busca de CNPJ prende nome e cidade entre aspas", () => {
  const q = taxIdQuery({
    title: "Dr. Negreiros Odontologia",
    city: "Guarulhos",
    phoneE164: null,
  })
  assert.ok(q.includes('"Dr. Negreiros Odontologia"'))
  assert.ok(q.includes('"Guarulhos"'))
  assert.ok(q.includes("CNPJ"))
})

test("o telefone entra sem DDI — agregador brasileiro não publica o 55", () => {
  const q = taxIdQuery({
    title: "X",
    city: null,
    phoneE164: "5511992154880",
  })
  assert.ok(q.includes('"11992154880"'))
  assert.ok(!q.includes("5511992154880"))
})

test("aspas dentro do nome não quebram a busca", () => {
  const q = taxIdQuery({ title: 'Loja "A" \n B', city: null, phoneE164: null })
  assert.equal((q.match(/"/g) ?? []).length, 2, "só o par externo")
})

test("uma busca cobre Instagram e LinkedIn — duas dobrariam o custo", () => {
  const q = socialQuery({ title: "Clínica X", city: "Londrina" })
  assert.ok(q.includes("site:instagram.com"))
  assert.ok(q.includes("site:linkedin.com/company"))
})

test("a busca do sócio sempre amarra ao nome da empresa", () => {
  // Sem isso, "João Silva" devolve dez mil pessoas e o SDR aborda um estranho.
  const q = personQuery({
    partnerName: "João da Silva",
    companyName: "Clínica X",
    city: "Guarulhos",
  })
  assert.ok(q.includes('"João da Silva"'))
  assert.ok(q.includes('"Clínica X"'))
  assert.ok(q.includes("site:linkedin.com/in"))
})

/* -------------------------------------------------------------------------- */

test("quem administra vem antes de quem só tem quota", () => {
  const escolhido = primaryPartner([
    socio({ name: "Quotista", qualification: "Sócio" }),
    socio({ name: "Quem Manda", qualification: "Sócio-Administrador" }),
  ])
  assert.equal(escolhido.name, "Quem Manda")
})

test("empate resolve pelo mais antigo, que costuma ser o fundador", () => {
  const escolhido = primaryPartner([
    socio({ name: "Novo", since: "2022-01-01" }),
    socio({ name: "Fundador", since: "2010-01-01" }),
  ])
  assert.equal(escolhido.name, "Fundador")
})

test("sócio pessoa jurídica não é alguém para procurar", () => {
  assert.equal(
    primaryPartner([socio({ name: "HOLDING LTDA", isCompany: true })]),
    null,
  )
  assert.equal(primaryPartner([]), null)
})

/* -------------------------------------------------------------------------- */

test("CNPJ é extraído do título e do trecho do resultado", () => {
  const texto = "Dr. Negreiros - CNPJ 11.222.333/0001-81 | Consulta"
  assert.deepEqual(taxIdsFromSerpText(texto, isValidCnpj), ["11222333000181"])
})

test("número plausível com dígito errado não passa", () => {
  assert.deepEqual(
    taxIdsFromSerpText("CNPJ 11.222.333/0001-99", isValidCnpj),
    [],
  )
})

test("o mesmo CNPJ em título e trecho aparece uma vez", () => {
  const texto = "11.222.333/0001-81 ... 11222333000181"
  assert.deepEqual(taxIdsFromSerpText(texto, isValidCnpj), ["11222333000181"])
})

/* -------------------------------------------------------------------------- */

test("perfis saem da URL do resultado", () => {
  assert.deepEqual(socialFromSerpUrl("https://www.instagram.com/clinicax/"), {
    kind: "instagram",
    key: "clinicax",
  })
  assert.deepEqual(
    socialFromSerpUrl("https://br.linkedin.com/company/clinica-x"),
    { kind: "linkedin", key: "clinica-x" },
  )
  assert.deepEqual(
    socialFromSerpUrl("https://www.linkedin.com/in/joao-silva"),
    { kind: "linkedin", key: "joao-silva" },
  )
})

test("post e URL de terceiro não viram perfil", () => {
  assert.equal(socialFromSerpUrl("https://instagram.com/p/ABC/"), null)
  assert.equal(socialFromSerpUrl("https://linkedin.com/feed"), null)
  assert.equal(socialFromSerpUrl("https://exemplo.com.br"), null)
  assert.equal(socialFromSerpUrl("não é url"), null)
})
