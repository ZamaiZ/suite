export function normalizeWebsiteDomain(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    const url = new URL(candidate)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null

    const hostname = url.hostname.trim().toLowerCase()
    if (!hostname) return null

    const domain = hostname.startsWith("www.") ? hostname.slice(4) : hostname
    if (!domain.includes(".")) return null

    return domain
  } catch {
    return null
  }
}

export function canonicalWebsiteUrl(domain: string): string {
  return `https://${domain}`
}
