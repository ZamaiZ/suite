/**
 * Trava as chaves de junção.
 *
 * Cada função aqui é usada nos DOIS lados de um match. Quando uma delas muda
 * de um lado só, o match para de acontecer em silêncio — não há erro, só um
 * CNPJ que nunca é encontrado. Estes testes são o único lugar onde esse tipo
 * de quebra aparece.
 */

import test from "node:test"
import assert from "node:assert/strict"

import {
  domainKey,
  emailKey,
  foldText,
  isNoiseEmail,
  nameKey,
  phoneKey,
  phoneVariants,
  streetNumberFromAddress,
  stripCorporateSuffix,
  zipKey,
} from "./normalize.ts"

/* -------------------------------------------------------------------------- */
/*  Texto                                                                     */
/* -------------------------------------------------------------------------- */

test("dobra acento, caixa e pontuação", () => {
  assert.equal(foldText("Ótica Diniz - Guarulhos"), "otica diniz guarulhos")
  assert.equal(foldText("CLÍNICA SÃO JOSÉ"), "clinica sao jose")
})

test("sufixo societário sai do fim do nome", () => {
  assert.equal(stripCorporateSuffix("OTICA DINIZ LTDA ME"), "otica diniz")
  assert.equal(stripCorporateSuffix("Divya Implantes EIRELI"), "divya implantes")
  assert.equal(stripCorporateSuffix("Padaria Pão Quente S/A"), "padaria pao quente")
})

test("sufixo no meio do nome fica — só o fim é descartado", () => {
  assert.equal(stripCorporateSuffix("Ltda Comercio de Tintas"), "ltda comercio de tintas")
})

test("nome que é só sufixo não vira string vazia", () => {
  assert.equal(stripCorporateSuffix("LTDA"), "ltda")
})

test("nameKey casa razão social com nome fantasia", () => {
  assert.equal(nameKey("ÓTICA DINIZ LTDA ME"), nameKey("Otica Diniz"))
})

/* -------------------------------------------------------------------------- */
/*  Telefone — o formato que o provedor devolve de verdade                    */
/* -------------------------------------------------------------------------- */

test("telefone do provedor vira a chave do lead", () => {
  // Formato medido em 2026-09-21: "+551199215-4880".
  assert.equal(phoneKey("+551199215-4880"), "5511992154880")
  assert.equal(phoneKey("+55112461-2334"), "551124612334")
})

test("telefone ausente ou inválido não vira chave", () => {
  assert.equal(phoneKey(null), null)
  assert.equal(phoneKey(""), null)
  assert.equal(phoneKey("123"), null)
})

test("celular novo carrega a variante sem o nono dígito", () => {
  const v = phoneVariants("5511992154880")
  assert.equal(v[0], "5511992154880", "a forma recebida vem primeiro")
  assert.ok(v.includes("551192154880"), "e a antiga, que a Receita ainda guarda")
})

test("celular antigo carrega a variante com o nono dígito", () => {
  const v = phoneVariants("551192154880")
  assert.ok(v.includes("5511992154880"))
})

test("fixo não ganha nono dígito", () => {
  // 2461-2334 começa em 2: é fixo, e inserir 9 inventaria um número.
  const v = phoneVariants("551124612334")
  assert.deepEqual(v, ["551124612334"])
})

test("sem telefone, sem variante", () => {
  assert.deepEqual(phoneVariants(null), [])
})

/* -------------------------------------------------------------------------- */
/*  Endereço                                                                  */
/* -------------------------------------------------------------------------- */

test("CEP só com oito dígitos", () => {
  assert.equal(zipKey("07097-420"), "07097420")
  assert.equal(zipKey("07097420"), "07097420")
  assert.equal(zipKey("0709742"), null)
  assert.equal(zipKey(null), null)
})

test("número sai do endereço de uma linha, não o CEP", () => {
  const endereco =
    "Av. Bartolomeu de Carlos, 230 PISO G1 - Jardim Flor da Montanha, Guarulhos - SP, 07097-420"
  assert.equal(streetNumberFromAddress(endereco), "230")
})

test("número não é procurado no nome da rua", () => {
  // "Rua 25 de Março, 100" — o 25 é nome, o 100 é número.
  assert.equal(streetNumberFromAddress("Rua 25 de Março, 100 - Centro"), "100")
})

test("sem número, sem chave — 'S/N' não casa com 'S/N'", () => {
  assert.equal(streetNumberFromAddress("Rodovia BR-101, S/N"), null)
  assert.equal(streetNumberFromAddress(null), null)
})

test("zero à esquerda não cria dois números diferentes", () => {
  assert.equal(streetNumberFromAddress("Rua A, 0230"), "230")
})

/* -------------------------------------------------------------------------- */
/*  Domínio e e-mail                                                          */
/* -------------------------------------------------------------------------- */

test("domínio perde www, esquema, porta e caminho", () => {
  assert.equal(domainKey("http://www.cocobambu.com.br/"), "cocobambu.com.br")
  assert.equal(domainKey("https://Exemplo.com.BR:443/contato?x=1"), "exemplo.com.br")
})

test("o que não é domínio não vira chave", () => {
  assert.equal(domainKey("localhost"), null)
  assert.equal(domainKey(""), null)
  assert.equal(domainKey(null), null)
})

test("e-mail vira minúscula e recusa o que não é e-mail", () => {
  assert.equal(emailKey(" Contato@Empresa.COM.br "), "contato@empresa.com.br")
  assert.equal(emailKey("contato@empresa"), null)
  assert.equal(emailKey(null), null)
})

test("e-mail de serviço não é contato de ninguém", () => {
  assert.equal(isNoiseEmail("abc@sentry.io"), true)
  assert.equal(isNoiseEmail("algo@sentry.wixpress.com"), true)
  assert.equal(isNoiseEmail("noreply@empresa.com.br"), true)
  assert.equal(isNoiseEmail("2e8f9a1b3c4d5e6f@empresa.com.br"), true)
  assert.equal(isNoiseEmail("logo@2x.png"), true)
})

test("e-mail de verdade passa", () => {
  assert.equal(isNoiseEmail("contato@clinicadrnegreiros.com.br"), false)
})
