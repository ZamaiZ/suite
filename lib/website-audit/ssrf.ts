import { isIP } from "node:net"

const BLOCKED_HOSTS = new Set(["localhost", "localhost."])

function isIpv4Private(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false
  }
  const [a, b] = parts
  if (a === undefined || b === undefined) return false
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  return false
}

function isIpv6Private(ip: string): boolean {
  const normalized = ip.toLowerCase()
  if (normalized === "::1" || normalized === "::") return true
  if (normalized.startsWith("fe80:")) return true
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length)
    return isIP(mapped) === 4 && isIpv4Private(mapped)
  }
  return false
}

export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip)
  if (version === 4) return isIpv4Private(ip)
  if (version === 6) return isIpv6Private(ip)
  return true
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "")
  if (!host) return true
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost")) return true
  if (host.endsWith(".local") || host.endsWith(".internal")) return true
  if (isIP(host) !== 0) return isPrivateIp(host)
  return false
}

export function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    if (url.username || url.password) return null
    if (isBlockedHostname(url.hostname)) return null
    return url
  } catch {
    return null
  }
}

export function resolveRedirectUrl(current: URL, location: string): URL | null {
  try {
    return parseHttpUrl(new URL(location, current).toString())
  } catch {
    return null
  }
}
