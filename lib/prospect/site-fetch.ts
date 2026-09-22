import "server-only"

import {
  PROSPECT_USER_AGENT,
  safeFetch,
} from "@/lib/website-audit/fetch"
import { parseRobotsGroups, robotsBlocksPath } from "@/lib/website-audit/robots"

import {
  extractSiteContacts,
  mergeSiteFindings,
  SITE_CONTACT_PATHS,
  type SiteFindings,
} from "./site-contacts"

/**
 * A visita ao site da empresa — o transporte da etapa `site`.
 *
 * Três diferenças deliberadas em relação ao `crawlWebsite` de
 * `lib/website-audit/crawl.ts`, que é a ferramenta de auditar cliente:
 *
 * **1. Não usa o `crawlWebsite`.** Aquele faz quatro HEAD de variantes, mais
 * robots, mais sitemap, mais até oito páginas: cerca de quinze requisições por
 * site. Para mil sites seriam quinze mil. Aqui são no máximo três.
 *
 * **2. Obedece o robots.txt.** `robotsBlocksPath` já existia em
 * `lib/website-audit/robots.ts`, mas nunca era chamado antes de um fetch — só
 * servia para *relatar* se o Googlebot estava bloqueado. Auditar o site de um
 * cliente que contratou a agência é uma coisa; visitar mil desconhecidos é
 * outra, e ali o `Disallow` é uma resposta, não um detalhe.
 *
 * **3. Se identifica.** User agent próprio, em vez do de Chrome.
 *
 * Bloqueio por robots vira `blocked`, que o chamador grava como `done` com
 * `found = false` — rodou e não achou, não falhou. Retentar um `Disallow` é
 * insistir contra uma resposta clara.
 */

const MAX_EXTRA_PAGES = 2

export type FetchSiteResult =
  | { status: "ok"; findings: SiteFindings; pagesFetched: number }
  | { status: "blocked"; reason: string }
  | { status: "error"; message: string }

async function loadRobots(origin: string) {
  const fetched = await safeFetch(`${origin}/robots.txt`, "GET", {
    userAgent: PROSPECT_USER_AGENT,
  })
  // Sem robots.txt, ou com ele inacessível, o padrão da web é permitir. Não é
  // o mesmo que um `Disallow`, e tratar assim travaria a maioria dos sites de
  // empresa local, que não publicam robots.
  if (fetched.status !== "ok") return []
  return parseRobotsGroups(fetched.body.slice(0, 10_000))
}

export async function fetchSiteFindings(
  domain: string,
): Promise<FetchSiteResult> {
  const origin = `https://${domain}`
  let root: URL
  try {
    root = new URL(origin)
  } catch {
    return { status: "error", message: "Domínio inválido." }
  }

  const robots = await loadRobots(root.origin)
  const bloqueado = (path: string) =>
    robotsBlocksPath(robots, PROSPECT_USER_AGENT, path)

  if (bloqueado("/")) {
    return { status: "blocked", reason: "robots.txt" }
  }

  const home = await safeFetch(root.origin, "GET", {
    userAgent: PROSPECT_USER_AGENT,
  })
  if (home.status !== "ok") {
    return { status: "error", message: home.message }
  }

  const partes: SiteFindings[] = [
    extractSiteContacts(home.body, { siteDomain: domain }),
  ]
  let pagesFetched = 1

  // Segunda visita só se a home não entregou o CNPJ. Em site de empresa local
  // ele quase nunca está na home: mora no rodapé da página de contato ou na
  // política de privacidade.
  if (partes[0].taxIds.length === 0) {
    let extras = 0
    for (const path of SITE_CONTACT_PATHS) {
      if (extras >= MAX_EXTRA_PAGES) break
      if (bloqueado(path)) continue
      // Sequencial, e não em paralelo: uma requisição por vez por host. Abrir
      // três conexões simultâneas no servidor de uma clínica é a diferença
      // entre coleta e incômodo.
      const pagina = await safeFetch(`${root.origin}${path}`, "GET", {
        userAgent: PROSPECT_USER_AGENT,
      })
      extras += 1
      pagesFetched += 1
      if (pagina.status !== "ok") continue
      const achado = extractSiteContacts(pagina.body, { siteDomain: domain })
      partes.push(achado)
      if (achado.taxIds.length > 0) break
    }
  }

  return {
    status: "ok",
    findings: mergeSiteFindings(partes),
    pagesFetched,
  }
}
