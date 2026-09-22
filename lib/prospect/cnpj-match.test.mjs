/**
 * Trava a cascata do CNPJ.
 *
 * O que esta suíte impede é um tipo de erro que NÃO aparece como erro: uma
 * ficha de empresa com sócios e capital social de outra companhia, apresentada
 * com segurança, que ninguém confere porque a tela não deixou dúvida.
 *
 * Por isso os casos aqui são quase todos de RECUSA: nome parecido em outra
 * cidade, empate entre dois candidatos, cadastro baixado.
 */

import test from "node:test"
import assert from "node:assert/strict"

import {
  AMBIGUOUS_CONFIDENCE,
  canAutoConfirm,
  confidenceBand,
  nameSimilarity,
  rankCandidates,
  scoreCandidate,
} from "./cnpj-match.ts"

const mapa = (over = {}) => ({
  title: "Dr. Negreiros Odontologia",
  phoneE164: "5511992154880",
  zip: "07143000",
  streetNumber: "230",
  city: "Guarulhos",
  domain: "drnegreiros.com.br",
  ...over,
})

const ficha = (over = {}) => ({
  taxId: "11222333000181",
  legalName: "NEGREIROS ODONTOLOGIA LTDA",
  tradeName: "Dr. Negreiros Odontologia",
  shareCapital: 50000,
  size: "ME",
  legalNature: null,
  mainActivity: null,
  secondaryActivities: [],
  registrationStatus: "ATIVA",
  openedAt: "2015-03-01",
  simples: true,
  mei: false,
  zip: "07143000",
  streetNumber: "230",
  city: "Guarulhos",
  state: "SP",
  phones: ["5511992154880"],
  emails: [],
  partners: [],
  sourceUpdatedAt: null,
  ...over,
})

/* -------------------------------------------------------------------------- */
/*  Similaridade                                                              */
/* -------------------------------------------------------------------------- */

test("razão social e nome fantasia da mesma empresa se parecem", () => {
  assert.ok(nameSimilarity("OTICA DINIZ LTDA ME", "Ótica Diniz") > 0.9)
})

test("empresas diferentes não se parecem", () => {
  assert.ok(nameSimilarity("Padaria Pão Quente", "Auto Peças Silva") < 0.3)
})

test("MEI: razão social é o nome civil e não se parece com a placa", () => {
  // É a limitação estrutural do match por nome no Brasil: cerca de 70% dos
  // CNPJs ativos são MEI, e a razão social de um MEI é o nome da pessoa.
  const s = nameSimilarity("JOAO DA SILVA 12345678900", "Ótica Diniz")
  assert.ok(s < 0.2, `similaridade foi ${s}`)
})

/* -------------------------------------------------------------------------- */
/*  Pontuação                                                                 */
/* -------------------------------------------------------------------------- */

test("CNPJ do rodapé com tudo conferindo chega ao topo", () => {
  const c = scoreCandidate(mapa(), ficha(), "cnpj_site")
  assert.equal(c.confidence, 100)
  assert.equal(c.conflicts.length, 0)
  assert.ok(c.reason.includes("telefone confere"))
})

test("busca que casa SÓ pelo nome não sai da gaveta", () => {
  // No Brasil a mesma placa existe em toda cidade. Nome batendo, sem telefone,
  // sem CEP e sem cidade, é o caso clássico do agregador devolver a unidade de
  // outro município.
  const c = scoreCandidate(
    mapa({ phoneE164: null, zip: null, city: null, domain: null }),
    ficha({ phones: [], zip: null, city: null }),
    "serp_aggregator",
  )
  assert.ok(c.confidence <= 55, `confiança foi ${c.confidence}`)
  assert.equal(confidenceBand(c.confidence), "uncertain")
})

test("busca sem nada que corrobore fica sem faixa nenhuma", () => {
  const c = scoreCandidate(
    mapa({ title: "Padaria Pão Quente", phoneE164: null, zip: null, city: null, domain: null }),
    ficha({ phones: [], zip: null, city: null }),
    "serp_aggregator",
  )
  assert.equal(confidenceBand(c.confidence), "none")
})

test("busca corroborada por telefone e CEP vira provável", () => {
  const c = scoreCandidate(mapa(), ficha(), "serp_aggregator")
  assert.ok(c.confidence >= 80)
  assert.ok(c.reason.includes("telefone confere"))
  assert.ok(c.reason.includes("CEP confere"))
})

test("nome parecido em OUTRA cidade despenca", () => {
  // O erro mais comum de busca por agregador: a franquia homônima de outro
  // município.
  const c = scoreCandidate(
    mapa({ phoneE164: null, zip: null }),
    ficha({ city: "Campinas", phones: [], zip: null }),
    "serp_aggregator",
  )
  assert.ok(c.conflicts.includes("cadastro é de outra cidade"))
  assert.ok(c.confidence < 60, `confiança foi ${c.confidence}`)
})

test("cadastro baixado é penalizado e o motivo aparece", () => {
  const c = scoreCandidate(
    mapa(),
    ficha({ registrationStatus: "BAIXADA" }),
    "serp_aggregator",
  )
  assert.ok(c.conflicts.some((x) => x.includes("BAIXADA")))
})

