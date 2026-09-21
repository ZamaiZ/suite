/**
 * Trava a lista canônica de concorrentes contra as duas fontes reais.
 *
 * O caso que funda esta task está no teste "a SERP salva a lista que o
 * competitors_domain estragaria": para o mesmo cliente, no mesmo dia, a SERP de
 * `loja de tintas em itu` trouxe três lojas de tinta e o `competitors_domain`
 * trouxe Instagram, YouTube, bases de CNPJ e o próprio cliente.
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import test from "node:test"
import assert from "node:assert/strict"

import { mapCompetitorsDomain } from "../dataforseo/competitors-domain.ts"
import {
  advantageRows,
  contestedRows,
  gapRows,
  mapDomainIntersection,
} from "../dataforseo/domain-intersection.ts"
import { mapSerpOrganic, overlapUrls } from "../dataforseo/serp-organic.ts"
import {
  baseLabel,
  buildCompetitorList,
  isPlatform,
} from "./competitor-sources.ts"

const aqui = dirname(fileURLToPath(import.meta.url))
const ler = (nome) =>
  JSON.parse(readFileSync(join(aqui, "..", "dataforseo", nome), "utf8"))

const serp = mapSerpOrganic(ler("serp-organic.fixture.json"))
const concorrentesLabs = mapCompetitorsDomain(ler("competitors-domain.fixture.json"))
const intersecao = mapDomainIntersection(ler("domain-intersection.fixture.json"))

const SELF = "leotintas.com.br"

/* -------------------------------------------------------------------------- */
/*  Rótulo base — o próprio domínio em três formas                            */
/* -------------------------------------------------------------------------- */

test("reconhece as variações do próprio domínio", () => {
  // As três apareceram na medição, e o competitors_domain listou duas delas
  // como concorrentes do cliente.
  assert.equal(baseLabel("leotintas.com.br"), "leotintas")
  assert.equal(baseLabel("leotintas.com"), "leotintas")
  assert.equal(baseLabel("loja.leotintas.com.br"), "leotintas")
  assert.equal(baseLabel("www.leotintas.com.br"), "leotintas")
  assert.equal(baseLabel("https://leotintas.com.br/pagina"), "leotintas")
})

test("plataforma é reconhecida em qualquer forma", () => {
  assert.ok(isPlatform("instagram.com"))
  assert.ok(isPlatform("www.instagram.com"))
  assert.ok(isPlatform("cnpj.biz"))
  assert.ok(isPlatform("serasaexperian.com.br"))
  assert.ok(!isPlatform("segtintas.com.br"))
  assert.ok(!isPlatform("grupoitutintas.com.br"))
})

/* -------------------------------------------------------------------------- */
/*  O caso que funda a task                                                   */
/* -------------------------------------------------------------------------- */

test("o competitors_domain sozinho não devolve loja de tinta nenhuma", () => {
  const dominios = concorrentesLabs.map((c) => c.domain)
  assert.ok(dominios.includes("instagram.com"))
  assert.ok(dominios.includes("cnpj.biz"))
  assert.ok(dominios.includes(SELF)) // o próprio cliente na lista dos concorrentes dele
  const reais = dominios.filter((d) => !isPlatform(d) && baseLabel(d) !== "leotintas")
  assert.equal(reais.length, 0)
})

test("a SERP salva a lista que o competitors_domain estragaria", () => {
  const lista = buildCompetitorList({
    selfDomain: SELF,
    serps: [{ keyword: serp.keyword, domains: serp.organic.map((o) => o.domain) }],
    fromCompetitorsDomain: concorrentesLabs.map((c) => ({
      domain: c.domain,
      intersections: c.intersections,
      avgPosition: c.avgPosition,
    })),
  })

  const referencia = lista.reference.map((c) => c.domain)
  assert.ok(referencia.includes("segtintas.com.br"))
  assert.ok(referencia.includes("itutintas.com.br"))
  assert.ok(referencia.includes("grupoitutintas.com.br"))

  // E nenhuma plataforma nem o próprio cliente chega à referência.
  assert.ok(lista.reference.every((c) => !c.isPlatform && !c.isSelf))
})

test("nada é descartado — plataforma e o próprio seguem em `all`, marcados", () => {
  const lista = buildCompetitorList({
    selfDomain: SELF,
    serps: [{ keyword: serp.keyword, domains: serp.organic.map((o) => o.domain) }],
    fromCompetitorsDomain: concorrentesLabs.map((c) => ({
      domain: c.domain,
      intersections: c.intersections,
      avgPosition: c.avgPosition,
    })),
  })

  const instagram = lista.all.find((c) => baseLabel(c.domain) === "instagram")
  assert.equal(instagram.isPlatform, true)

  const proprio = lista.all.find((c) => c.isSelf)
  assert.equal(baseLabel(proprio.domain), "leotintas")
  // "Quem ocupa a SERP da minha marca" é informação, às vezes a mais acionável.
  assert.ok(lista.all.length > lista.reference.length)
})

/* -------------------------------------------------------------------------- */
/*  Ordenação e origem                                                        */
/* -------------------------------------------------------------------------- */

