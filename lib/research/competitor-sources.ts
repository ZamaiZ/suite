/**
 * As fontes de concorrente → uma lista canônica. Puro.
 *
 * **A SERP manda.** Concorrente é quem disputa a SERP que o cliente quer, não
 * quem se parece com o cliente. A medição que fundou esta regra: para
 * `leotintas.com.br`, a SERP de `loja de tintas em itu` trouxe
 * `segtintas.com.br`, `itutintas.com.br` e `grupoitutintas.com.br` — lojas de
 * tinta de verdade —, enquanto o `competitors_domain` do mesmo cliente
 * devolveu `instagram.com`, `cnpj.biz` e **o próprio domínio do cliente**.
 *
 * E é de graça: a SERP já é coletada para o clustering.
 *
 * Nada é descartado, tudo é **marcado**. Plataforma genérica sai da lista de
 * referência mas continua no relatório, porque "quem ocupa a SERP da minha
 * marca" é informação — às vezes a mais acionável de todas.
 */

import type { CompetitorSource, ResearchCompetitor } from "./types.ts"

/**
 * Sufixos removidos para achar o rótulo principal do domínio.
 *
 * Existe para `leotintas.com.br`, `leotintas.com` e `loja.leotintas.com.br`
 * serem reconhecidos como o mesmo negócio — os três apareceram juntos na
 * medição, e o `competitors_domain` listou duas variações do próprio cliente
 * como concorrentes dele mesmo.
 */
const SUFIXOS = new Set([
  "com", "br", "net", "org", "gov", "edu", "io", "co", "app", "dev", "me",
  "info", "biz", "shop", "store", "site", "online", "tv", "cc", "ltda",
])

/**
 * Plataformas genéricas. A chave é o **rótulo base**, então cobre `.com`,
 * `.com.br` e subdomínio de uma vez.
 *
 * Heurística, e assumidamente incompleta: erra para o lado de deixar passar.
 * Um concorrente real marcado como plataforma é pior que uma plataforma na
 * lista, porque a primeira some da referência e a segunda só faz ruído.
 */
const PLATAFORMAS = new Set([
  // redes sociais
  "instagram", "facebook", "youtube", "twitter", "linkedin", "tiktok",
  "pinterest", "whatsapp", "telegram", "kwai", "threads",
  // diretórios e guias locais
  "listamais", "solutudo", "apontador", "telelistas", "guiamais", "hotfrog",
  "cylex", "kekanto", "encontrabrasil", "infoisinfo", "opendi", "tupalo",
  "brownbook", "foursquare", "waze", "yelp", "guiafacil", "listatudo",
  // bases de CNPJ e crédito
  "cnpj", "cnpja", "casadosdados", "econodata", "serasaexperian", "empresascnpj",
  "consultacnpj", "cnpjbiz", "informecadastral", "escavador", "jusbrasil",
  // marketplaces
  "mercadolivre", "mercadolibre", "amazon", "americanas", "magazineluiza",
  "magalu", "shopee", "olx", "casasbahia", "submarino", "aliexpress",
  "leroymerlin", "telhanorte", "obramax",
  // buscadores, mapas, enciclopédia, reclamação
  "google", "bing", "yahoo", "wikipedia", "reclameaqui", "consumidorgov",
])

/**
 * Rótulo principal do domínio, sem `www` e sem sufixos.
 *
 * `loja.leotintas.com.br` → `leotintas`; `leotintas.com` → `leotintas`.
 */
export function baseLabel(domain: string): string {
  const limpo = String(domain)
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "")

  const partes = limpo.split(".").filter(Boolean)
  while (partes.length > 1 && SUFIXOS.has(partes[partes.length - 1])) {
    partes.pop()
  }
  return partes[partes.length - 1] ?? limpo
}

export function isPlatform(domain: string): boolean {
  return PLATAFORMAS.has(baseLabel(domain))
}

/** Uma SERP já lida, reduzida ao que interessa para contar concorrente. */
export type SerpDomainsInput = {
  keyword: string
  /** Domínios do top 10, na ordem. Repetido conta uma vez por keyword. */
  domains: string[]
}

