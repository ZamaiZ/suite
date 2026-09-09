import {
  BACKLINKS_SITEWIDE_LINKS_PER_DOMAIN,
  backlinkMetrics,
  type BacklinkDistributionItem,
  type BacklinkSnapshot,
} from "./backlinks-audit.ts"

/**
 * A leitura do perfil em uma frase.
 *
 * Seis números soltos não dizem se o volume é largo ou concentrado, e é essa a
 * diferença que decide a recomendação. O primeiro perfil real coletado tinha
 * 769.391 links de 404 domínios, e a tela ficava calada.
 */
export function backlinkProfileShape(
  snapshot: BacklinkSnapshot,
): string | null {
  const perDomain = backlinkMetrics(snapshot).linksPerDomain
  if (
    perDomain === null ||
    snapshot.backlinks === null ||
    snapshot.referringDomains === null
  ) {
    return null
  }
  const links = snapshot.backlinks.toLocaleString("pt-BR")
  const domains = snapshot.referringDomains.toLocaleString("pt-BR")
  const rate = Math.round(perDomain).toLocaleString("pt-BR")
  const head =
    `${links} links vindos de ${domains} domínios` + ` — ${rate} por domínio.`
  if (perDomain < BACKLINKS_SITEWIDE_LINKS_PER_DOMAIN) return head
  return (
    `${head} Volume concentrado: crescer daqui exige domínios novos,` +
    ` não links novos.`
  )
}

export function formatBacklinkShare(value: number | null): string | null {
  if (value === null) return null
  return `${Math.round(value * 100)}%`
}

export function formatLinksPerDomain(value: number | null): string | null {
  if (value === null) return null
  return Math.round(value).toLocaleString("pt-BR")
}

/**
 * As distribuições contam **links**, não domínios — e ficam ao lado do número
 * de domínios no card, então o rótulo tem que dizer qual é qual.
 */
export function formatBacklinkDistribution(
  items: readonly BacklinkDistributionItem[],
): string | null {
  if (items.length === 0) return null
  return items
    .map((item) => `${item.label} ${item.count.toLocaleString("pt-BR")}`)
    .join(" · ")
}
