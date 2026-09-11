/**
 * Concorrência e citações em IA — leitura de `llm_mentions`, `platform: google`.
 *
 * Puro. Duas leituras vivem aqui porque saem da **mesma chamada**:
 * `multi_target_metrics/live` devolve, por alvo, tanto o total de menções
 * quanto os domínios que a IA citou nas respostas em que aquele alvo aparece.
 *
 * **A via mudou em 2026-09-11.** A anterior — casar um catálogo de domínios por
 * backlink — foi reprovada com controle positivo: três formas de filtro, zero
 * nas três, contra um domínio com dez links provados em Reddit e YouTube. O
 * índice de backlinks funciona e simplesmente não tem essas fontes.
 *
 * Forma validada contra payload real, não contra documentação:
 * `24-multi_target-controle.json` e `25-multi_target-brasil.json`.
 */

import type {
  GeoAiMentions,
  GeoCitationPrompt,
  GeoCitationSource,
  GeoCitations,
  GeoMentionMeasuredBy,
  GeoMentionTarget,
} from "./geo-audit.ts"

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * O índice guarda o host completo — `www.reddit.com`, `pt.wikipedia.org`,
 * `m.youtube.com`.
 *
 * Igualdade exata contra a forma nua (`reddit.com`) foi exatamente o que fez o
 * filtro de backlinks devolver zero contra um domínio com dez links provados.
 * Casar por sufixo é o que evita repetir aquele falso negativo — e um falso
 * negativo aqui vira "seu site não é citado" num documento comercial.
 */
export function matchesDomain(host: string, root: string): boolean {
  const clean = host.trim().toLowerCase().replace(/^www\./, "")
  const target = root.trim().toLowerCase().replace(/^www\./, "")
  if (!clean || !target) return false
  return clean === target || clean.endsWith(`.${target}`)
}

type SourceRow = { key?: unknown; mentions?: unknown; ai_search_volume?: unknown }

function readSources(
  value: unknown,
  authorityDomains: readonly string[],
): GeoCitationSource[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const row = entry as SourceRow
    const domain = asTrimmed(row?.key)
    if (!domain) return []
    return [
      {
        domain,
        mentions: asFinite(row?.mentions) ?? 0,
        aiSearchVolume: asFinite(row?.ai_search_volume),
        isAuthority: authorityDomains.some((root) => matchesDomain(domain, root)),
      },
    ]
  })
}

export type MultiTargetResult = {
  items?: unknown
}

/**
 * A comparação com concorrentes.
 *
 * **`mentions` não é taxa de citação.** Medido em 2026-09-11 contra o controle:
 * SERVPRO tem 2.670 menções e PuroClean 234 — 11× —, enquanto o relatório de
 * referência dá 88% e 73% de taxa de citação, que é 1,2×. Uma conta o dataset
 * inteiro, a outra a fração de prompts em que a marca aparece. Rotular uma com
 * o nome da outra compara coisas diferentes com a mesma palavra.
 */
export function mapAiMentions(input: {
  result: MultiTargetResult | null
  leadKey: string
  labels: Record<string, string>
  measuredBy: Record<string, GeoMentionMeasuredBy>
}): GeoAiMentions | null {
  if (!input.result) return null
  const raw = Array.isArray(input.result.items) ? input.result.items : []

  const targets: GeoMentionTarget[] = raw.flatMap((entry) => {
    const row = asRecord(entry)
    const key = asTrimmed(row?.key)
    if (!key) return []
    const total = asRecord(row?.total)
    return [
      {
        key,
        label: input.labels[key] ?? key,
        isLead: key === input.leadKey,
        // Quem foi medido só pelo domínio tende a contar menos que quem foi
        // medido por nome **e** domínio. Sem este campo a tela compararia os
        // dois em pé de igualdade, e o lead — o único com nome garantido —
        // sairia favorecido pela própria medição.
        measuredBy: input.measuredBy[key] ?? "domain",
        mentions: asFinite(total?.mentions) ?? 0,
        aiSearchVolume: asFinite(total?.ai_search_volume),
      },
    ]
  })

  const soma = targets.reduce((acc, target) => acc + target.mentions, 0)
  const lead = targets.find((target) => target.isLead)

  return {
    source: "llm_mentions_google",
    targets: targets.sort((left, right) => right.mentions - left.mentions),
    // Denominador zero devolve `null`, não `0`: ninguém foi citado, e "0% de
    // participação" leria como derrota quando o que houve foi mercado sem
    // medida nenhuma.
    share: lead && soma > 0 ? lead.mentions / soma : null,
  }
}

