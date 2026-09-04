import { z } from "zod"
import { otherSecretKind } from "@/lib/briefing/secrets"

export const ACCESS_ANSWER_IDS = ["yes", "no"] as const

export type AccessAnswerId = (typeof ACCESS_ANSWER_IDS)[number]

export const ACCESS_URL_MAX = 500
export const ACCESS_USERNAME_MAX = 200
export const ACCESS_EMAIL_MAX = 254
export const ACCESS_OTHER_NAME_MAX = 120
export const ACCESS_OTHER_ITEMS_MAX = 20
export const ACCESS_PASSWORD_MAX = 500

export type AccessCredentialBlock = {
  status: AccessAnswerId | null
  loginUrl: string
  username: string
}

export type AccessInviteBlock = {
  status: AccessAnswerId | null
  inviteEmail: string
}

export type AccessHostingBlock = {
  status: AccessAnswerId | null
  panelUrl: string
  username: string
}

export type AccessOtherToolItem = {
  id: string
  name: string
  username: string
}

export type AccessOtherToolsBlock = {
  status: AccessAnswerId | null
  items: AccessOtherToolItem[]
}

export type BriefingAccessesPayload = {
  wordpress: AccessCredentialBlock
  searchConsole: AccessInviteBlock
  analytics: AccessInviteBlock
  gbp: AccessInviteBlock
  hosting: AccessHostingBlock
  domain: AccessHostingBlock
  otherTools: AccessOtherToolsBlock
}

export type BriefingSecretFlags = Record<string, boolean>

export function emptyCredentialBlock(): AccessCredentialBlock {
  return { status: null, loginUrl: "", username: "" }
}

export function emptyInviteBlock(): AccessInviteBlock {
  return { status: null, inviteEmail: "" }
}

export function emptyHostingBlock(): AccessHostingBlock {
  return { status: null, panelUrl: "", username: "" }
}

export function emptyOtherToolsBlock(): AccessOtherToolsBlock {
  return { status: null, items: [] }
}