test("quem aparece em mais SERPs-alvo vem primeiro", () => {
  const lista = buildCompetitorList({
    selfDomain: SELF,
    serps: [
      { keyword: "kw a", domains: ["a.com.br", "b.com.br"] },
      { keyword: "kw b", domains: ["b.com.br", "c.com.br"] },
      { keyword: "kw c", domains: ["b.com.br"] },
    ],
  })
  assert.equal(lista.reference[0].domain, "b.com.br")
  assert.equal(lista.reference[0].serpAppearances, 3)
})

test("domínio repetido na mesma SERP conta uma vez", () => {
  const lista = buildCompetitorList({
    selfDomain: SELF,
    serps: [{ keyword: "kw", domains: ["a.com.br", "www.a.com.br", "a.com.br"] }],
  })
  const a = lista.all.find((c) => baseLabel(c.domain) === "a")
  assert.equal(a.serpAppearances, 1)
})

test("origem acumula quando o domínio vem de mais de uma fonte", () => {
  const lista = buildCompetitorList({
    selfDomain: SELF,
    serps: [{ keyword: "kw", domains: ["segtintas.com.br"] }],
    fromCompetitorsDomain: [
      { domain: "segtintas.com.br", intersections: 7, avgPosition: 3 },
    ],
    fromLocalPack: ["segtintas.com.br"],
  })
  const seg = lista.all.find((c) => baseLabel(c.domain) === "segtintas")
  assert.deepEqual(seg.sources.sort(), [
    "competitors_domain",
    "local_pack",
    "serp",
  ])
  assert.equal(seg.intersections, 7)
})

test("citado pelo cliente que não aparece em fonte medida vira achado", () => {
  const lista = buildCompetitorList({
    selfDomain: SELF,
    serps: [{ keyword: "kw", domains: ["segtintas.com.br"] }],
    fromBriefing: ["segtintas.com.br", "concorrenteinvisivel.com.br"],
  })
  assert.deepEqual(lista.claimedOnly, ["concorrenteinvisivel.com.br"])
  // Continua na lista, marcado com a origem — não some.
  const invisivel = lista.all.find(
    (c) => baseLabel(c.domain) === "concorrenteinvisivel",
  )
  assert.deepEqual(invisivel.sources, ["briefing"])
})

test("o teto de referência é respeitado", () => {
  const muitos = Array.from({ length: 12 }, (_, i) => `loja${i}.com.br`)
  const lista = buildCompetitorList(
    { selfDomain: SELF, serps: [{ keyword: "kw", domains: muitos }] },
    3,
  )
  assert.equal(lista.reference.length, 3)
  assert.equal(lista.all.length, 12)
})

/* -------------------------------------------------------------------------- */
/*  Keyword gap                                                               */
/* -------------------------------------------------------------------------- */

test("lê a intersecção real com os dois lados", () => {
  assert.ok(intersecao.length > 0)
  const leo = intersecao.find((r) => r.keyword === "léo tintas")
  assert.equal(leo.searchVolume, 590)
  assert.equal(leo.selfRank, 40)
  assert.equal(leo.competitorRank, 4)
})

test("gap, disputa e vantagem são três coisas diferentes", () => {
  const linhas = [
    { keyword: "só o concorrente", selfRank: null, competitorRank: 3 },
    { keyword: "os dois", selfRank: 40, competitorRank: 4 },
    { keyword: "só o cliente", selfRank: 2, competitorRank: null },
  ]
  assert.deepEqual(gapRows(linhas).map((r) => r.keyword), ["só o concorrente"])
  assert.deepEqual(contestedRows(linhas).map((r) => r.keyword), ["os dois"])
  assert.deepEqual(advantageRows(linhas).map((r) => r.keyword), ["só o cliente"])
})

test("disputa ordena por onde o empurrão rende mais", () => {
  const linhas = [
    { keyword: "longe", selfRank: 50, competitorRank: 2 },
    { keyword: "perto", selfRank: 5, competitorRank: 4 },
  ]
  // "perto" primeiro: distância de 1 posição, contra 48.
  assert.deepEqual(contestedRows(linhas).map((r) => r.keyword), ["perto", "longe"])
})

/* -------------------------------------------------------------------------- */
/*  Entrada hostil                                                            */
/* -------------------------------------------------------------------------- */

test("sem fonte nenhuma, lista vazia e não erro", () => {
  const lista = buildCompetitorList({ selfDomain: SELF, serps: [] })
  assert.deepEqual(lista.all, [])
  assert.deepEqual(lista.reference, [])
  assert.deepEqual(lista.claimedOnly, [])
})

test("mapeadores com envelope inválido devolvem lista vazia", () => {
  for (const lixo of [null, 42, {}, { tasks: [{ status_code: 40501 }] }]) {
    assert.deepEqual(mapCompetitorsDomain(lixo), [])
    assert.deepEqual(mapDomainIntersection(lixo), [])
  }
})

test("as URLs da mesma SERP alimentam o clustering sem passar por domínio", () => {
  // Amarra as duas leituras: concorrente sai de `domain`, cluster sai de `url`.
  const urls = overlapUrls(serp)
  assert.ok(urls.every((u) => u.startsWith("http")))
  assert.equal(new Set(urls).size, urls.length)
})