/**
 * As citações do lead, do bloco do próprio alvo dentro da mesma resposta.
 *
 * `sources_domain` aqui é **o que a IA cita nas respostas em que o lead
 * aparece** — não "quem linka para o lead". As duas leituras levam a ações
 * opostas, e a tela precisa usar as palavras certas: a lista é o que a IA lê
 * quando fala do mercado dele.
 */
export function mapGeoCitations(input: {
  result: MultiTargetResult | null
  leadKey: string
  leadDomain: string
  authorityDomains: readonly string[]
  limit: number
}): GeoCitations | null {
  if (!input.result) return null
  const raw = Array.isArray(input.result.items) ? input.result.items : []
  const row = raw
    .map((entry) => asRecord(entry))
    .find((entry) => asTrimmed(entry?.key) === input.leadKey)
  if (!row) return null

  const total = asRecord(row.total)
  const sources = readSources(row.sources_domain, input.authorityDomains)

  return {
    source: "llm_mentions_google",
    mentions: asFinite(total?.mentions) ?? 0,
    aiSearchVolume: asFinite(total?.ai_search_volume),
    sources: sources
      .sort((left, right) => right.mentions - left.mentions)
      .slice(0, input.limit),
    domainCitedAsSource: sources.some((source) =>
      matchesDomain(source.domain, input.leadDomain),
    ),
    // `null` até a segunda chamada rodar. Ela é condicional e só dispara com
    // `mentions > 0`.
    prompts: null,
    truncated: sources.length > input.limit,
  }
}

export type SearchMentionsResult = {
  total_count?: unknown
  items?: unknown
}

/**
 * O detalhe por pergunta — segunda chamada, condicional.
 *
 * Só roda quando `mentions > 0`. Lead sem menção não paga US$ 0,107 por uma
 * chamada que não pode trazer nada, e lead sem menção vai ser a maioria.
 *
 * Devolve `[]` — e não `null` — quando a chamada respondeu e veio vazia:
 * `null` é "não pedido", e confundir os dois foi o defeito que esta etapa
 * inteira existe para evitar.
 */
export function mapGeoCitationPrompts(input: {
  result: SearchMentionsResult | null
  leadDomain: string
}): GeoCitationPrompt[] | null {
  if (!input.result) return null
  const raw = Array.isArray(input.result.items) ? input.result.items : []
  return raw.flatMap((entry) => {
    const row = asRecord(entry)
    const question = asTrimmed(row?.question)
    if (!question) return []
    const sources = Array.isArray(row?.sources)
      ? row.sources.flatMap((sourceEntry) => {
          const source = asRecord(sourceEntry)
          const domain = asTrimmed(source?.domain)
          if (!domain) return []
          return [
            {
              domain,
              url: asTrimmed(source?.url),
              title: asTrimmed(source?.title),
              rank: asFinite(source?.rank),
            },
          ]
        })
      : []
    return [
      {
        question,
        aiSearchVolume: asFinite(row?.ai_search_volume),
        at: asTrimmed(row?.last_response_at),
        sources,
        leadCited: sources.some((source) =>
          matchesDomain(source.domain, input.leadDomain),
        ),
      },
    ]
  })
}