export function emptyAccessesPayload(): BriefingAccessesPayload {
  return {
    wordpress: emptyCredentialBlock(),
    searchConsole: emptyInviteBlock(),
    analytics: emptyInviteBlock(),
    gbp: emptyInviteBlock(),
    hosting: emptyHostingBlock(),
    domain: emptyHostingBlock(),
    otherTools: emptyOtherToolsBlock(),
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function isAccessAnswerId(value: unknown): value is AccessAnswerId {
  return (
    typeof value === "string" &&
    (ACCESS_ANSWER_IDS as readonly string[]).includes(value)
  )
}

function isValidEmail(value: string): boolean {
  return z.email().safeParse(value).success
}

function parseCredentialBlock(value: unknown): AccessCredentialBlock {
  const base = emptyCredentialBlock()
  if (!value || typeof value !== "object") return base
  const row = value as Record<string, unknown>
  return {
    status: isAccessAnswerId(row.status) ? row.status : null,
    loginUrl: asString(row.loginUrl).slice(0, ACCESS_URL_MAX),
    username: asString(row.username).slice(0, ACCESS_USERNAME_MAX),
  }
}

function parseInviteBlock(value: unknown): AccessInviteBlock {
  const base = emptyInviteBlock()
  if (!value || typeof value !== "object") return base
  const row = value as Record<string, unknown>
  return {
    status: isAccessAnswerId(row.status) ? row.status : null,
    inviteEmail: asString(row.inviteEmail).slice(0, ACCESS_EMAIL_MAX),
  }
}

function parseHostingBlock(value: unknown): AccessHostingBlock {
  const base = emptyHostingBlock()
  if (!value || typeof value !== "object") return base
  const row = value as Record<string, unknown>
  return {
    status: isAccessAnswerId(row.status) ? row.status : null,
    panelUrl: asString(row.panelUrl).slice(0, ACCESS_URL_MAX),
    username: asString(row.username).slice(0, ACCESS_USERNAME_MAX),
  }
}

function sanitizeHostingBlock(block: AccessHostingBlock): AccessHostingBlock {
  if (block.status === "yes") {
    return {
      status: "yes",
      panelUrl: block.panelUrl.trim().slice(0, ACCESS_URL_MAX),
      username: block.username.trim().slice(0, ACCESS_USERNAME_MAX),
    }
  }
  return {
    status: block.status === "no" ? "no" : null,
    panelUrl: "",
    username: "",
  }
}

function parseOtherItems(value: unknown): AccessOtherToolItem[] {
  if (!Array.isArray(value)) return []
  const items: AccessOtherToolItem[] = []
  for (const entry of value) {
    if (items.length >= ACCESS_OTHER_ITEMS_MAX) break
    if (!entry || typeof entry !== "object") continue
    const row = entry as Record<string, unknown>
    const id = asString(row.id).trim()
    const name = asString(row.name).trim().slice(0, ACCESS_OTHER_NAME_MAX)
    if (!id || !name) continue
    if (items.some((item) => item.id === id)) continue
    items.push({
      id: id.slice(0, 80),
      name,
      username: asString(row.username).trim().slice(0, ACCESS_USERNAME_MAX),
    })
  }
  return items
}

export function sanitizeAccessesPayload(
  payload: BriefingAccessesPayload,
): BriefingAccessesPayload {
  return {
    wordpress:
      payload.wordpress.status === "yes"
        ? {
            status: "yes",
            loginUrl: payload.wordpress.loginUrl.trim().slice(0, ACCESS_URL_MAX),
            username: payload.wordpress.username
              .trim()
              .slice(0, ACCESS_USERNAME_MAX),
          }
        : {
            status: payload.wordpress.status === "no" ? "no" : null,
            loginUrl: "",
            username: "",
          },
    searchConsole:
      payload.searchConsole.status === "yes"
        ? {
            status: "yes",
            inviteEmail: payload.searchConsole.inviteEmail
              .trim()
              .slice(0, ACCESS_EMAIL_MAX),
          }
        : {
            status: payload.searchConsole.status === "no" ? "no" : null,
            inviteEmail: "",
          },
    analytics:
      payload.analytics.status === "yes"
        ? {
            status: "yes",
            inviteEmail: payload.analytics.inviteEmail
              .trim()
              .slice(0, ACCESS_EMAIL_MAX),
          }
        : {
            status: payload.analytics.status === "no" ? "no" : null,
            inviteEmail: "",
          },
    gbp:
      payload.gbp.status === "yes"
        ? {
            status: "yes",
            inviteEmail: payload.gbp.inviteEmail
              .trim()
              .slice(0, ACCESS_EMAIL_MAX),
          }
        : {
            status: payload.gbp.status === "no" ? "no" : null,
            inviteEmail: "",
          },
    hosting: sanitizeHostingBlock(payload.hosting),
    domain: sanitizeHostingBlock(payload.domain),
    otherTools:
      payload.otherTools.status === "yes"
        ? {
            status: "yes",
            items: parseOtherItems(payload.otherTools.items),
          }
        : {
            status: payload.otherTools.status === "no" ? "no" : null,
            items: [],
          },
  }
}

function parseOtherToolsBlock(value: unknown): AccessOtherToolsBlock {
  const base = emptyOtherToolsBlock()
  if (!value || typeof value !== "object") return base
  const row = value as Record<string, unknown>
  return {
    status: isAccessAnswerId(row.status) ? row.status : null,
    items: parseOtherItems(row.items),
  }
}

export function parseAccessesPayload(value: unknown): BriefingAccessesPayload {
  const base = emptyAccessesPayload()
  if (!value || typeof value !== "object") return base
  const row = value as Record<string, unknown>
  return sanitizeAccessesPayload({
    wordpress: parseCredentialBlock(row.wordpress),
    searchConsole: parseInviteBlock(row.searchConsole),
    analytics: parseInviteBlock(row.analytics),
    gbp: parseInviteBlock(row.gbp),
    hosting: parseHostingBlock(row.hosting ?? row.hostingDomain),
    domain: parseHostingBlock(row.domain),
    otherTools: parseOtherToolsBlock(row.otherTools),
  })
}

export function secretKindsAllowedToKeep(
  payload: BriefingAccessesPayload,
): Set<string> {
  const sanitized = sanitizeAccessesPayload(payload)
  const keep = new Set<string>()
  if (sanitized.wordpress.status === "yes") keep.add("wordpress")
  if (sanitized.hosting.status === "yes") keep.add("hosting_domain")
  if (sanitized.domain.status === "yes") keep.add("domain")
  if (sanitized.otherTools.status === "yes") {
    for (const item of sanitized.otherTools.items) {
      keep.add(otherSecretKind(item.id))
    }
  }
  return keep
}

export type AccessesMissingGroup =
  | "wordpressStatus"
  | "wordpressLoginUrl"
  | "wordpressUsername"
  | "wordpressPassword"
  | "searchConsoleStatus"
  | "searchConsoleEmail"
  | "analyticsStatus"
  | "analyticsEmail"
  | "gbpStatus"
  | "gbpEmail"
  | "hostingStatus"
  | "hostingPanelUrl"
  | "hostingUsername"
  | "hostingPassword"
  | "domainStatus"
  | "domainPanelUrl"
  | "domainUsername"
  | "domainPassword"
  | "otherToolsStatus"
  | "otherToolsItems"

export const ACCESSES_MISSING_LABELS: Record<AccessesMissingGroup, string> = {
  wordpressStatus: "acesso ao WordPress",
  wordpressLoginUrl: "URL de login do WordPress",
  wordpressUsername: "usuário do WordPress",
  wordpressPassword: "senha do WordPress",
  searchConsoleStatus: "acesso ao Search Console",
  searchConsoleEmail: "e-mail do convite Search Console",
  analyticsStatus: "acesso ao Google Analytics",
  analyticsEmail: "e-mail do convite Analytics",
  gbpStatus: "acesso ao Google Meu Negócio",
  gbpEmail: "e-mail do convite Google Meu Negócio",
  hostingStatus: "acesso à hospedagem",
  hostingPanelUrl: "URL do painel de hospedagem",
  hostingUsername: "usuário da hospedagem",
  hostingPassword: "senha da hospedagem",
  domainStatus: "acesso ao domínio",
  domainPanelUrl: "URL do painel do domínio",
  domainUsername: "usuário do domínio",
  domainPassword: "senha do domínio",
  otherToolsStatus: "outras ferramentas",
  otherToolsItems: "nome de outra ferramenta",
}

export function getAccessesMissingGroups(
  payload: BriefingAccessesPayload,
  secretFlags: BriefingSecretFlags,
): AccessesMissingGroup[] {
  const sanitized = sanitizeAccessesPayload(payload)
  const missing: AccessesMissingGroup[] = []

  if (sanitized.wordpress.status === null) {
    missing.push("wordpressStatus")
  } else if (sanitized.wordpress.status === "yes") {
    if (!sanitized.wordpress.loginUrl) missing.push("wordpressLoginUrl")
    if (!sanitized.wordpress.username) missing.push("wordpressUsername")
    if (!secretFlags.wordpress) missing.push("wordpressPassword")
  }

  if (sanitized.searchConsole.status === null) {
    missing.push("searchConsoleStatus")
  } else if (sanitized.searchConsole.status === "yes") {
    if (!isValidEmail(sanitized.searchConsole.inviteEmail)) {
      missing.push("searchConsoleEmail")
    }
  }

  if (sanitized.analytics.status === null) {
    missing.push("analyticsStatus")
  } else if (sanitized.analytics.status === "yes") {
    if (!isValidEmail(sanitized.analytics.inviteEmail)) {
      missing.push("analyticsEmail")
    }
  }

  if (sanitized.gbp.status === null) {
    missing.push("gbpStatus")
  } else if (sanitized.gbp.status === "yes") {
    if (!isValidEmail(sanitized.gbp.inviteEmail)) {
      missing.push("gbpEmail")
    }
  }

  if (sanitized.hosting.status === null) {
    missing.push("hostingStatus")
  } else if (sanitized.hosting.status === "yes") {
    if (!sanitized.hosting.panelUrl) missing.push("hostingPanelUrl")
    if (!sanitized.hosting.username) missing.push("hostingUsername")
    if (!secretFlags.hosting_domain) missing.push("hostingPassword")
  }

  if (sanitized.domain.status === null) {
    missing.push("domainStatus")
  } else if (sanitized.domain.status === "yes") {
    if (!sanitized.domain.panelUrl) missing.push("domainPanelUrl")
    if (!sanitized.domain.username) missing.push("domainUsername")
    if (!secretFlags.domain) missing.push("domainPassword")
  }

  if (sanitized.otherTools.status === null) {
    missing.push("otherToolsStatus")
  } else if (
    sanitized.otherTools.status === "yes" &&
    sanitized.otherTools.items.length === 0
  ) {
    missing.push("otherToolsItems")
  }

  return missing
}

export function isAccessesReadyToComplete(
  payload: BriefingAccessesPayload,
  secretFlags: BriefingSecretFlags,
): boolean {
  return getAccessesMissingGroups(payload, secretFlags).length === 0
}
