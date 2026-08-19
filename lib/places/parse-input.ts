const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{10,}$/
const CHIJ_PATTERN = /ChIJ[A-Za-z0-9_-]+/

function isMapsHost(host: string): boolean {
  return (
    host === "google.com" ||
    host.endsWith(".google.com") ||
    host === "goo.gl" ||
    host.endsWith(".goo.gl") ||
    host === "maps.app.goo.gl"
  )
}

export function parsePlaceInput(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const resource = trimmed.match(/^places\/(.+)$/i)
  if (resource && PLACE_ID_PATTERN.test(resource[1])) return resource[1]

  if (PLACE_ID_PATTERN.test(trimmed) && /^[A-Z]/.test(trimmed)) {
    return trimmed
  }

  try {
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`
    const url = new URL(candidate)
    const host = url.hostname.replace(/^www\./, "").toLowerCase()
    if (!isMapsHost(host)) return null

    const fromQuery =
      url.searchParams.get("query_place_id") ||
      url.searchParams.get("place_id") ||
      url.searchParams.get("placeid")
    if (fromQuery && PLACE_ID_PATTERN.test(fromQuery)) return fromQuery

    const fromPath = url.pathname.match(CHIJ_PATTERN)
    if (fromPath) return fromPath[0]
  } catch {
    return null
  }

  return null
}
