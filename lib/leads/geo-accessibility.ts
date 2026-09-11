/**
 * As sete regras de acesso a motores generativos, sobre o crawl já gravado.
 *
 * Seis delas não exigem uma linha de coleta nova: `AI_USER_AGENTS` já carrega
 * doze agentes com bloqueio avaliado por agente desde a coleta ampliada,
 * `llmsTxt` já traz `found` e `status`, e `x-robots-tag` já é interpretado.
 * A sétima — conteúdo dependente de JavaScript — é derivação do `wordCount`
 * que o crawler já conta.
 */

import { GEO_SERVER_RENDERED_MIN_WORDS, type GeoAccessibility } from "./geo-audit.ts"
import { websiteHomePage, type WebsiteCrawl } from "./website-audit.ts"

/** Os mesmos que a etapa de website usa para `robots_blocks_search`. */
const SEARCH_AGENTS = ["googlebot", "bingbot"] as const

/**
 * O crawl é da coleta ampliada?
 *
 * `llmsTxt`, `robots.groups`, `robots.aiAgents`, `headings` e `variants`
 * chegaram na mesma entrega, e `readWebsiteCrawl` normaliza os ausentes para
 * vazio: `readLlmsTxt(undefined)` devolve `{found: false, status: null}`,
 * **indistinguível de "checamos e não tem"**. Sem esta distinção, todo lead
 * auditado antes daquela entrega ganharia `no_llms_txt` e `no_faq_content` por
 * campos que nunca foram medidos — a mesma classe de erro que `redirects: null`
 * documenta em `website-audit.ts`.
 *
 * `variants` é o discriminador porque o crawler moderno **sonda** as variantes
 * em toda coleta, independente do que o site publica. `groups` e `aiAgents`
 * não servem: um robots.txt legítimo pode deixar os dois vazios.
 *
 * Medido em 2026-09-10 contra os cinco snapshots existentes — os três
 * anteriores a 2026-09-01 têm `variants` ausente, `llmsTxt` ausente, `groups`
 * vazio e `headings` vazio; os dois posteriores têm todos preenchidos.
 */
export function isExtendedCrawl(crawl: WebsiteCrawl): boolean {
  return crawl.variants !== null
}

export function geoAccessibilityFromCrawl(
  crawl: WebsiteCrawl,
): GeoAccessibility {
  const home = websiteHomePage(crawl)
  const aiCrawlers = crawl.robots.aiAgents.map((entry) => ({
    agent: entry.agent,
    blocked: entry.blocked,
  }))
  const words = home?.wordCount ?? 0

  return {
    llmsTxt: {
      found: crawl.llmsTxt.found,
      status: crawl.llmsTxt.status,
    },
    aiCrawlers,
    blockedAiCrawlers: aiCrawlers.filter((entry) => entry.blocked).length,
    searchCrawlersBlocked: SEARCH_AGENTS.some((agent) =>
      crawl.robots.groups.some(
        (group) =>
          (group.userAgents.includes(agent) ||
            group.userAgents.includes("*")) &&
          group.disallow.includes("/"),
      ),
    ),
    sitemap: {
      found: crawl.sitemap.found,
      urlCount: crawl.sitemap.found ? crawl.sitemap.urlCount : null,
    },
    // `indexable` já combina meta robots e `x-robots-tag`; aqui os dois voltam
    // separados porque o relatório de GEO pergunta por cada um.
    noindexTag: home ? !home.indexable : false,
    noindexHeader: home
      ? /noindex/i.test(home.headers["x-robots-tag"] ?? "")
      : false,
    serverRenderedWords: words,
    // Piso de 120, não os 300 de `WEBSITE_THIN_CONTENT_WORDS`: 300 mede
    // conteúdo raso, e a pergunta aqui é se existe casca de SPA, que costuma
    // entregar menos de cinquenta palavras no HTML cru. Vale no crawl antigo
    // também: `wordCount` sempre existiu.
    contentRequiresJs: home !== null && words < GEO_SERVER_RENDERED_MIN_WORDS,
  }
}
