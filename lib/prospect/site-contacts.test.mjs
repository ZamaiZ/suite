/**
 * Trava a leitura do site da empresa.
 *
 * O CNPJ do rodapé é a única fonte que a cascata trata como CERTA. Um falso
 * positivo aqui não aparece como erro: aparece como uma ficha de empresa com
 * sócios e capital social de outra companhia, e ninguém confere.
 *
 * O HTML dos testes imita o que realmente se encontra em site de empresa
 * local no Brasil: rodapé com CNPJ mascarado, botão de WhatsApp, e-mail de
 * serviço no meio do bundle e telefone escrito de três jeitos.
 */

import test from "node:test"
import assert from "node:assert/strict"

import {
  extractSiteContacts,
  extractTaxIds,
  mergeSiteFindings,
  SITE_CONTACT_PATHS,
} from "./site-contacts.ts"

const achar = (r, kind) => r.contacts.filter((c) => c.kind === kind)
const chaves = (r, kind) => achar(r, kind).map((c) => c.key)

/* -------------------------------------------------------------------------- */
/*  CNPJ                                                                      */
/* -------------------------------------------------------------------------- */

test("CNPJ mascarado no rodapé é achado", () => {
  const html = `<footer><p>Clínica X — CNPJ 11.222.333/0001-81 — Guarulhos/SP</p></footer>`
  assert.deepEqual(extractTaxIds(html), ["11222333000181"])
})

test("CNPJ cru também é achado", () => {
  assert.deepEqual(extractTaxIds("<p>CNPJ 11222333000181</p>"), [
    "11222333000181",
  ])
})

test("dígito verificador inválido é descartado", () => {
  // Sem esta checagem, o rodapé vira fábrica de CNPJ inventado — e é
  // justamente a fonte que a cascata trata como certa.
  assert.deepEqual(extractTaxIds("<p>CNPJ 11.222.333/0001-99</p>"), [])
})

test("sequência repetida não é CNPJ", () => {
  assert.deepEqual(extractTaxIds("<p>00.000.000/0000-00</p>"), [])
})

test("CEP colado com telefone não vira CNPJ", () => {
  const html = "<p>07097420 telefone 1124612334</p>"
  assert.deepEqual(extractTaxIds(html), [])
})

test("CNPJ dentro de script não conta — bundle tem número de tudo", () => {
  const html = `<script>var x="11.222.333/0001-81"</script><p>oi</p>`
  assert.deepEqual(extractTaxIds(html), [])
})

test("o mesmo CNPJ repetido aparece uma vez", () => {
  const html = `<p>11.222.333/0001-81</p><footer>11222333000181</footer>`
  assert.deepEqual(extractTaxIds(html), ["11222333000181"])
})

/* -------------------------------------------------------------------------- */
/*  WhatsApp — o canal mais quente de uma prospecção local                    */
/* -------------------------------------------------------------------------- */

test("wa.me vira contato com o telefone normalizado", () => {
  const r = extractSiteContacts(
    `<a href="https://wa.me/5511992154880?text=Ol%C3%A1">Fale conosco</a>`,
  )
  const [w] = achar(r, "whatsapp")
  assert.equal(w.key, "5511992154880")
  assert.equal(w.value, "https://wa.me/5511992154880")
  assert.ok(w.confidence >= 90)
})

test("api.whatsapp.com com phone também", () => {
  const r = extractSiteContacts(
    `<a href="https://api.whatsapp.com/send?phone=551124612334">zap</a>`,
  )
  assert.deepEqual(chaves(r, "whatsapp"), ["551124612334"])
})

test("link de WhatsApp sem número não vira contato", () => {
  const r = extractSiteContacts(`<a href="https://wa.me/">zap</a>`)
  assert.equal(achar(r, "whatsapp").length, 0)
})

/* -------------------------------------------------------------------------- */
/*  Redes sociais                                                             */
/* -------------------------------------------------------------------------- */

test("perfis da empresa saem dos links", () => {
  const html = `
    <a href="https://www.instagram.com/clinicax/">Instagram</a>
    <a href="https://www.linkedin.com/company/clinica-x">LinkedIn</a>
    <a href="https://facebook.com/clinicax">Facebook</a>`
  const r = extractSiteContacts(html)
  assert.deepEqual(chaves(r, "instagram"), ["clinicax"])
  assert.deepEqual(chaves(r, "linkedin"), ["clinica-x"])
  assert.deepEqual(chaves(r, "facebook"), ["clinicax"])
})

test("linkedin de pessoa também é lido, no nível /in/", () => {
  const r = extractSiteContacts(
    `<a href="https://linkedin.com/in/joao-silva-123">O dono</a>`,
  )
  assert.deepEqual(chaves(r, "linkedin"), ["joao-silva-123"])
})