test("telefone diferente não derruba, mas é registrado", () => {
  // O telefone da Receita é cadastro, não é comercial, e envelhece. Divergir
  // não prova que é outra empresa.
  const c = scoreCandidate(mapa(), ficha({ phones: ["551133334444"] }), "cnpj_site")
  assert.ok(c.conflicts.includes("telefone diferente do cadastro"))
  assert.ok(c.confidence >= 80, "o auto-declarado continua valendo")
})

test("número do logradouro só soma quando o CEP já bate", () => {
  // Base fraca de propósito: com tudo conferindo o score estoura o teto de 100
  // e a diferença some — o que esconderia uma regra quebrada.
  const fraco = { phoneE164: null, domain: null, title: "Consultório" }
  const comNumero = scoreCandidate(mapa(fraco), ficha({ phones: [] }), "serp_aggregator")
  const semNumero = scoreCandidate(
    mapa({ ...fraco, streetNumber: null }),
    ficha({ phones: [] }),
    "serp_aggregator",
  )
  assert.ok(
    comNumero.confidence > semNumero.confidence,
    `${comNumero.confidence} deveria passar de ${semNumero.confidence}`,
  )

  // E não soma quando o CEP diverge: número igual em CEP diferente é
  // coincidência, não endereço.
  const cepDiferente = scoreCandidate(
    mapa(fraco),
    ficha({ phones: [], zip: "01310100" }),
    "serp_aggregator",
  )
  assert.ok(!cepDiferente.signals.some((s) => s.reason === "número confere"))
})

test("e-mail do cadastro no domínio do site é corroboração", () => {
  const fraco = { phoneE164: null, zip: null }
  const com = scoreCandidate(
    mapa(fraco),
    ficha({ phones: [], zip: null, emails: ["contato@drnegreiros.com.br"] }),
    "serp_aggregator",
  )
  const sem = scoreCandidate(
    mapa(fraco),
    ficha({ phones: [], zip: null }),
    "serp_aggregator",
  )
  assert.ok(
    com.confidence > sem.confidence,
    `${com.confidence} deveria passar de ${sem.confidence}`,
  )
})

test("no CNPJ do rodapé, nome divergente não vira conflito", () => {
  // MEI publica o próprio CNPJ no site, e a razão social é o nome civil.
  const c = scoreCandidate(
    mapa(),
    ficha({ legalName: "JOAO DA SILVA 12345678900", tradeName: null }),
    "cnpj_site",
  )
  assert.ok(!c.conflicts.includes("nome não se parece com a razão social"))
})

/* -------------------------------------------------------------------------- */
/*  Ambiguidade                                                               */
/* -------------------------------------------------------------------------- */

test("empate não elege ninguém — vira pergunta para o SDR", () => {
  const a = scoreCandidate(mapa(), ficha({ taxId: "11222333000181" }), "serp_aggregator")
  const b = scoreCandidate(mapa(), ficha({ taxId: "11444777000161" }), "serp_aggregator")
  const r = rankCandidates([a, b])

  assert.equal(r.ambiguous, true)
  assert.equal(r.best, null)
  assert.equal(r.found, false, "ambíguo é 'rodou e não achou', não falha")
  assert.ok(
    r.candidates.every((c) => c.confidence <= AMBIGUOUS_CONFIDENCE),
    "a confiança é travada abaixo do limiar de exibição",
  )
  assert.equal(r.candidates.length, 2, "os dois ficam visíveis na gaveta")
})

test("vantagem folgada elege", () => {
  const forte = scoreCandidate(mapa(), ficha(), "cnpj_site")
  const fraco = scoreCandidate(
    mapa({ phoneE164: null, zip: null, city: null, domain: null }),
    ficha({ taxId: "11444777000161", phones: [], zip: null, city: null }),
    "serp_aggregator",
  )
  const r = rankCandidates([forte, fraco])
  assert.equal(r.ambiguous, false)
  assert.equal(r.best.taxId, "11222333000181")
  assert.equal(r.found, true)
})

test("o mesmo CNPJ por dois caminhos não é empate", () => {
  const a = scoreCandidate(mapa(), ficha(), "cnpj_site")
  const b = scoreCandidate(mapa(), ficha(), "serp_aggregator")
  const r = rankCandidates([a, b])
  assert.equal(r.ambiguous, false)
  assert.equal(r.best.method, "cnpj_site", "o auto-declarado ganha")
})

test("nenhum candidato não é erro", () => {
  const r = rankCandidates([])
  assert.equal(r.found, false)
  assert.equal(r.best, null)
  assert.equal(r.ambiguous, false)
})

/* -------------------------------------------------------------------------- */
/*  Faixas e gravação automática                                              */
/* -------------------------------------------------------------------------- */

test("as faixas separam o que vai ao card do que fica na ficha", () => {
  assert.equal(confidenceBand(95), "confirmed")
  assert.equal(confidenceBand(70), "likely")
  assert.equal(confidenceBand(45), "uncertain")
  assert.equal(confidenceBand(20), "none")
})

test("só o CNPJ publicado pela empresa é gravado sem humano", () => {
  const doSite = scoreCandidate(mapa(), ficha(), "cnpj_site")
  const daBusca = scoreCandidate(mapa(), ficha(), "serp_aggregator")

  assert.equal(canAutoConfirm(doSite), true)
  // Mesmo com 85 pontos: continua sendo inferência nossa.
  assert.equal(canAutoConfirm(daBusca), false)
  assert.equal(canAutoConfirm(null), false)
})
