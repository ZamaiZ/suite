/**
 * Interpretacao do robots.txt.
 *
 * A coleta anterior lia o arquivo apenas para extrair linhas `Sitemap:`, entao
 * nem bloqueio de busca nem bloqueio de agente de IA eram visiveis. Aqui os
 * grupos sao preservados e o texto bruto e guardado, para que uma analise
 * posterior nao dependa de nova coleta.
 */
export const AI_USER_AGENTS = [
  "gptbot",
  "chatgpt-user",
  "oai-searchbot",
  "claudebot",
  "claude-web",
  "perplexitybot",
  "google-extended",
  "ccbot",
  "bytespider",
  "applebot-extended",
  "meta-externalagent",
  "amazonbot",
] as const

export type AiUserAgent = (typeof AI_USER_AGENTS)[number]

export type RobotsGroup = {
  userAgents: string[]
  allow: string[]
  disallow: string[]
}

export type RobotsAiAgent = {
  agent: string
  blocked: boolean
}

export const ROBOTS_CONTENT_MAX = 10_000

function stripComment(line: string): string {
  const hash = line.indexOf("#")
  return hash === -1 ? line : line.slice(0, hash)
}

/**
 * Agrupa `User-agent` consecutivos com as regras que os seguem, como manda a
 * especificacao: varios agentes declarados em sequencia compartilham o mesmo
 * bloco de regras.
 */
export function parseRobotsGroups(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = []
  let current: RobotsGroup | null = null
  let collectingAgents = false

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim()
    if (!line) continue
    const separator = line.indexOf(":")
    if (separator === -1) continue
    const field = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()

    if (field === "user-agent") {
      if (!current || !collectingAgents) {
        current = { userAgents: [], allow: [], disallow: [] }
        groups.push(current)
        collectingAgents = true
      }
      if (value) current.userAgents.push(value.toLowerCase())
      continue
    }

    if (field !== "allow" && field !== "disallow") continue
    if (!current) continue
    collectingAgents = false
    if (field === "allow") current.allow.push(value)
    else current.disallow.push(value)
  }

  return groups.filter((group) => group.userAgents.length > 0)
}

function groupsForAgent(
  groups: readonly RobotsGroup[],
  agent: string,
): RobotsGroup[] {
  const needle = agent.toLowerCase()
  const specific = groups.filter((group) =>
    group.userAgents.some((item) => item === needle),
  )
  if (specific.length > 0) return specific
  return groups.filter((group) => group.userAgents.includes("*"))
}

function ruleMatches(rule: string, path: string): boolean {
  if (rule === "") return false
  // Suporte ao coringa e ao ancoramento de fim usados na pratica.
  if (rule.includes("*") || rule.endsWith("$")) {
    const anchored = rule.endsWith("$")
    const body = anchored ? rule.slice(0, -1) : rule
    const escaped = body
      .split("*")
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*")
    const pattern = new RegExp(`^${escaped}${anchored ? "$" : ""}`)
    return pattern.test(path)
  }
  return path.startsWith(rule)
}

/**
 * Regra mais especifica vence; empate vai para `Allow`, como o Google faz.
 */
export function robotsBlocksPath(
  groups: readonly RobotsGroup[],
  agent: string,
  path: string,
): boolean {
  const relevant = groupsForAgent(groups, agent)
  if (relevant.length === 0) return false

  let bestAllow = -1
  let bestDisallow = -1
  for (const group of relevant) {
    for (const rule of group.allow) {
      if (ruleMatches(rule, path)) bestAllow = Math.max(bestAllow, rule.length)
    }
    for (const rule of group.disallow) {
      if (rule === "") continue
      if (ruleMatches(rule, path)) {
        bestDisallow = Math.max(bestDisallow, rule.length)
      }
    }
  }
  if (bestDisallow === -1) return false
  return bestDisallow > bestAllow
}

/**
 * Bloquear IA e decisao legitima do negocio, entao isto e um fato do snapshot
 * e nao um defeito: so agentes declarados explicitamente entram na lista.
 */
export function aiAgentsFromGroups(
  groups: readonly RobotsGroup[],
): RobotsAiAgent[] {
  const declared = new Set<string>()
  for (const group of groups) {
    for (const agent of group.userAgents) declared.add(agent)
  }
  const found: RobotsAiAgent[] = []
  for (const agent of AI_USER_AGENTS) {
    if (!declared.has(agent)) continue
    found.push({ agent, blocked: robotsBlocksPath(groups, agent, "/") })
  }
  return found
}

export function readRobotsGroups(value: unknown): RobotsGroup[] {
  if (!Array.isArray(value)) return []
  const groups: RobotsGroup[] = []
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    const strings = (input: unknown): string[] =>
      Array.isArray(input)
        ? input.filter((entry): entry is string => typeof entry === "string")
        : []
    const userAgents = strings(row.userAgents)
    if (userAgents.length === 0) continue
    groups.push({
      userAgents,
      allow: strings(row.allow),
      disallow: strings(row.disallow),
    })
  }
  return groups
}

export function readRobotsAiAgents(value: unknown): RobotsAiAgent[] {
  if (!Array.isArray(value)) return []
  const agents: RobotsAiAgent[] = []
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    if (typeof row.agent !== "string" || typeof row.blocked !== "boolean") {
      continue
    }
    agents.push({ agent: row.agent, blocked: row.blocked })
  }
  return agents
}