test("link de compartilhar não é perfil de ninguém", () => {
  const html = `
    <a href="https://www.facebook.com/sharer/sharer.php?u=x">Compartilhar</a>
    <a href="https://www.instagram.com/p/ABC123/">post</a>`
  const r = extractSiteContacts(html)
  assert.equal(achar(r, "facebook").length, 0)
  assert.equal(achar(r, "instagram").length, 0)
})

/* -------------------------------------------------------------------------- */
/*  E-mail                                                                    */
/* -------------------------------------------------------------------------- */

test("mailto vale mais que e-mail solto no texto", () => {
  const html = `
    <a href="mailto:contato@clinicax.com.br">E-mail</a>
    <p>ou escreva para vendas@clinicax.com.br</p>`
  const r = extractSiteContacts(html, { siteDomain: "clinicax.com.br" })
  const contato = achar(r, "email").find((c) => c.key === "contato@clinicax.com.br")
  const vendas = achar(r, "email").find((c) => c.key === "vendas@clinicax.com.br")
  assert.ok(contato.confidence > vendas.confidence)
})

test("e-mail em domínio de terceiro vale menos que no próprio", () => {
  const html = `<p>contato@clinicax.com.br e contador@escritorio.com.br</p>`
  const r = extractSiteContacts(html, { siteDomain: "clinicax.com.br" })
  const proprio = achar(r, "email").find((c) => c.key.endsWith("@clinicax.com.br"))
  const terceiro = achar(r, "email").find((c) => c.key.endsWith("@escritorio.com.br"))
  assert.ok(proprio.confidence > terceiro.confidence)
})

test("e-mail de serviço não entra — o SDR mandaria proposta para o Sentry", () => {
  const html = `<p>abc@sentry.io noreply@clinicax.com.br contato@clinicax.com.br</p>`
  const r = extractSiteContacts(html, { siteDomain: "clinicax.com.br" })
  assert.deepEqual(chaves(r, "email"), ["contato@clinicax.com.br"])
})

/* -------------------------------------------------------------------------- */
/*  Telefone                                                                  */
/* -------------------------------------------------------------------------- */

test("tel: vale mais que telefone escrito no texto", () => {
  const html = `
    <a href="tel:+5511992154880">Ligue</a>
    <p>ou (11) 2461-2334</p>`
  const r = extractSiteContacts(html)
  const doLink = achar(r, "phone").find((c) => c.key === "5511992154880")
  const doTexto = achar(r, "phone").find((c) => c.key === "551124612334")
  assert.ok(doLink.confidence > doTexto.confidence)
})

test("o mesmo telefone em link e texto aparece uma vez só", () => {
  const html = `<a href="tel:+551124612334">x</a><p>(11) 2461-2334</p>`
  const r = extractSiteContacts(html)
  assert.equal(achar(r, "phone").length, 1)
})

/* -------------------------------------------------------------------------- */
/*  found                                                                     */
/* -------------------------------------------------------------------------- */

test("página sem nada marca found = false, que NÃO é falha", () => {
  const r = extractSiteContacts("<html><body><h1>Bem-vindo</h1></body></html>")
  assert.equal(r.found, false)
  assert.equal(r.taxIds.length, 0)
  assert.equal(r.contacts.length, 0)
})

test("só o CNPJ já basta para found", () => {
  const r = extractSiteContacts("<footer>CNPJ 11.222.333/0001-81</footer>")
  assert.equal(r.found, true)
})

/* -------------------------------------------------------------------------- */
/*  Várias páginas do mesmo site                                              */
/* -------------------------------------------------------------------------- */

test("juntar páginas não duplica contato nem CNPJ", () => {
  const home = extractSiteContacts(
    `<a href="mailto:contato@x.com.br">e</a><footer>11.222.333/0001-81</footer>`,
  )
  const contato = extractSiteContacts(
    `<a href="mailto:contato@x.com.br">e</a><p>11222333000181</p>
     <a href="https://wa.me/5511992154880">z</a>`,
  )
  const j = mergeSiteFindings([home, contato])
  assert.deepEqual(j.taxIds, ["11222333000181"])
  assert.equal(achar(j, "email").length, 1)
  assert.equal(achar(j, "whatsapp").length, 1)
})

test("os caminhos de segunda visita são poucos e escolhidos", () => {
  // `crawlWebsite` faria ~15 requisições por site; mil sites seriam 15 mil.
  assert.ok(SITE_CONTACT_PATHS.length <= 8)
  assert.ok(SITE_CONTACT_PATHS.includes("/contato"))
})