export type CompetitorListParams = {
  /** Domínio do cliente, como está no briefing. */
  selfDomain: string
  /** Fonte primária: as SERPs das keywords-alvo. */
  serps: SerpDomainsInput[]
  /** Segunda fonte. */
  fromCompetitorsDomain?: {
    domain: string
    intersections: number | null
    avgPosition: number | null
  }[]
  /** Domínios vistos no local pack, quando houver. */
  fromLocalPack?: string[]
  /** O que o cliente citou no briefing, se em forma de domínio. */
  fromBriefing?: string[]
}

export type CompetitorListResult = {
  /** Tudo que apareceu, marcado e ordenado. Nada some. */
  all: ResearchCompetitor[]
  /** Os que alimentam o gap: sem plataforma, sem o próprio, top `limit`. */
  reference: ResearchCompetitor[]
  /** Citados pelo cliente que não apareceram em nenhuma fonte medida. */
  claimedOnly: string[]
}

export function buildCompetitorList(
  params: CompetitorListParams,
  limit = 5,
): CompetitorListResult {
  const selfLabel = baseLabel(params.selfDomain)
  const porDominio = new Map<
    string,
    {
      domain: string
      sources: Set<CompetitorSource>
      serpKeywords: Set<string>
      intersections: number | null
      avgPosition: number | null
    }
  >()

  const garantir = (domain: string) => {
    const chave = baseLabel(domain)
    const existente = porDominio.get(chave)
    if (existente) return existente
    const novo = {
      domain: String(domain).toLowerCase().replace(/^www\./, ""),
      sources: new Set<CompetitorSource>(),
      serpKeywords: new Set<string>(),
      intersections: null as number | null,
      avgPosition: null as number | null,
    }
    porDominio.set(chave, novo)
    return novo
  }

  // 1. Fonte primária: SERP. Um domínio que aparece em várias keywords-alvo é
  //    mais concorrente que um que apareceu numa só.
  for (const serp of params.serps) {
    const vistosNestaKeyword = new Set<string>()
    for (const domain of serp.domains) {
      if (!domain) continue
      const chave = baseLabel(domain)
      if (vistosNestaKeyword.has(chave)) continue
      vistosNestaKeyword.add(chave)
      const acc = garantir(domain)
      acc.sources.add("serp")
      acc.serpKeywords.add(serp.keyword)
    }
  }

  // 2. Segunda fonte.
  for (const item of params.fromCompetitorsDomain ?? []) {
    if (!item?.domain) continue
    const acc = garantir(item.domain)
    acc.sources.add("competitors_domain")
    acc.intersections = item.intersections
    acc.avgPosition = item.avgPosition
  }

  for (const domain of params.fromLocalPack ?? []) {
    if (!domain) continue
    garantir(domain).sources.add("local_pack")
  }

  // 3. Os citados pelo cliente. Quem não aparece em fonte medida vira achado
  //    para o relatório — ou é concorrente offline, ou a mira está errada.
  const claimedOnly: string[] = []
  for (const domain of params.fromBriefing ?? []) {
    if (!domain) continue
    const chave = baseLabel(domain)
    const jaExiste = porDominio.has(chave)
    garantir(domain).sources.add("briefing")
    if (!jaExiste) claimedOnly.push(domain)
  }

  const all: ResearchCompetitor[] = [...porDominio.entries()].map(
    ([chave, acc]) => ({
      domain: acc.domain,
      sources: [...acc.sources],
      serpAppearances: acc.serpKeywords.size > 0 ? acc.serpKeywords.size : null,
      intersections: acc.intersections,
      avgPosition: acc.avgPosition,
      isPlatform: PLATAFORMAS.has(chave),
      isSelf: chave === selfLabel,
    }),
  )

  // Ordem: quem ocupa mais SERPs-alvo primeiro; depois quem disputa mais
  // keywords no geral. Presença na SERP do cliente vale mais que semelhança de
  // perfil, que é a tese inteira desta task.
  all.sort((a, b) => {
    const porSerp = (b.serpAppearances ?? 0) - (a.serpAppearances ?? 0)
    if (porSerp !== 0) return porSerp
    return (b.intersections ?? 0) - (a.intersections ?? 0)
  })

  const reference = all
    .filter((c) => !c.isSelf && !c.isPlatform)
    .slice(0, limit)

  return { all, reference, claimedOnly }
}
