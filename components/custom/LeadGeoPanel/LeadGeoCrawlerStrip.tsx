"use client"

import { RiCheckLine, RiCloseLine, RiSubtractLine } from "react-icons/ri"
import {
  STEP_TONE_CHIP,
  StepSectionLabel,
  type StepTone,
} from "@/components/custom/LeadStepShell"
import { cn } from "cn"
import { GEO_PROMPT_PLATFORMS } from "@/lib/dataforseo/limits"
import type { GeoAccessibility } from "@/lib/leads/geo-audit"
import { PROVIDER_LABELS } from "./geo-format"

/**
 * Os robôs das quatro plataformas que a sondagem pergunta.
 *
 * **Mesmos rótulos e mesma ordem da aba Sondagem**, de propósito: o analista lê
 * as duas telas na mesma linguagem — aqui quem consegue entrar no site, lá quem
 * cita a marca.
 *
 * **Dois fatos vizinhos, e nenhuma seta entre eles.** Robô bloqueado e marca
 * não citada é hipótese plausível e **não medida**. A tela põe os dois lado a
 * lado e deixa a conclusão para quem tem o contexto.
 */

/**
 * Quais agentes do `robots.txt` pertencem a cada plataforma sondada.
 *
 * Os doze vêm de `AI_USER_AGENTS`, em `lib/website-audit/robots.ts`. Os cinco
 * que não pertencem a nenhuma das quatro entram no agrupamento de fora — não
 * somem, porque bloquear o `CCBot` também é decisão sobre presença em IA.
 */
const AGENTS_BY_PLATFORM: Record<string, readonly string[]> = {
  chat_gpt: ["gptbot", "chatgpt-user", "oai-searchbot"],
  claude: ["claudebot", "claude-web"],
  gemini: ["google-extended"],
  perplexity: ["perplexitybot"],
}

/** O nome como o robots.txt o escreve, para a linha ser conferível. */
const AGENT_LABELS: Record<string, string> = {
  gptbot: "GPTBot",
  "chatgpt-user": "ChatGPT-User",
  "oai-searchbot": "OAI-SearchBot",
  claudebot: "ClaudeBot",
  "claude-web": "Claude-Web",
  "google-extended": "Google-Extended",
  perplexitybot: "PerplexityBot",
  ccbot: "CCBot",
  bytespider: "Bytespider",
  "applebot-extended": "Applebot-Extended",
  "meta-externalagent": "Meta-ExternalAgent",
  amazonbot: "Amazonbot",
}

/**
 * Três estados, e o terceiro é o que a tela não dizia.
 *
 * `unknown` é o crawl anterior à coleta de robôs: nada foi medido, e afirmar
 * "liberado" ali seria inventar. `undeclared` é medido e diferente de
 * `allowed`: o `robots.txt` permite o que não proíbe, então não declarar é
 * liberar por omissão — o site não decidiu nada sobre aquele robô. A aba antes
 * só mostrava os bloqueados, e os outros dois estados sumiam no mesmo silêncio.
 */
type CrawlerState = "allowed" | "blocked" | "undeclared" | "unknown"

const STATE: Record<
  CrawlerState,
  { tone: StepTone; label: string; icon: typeof RiCheckLine }
> = {
  allowed: { tone: "success", label: "Liberado", icon: RiCheckLine },
  blocked: { tone: "warning", label: "Bloqueado", icon: RiCloseLine },
  undeclared: { tone: "neutral", label: "Não declarado", icon: RiSubtractLine },
  unknown: { tone: "neutral", label: "Não medido", icon: RiSubtractLine },
}

function agentLabel(agent: string): string {
  return AGENT_LABELS[agent] ?? agent
}

function Tile({
  title,
  state,
  detail,
}: {
  title: string
  state: CrawlerState
  detail: string
}) {
  const { tone, label, icon: Icon } = STATE[state]
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border/70 px-3 py-2.5">
      <p className="truncate text-xs/[1.5] font-semibold text-foreground">
        {title}
      </p>
      {/* Estado nunca só por cor: ícone e palavra sempre juntos. */}
      <span
        className={cn(
          "inline-flex w-fit items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium",
          STEP_TONE_CHIP[tone],
        )}
      >
        <Icon size={11} aria-hidden />
        {label}
      </span>
      <p className="truncate text-[10px] text-muted-foreground" title={detail}>
        {detail}
      </p>
    </div>
  )
}

export function LeadGeoCrawlerStrip({
  access,
  extended,
}: {
  access: GeoAccessibility
  /** O crawl lido é da coleta ampliada? Sem ela, `robots.aiAgents` é vazio. */
  extended: boolean
}) {
  const lidos = new Map(
    access.aiCrawlers.map((entry) => [entry.agent.toLowerCase(), entry.blocked]),
  )
  const daPlataforma = new Set(
    Object.values(AGENTS_BY_PLATFORM).flatMap((list) => [...list]),
  )
  const outros = [...lidos.keys()].filter((agent) => !daPlataforma.has(agent))
  const outrosBloqueados = outros.filter((agent) => lidos.get(agent))

  function stateFor(platform: string): { state: CrawlerState; detail: string } {
    if (!extended) {
      return { state: "unknown", detail: "Crawl anterior à coleta de robôs" }
    }
    const agentes = AGENTS_BY_PLATFORM[platform] ?? []
    const declarados = agentes.filter((agent) => lidos.has(agent))
    if (declarados.length === 0) {
      return {
        state: "undeclared",
        detail: `${agentes.map(agentLabel).join(", ")} — fora do robots.txt`,
      }
    }
    const bloqueados = declarados.filter((agent) => lidos.get(agent))
    if (bloqueados.length > 0) {
      return {
        state: "blocked",
        detail: bloqueados.map(agentLabel).join(", "),
      }
    }
    return { state: "allowed", detail: declarados.map(agentLabel).join(", ") }
  }

  return (
    <div className="min-w-0">
      <StepSectionLabel
        aside={extended ? "lido do robots.txt" : "não medido neste crawl"}
      >
        Robôs das plataformas sondadas
      </StepSectionLabel>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GEO_PROMPT_PLATFORMS.map((platform) => {
          const { state, detail } = stateFor(platform)
          return (
            <Tile
              key={platform}
              title={PROVIDER_LABELS[platform] ?? platform}
              state={state}
              detail={detail}
            />
          )
        })}
      </div>
      {/* Os cinco de fora das quatro plataformas. Uma linha, porque a decisão
          sobre eles é a mesma decisão — só não é sobre quem a sondagem mede. */}
      {extended && outros.length > 0 ? (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Outros {outros.length} robôs de IA declarados
          {outrosBloqueados.length > 0
            ? `, ${outrosBloqueados.length} bloqueado(s): ${outrosBloqueados.map(agentLabel).join(", ")}`
            : ", nenhum bloqueado"}
          .
        </p>
      ) : null}
    </div>
  )
}
