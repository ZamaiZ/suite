/**
 * Citações e concorrência em IA — `llm_mentions`, `platform: google`. Puro.
 *
 * **A ordem das duas chamadas importa, e ela mudou depois da primeira coleta
 * real.** O desenho original chamava `multi_target_metrics` primeiro, com os
 * concorrentes vindos de `/backlinks/competitors/live`. Rodado contra
 * `buscaorganica.com.br` em 2026-09-11, aquilo produziu como "concorrentes"
 * `url.science`, `cri.it`, `airticles.ai`, `ocenergiasolar.com.br` e
 * `ronaldowebnegocios.com` — nenhum deles concorrente de agência de SEO. O
 * "concorrente" de backlink é quem compartilha domínios de referência, que é
 * outra pergunta.
 *
 * O resultado disso não foi um número ruim: foi um número **lisonjeiro**. O
 * lead ficou com 67% de participação contra alvos que somavam uma menção. Na
 * mesma resposta, os concorrentes de verdade estavam à vista —
 * `conversion.com.br`, `organicadigital.com`, `outmarketing.com.br` — porque a
 * IA os citou ao lado do lead.
 *
 * Então: `search_mentions` **primeiro**, e os concorrentes saem das fontes que
 * a IA de fato citou. Mesmo custo, e a lista passa a ser o mercado medido em
 * vez de um artefato do índice de links.
 *
 * A via anterior a essa — casar um catálogo por backlink — já tinha sido
 * reprovada com controle positivo na onda 0: três formas de filtro, zero nas
 * três, contra um domínio com dez links provados em Reddit e YouTube.
 */

import type {
  GeoAiMentions,
  GeoCitationPrompt,
  GeoCitationSource,
  GeoCitations,
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

/**
 * Agrega, sobre as perguntas medidas, quantas vezes cada domínio foi citado.
 *
 * Conta **uma vez por pergunta**, não por linha de fonte: a mesma página pode
 * aparecer duas vezes na mesma resposta com âncoras diferentes, e contar as
 * duas inflaria o domínio pela forma da citação em vez da frequência dela.
 */
function aggregateSources(
  prompts: readonly GeoCitationPrompt[],
  authorityDomains: readonly string[],
): GeoCitationSource[] {
  const porDominio = new Map<string, { mentions: number; volume: number }>()
  for (const prompt of prompts) {
    const vistos = new Set<string>()
    for (const source of prompt.sources) {
      const domain = source.domain.toLowerCase()
      if (vistos.has(domain)) continue
      vistos.add(domain)
      const atual = porDominio.get(domain) ?? { mentions: 0, volume: 0 }
      atual.mentions += 1
      atual.volume += prompt.aiSearchVolume ?? 0
      porDominio.set(domain, atual)
    }
  }
  return [...porDominio.entries()]
    .map(([domain, item]) => ({
      domain,
      mentions: item.mentions,
      aiSearchVolume: item.volume > 0 ? item.volume : null,
      isAuthority: authorityDomains.some((root) => matchesDomain(domain, root)),
    }))
    .sort((left, right) => right.mentions - left.mentions)
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

/**
 * As citações do lead, montadas a partir das perguntas medidas.
 *
 * `mentions` vem de `total_count` da mesma chamada que produziu a lista, e não
 * do `multi_target`. Os dois números **divergem**: na coleta de 2026-09-11,
 * `search_mentions` devolveu sete perguntas e o `total` do `multi_target` disse
 * duas menções. A tela mostrava "2 respostas de IA citam este negócio" com sete
 * perguntas logo abaixo — contradição visível ao analista. Enquanto a diferença
 * entre os dois não for medida, o número exibido é o que casa com a lista.
 */
export function mapGeoCitations(input: {
  result: SearchMentionsResult | null
  leadDomain: string
  authorityDomains: readonly string[]
  limit: number
}): GeoCitations | null {
  const prompts = mapGeoCitationPrompts({
    result: input.result,
    leadDomain: input.leadDomain,
  })
  if (prompts === null) return null

  const sources = aggregateSources(prompts, input.authorityDomains)
  const total = asFinite(input.result?.total_count)

  return {
    source: "llm_mentions_google",
    // `total_count` é o número de respostas que casam o alvo; a lista pode vir
    // truncada pelo teto e ainda assim o total é o total.
    mentions: total ?? prompts.length,
    aiSearchVolume:
      prompts.reduce((acc, prompt) => acc + (prompt.aiSearchVolume ?? 0), 0) ||
      null,
    sources: sources.slice(0, input.limit),
    domainCitedAsSource: prompts.some((prompt) => prompt.leadCited),
    prompts,
    truncated: total !== null && total > prompts.length,
  }
}

/**
 * Domínios que aparecem em resposta de IA sem serem concorrentes de ninguém.
 *
 * Suporte de plataforma, portal de notícia, banco, classificado de vaga. Sem
 * este corte, a tabela de concorrência do lead viria com `support.google.com` e
 * `serasa.com.br` — medido na coleta de 2026-09-11, onde prompts genéricos
 * ("como ganhar dinheiro na internet") dominaram a amostra.
 */
const GENERIC_SOURCE_DOMAINS = [
  "google.com",
  "youtube.com",
  "reddit.com",
  "wikipedia.org",
  "sebrae.com.br",
  "serasa.com.br",
  "indeed.com",
  "workana.com",
  "catho.com.br",
  "uol.com.br",
  "globo.com",
  "exame.com",
  "shopify.com",
  "mailchimp.com",
  "squarespace.com",
] as const

/**
 * A concorrência, derivada das fontes das perguntas medidas. **Sem chamada.**
 *
 * O universo é o mesmo da lista de perguntas que a tela mostra ao lado: as
 * respostas de IA em que o lead aparece. Isso é o que torna o percentual
 * legível — denominador conhecido, universo declarado.
 *
 * `measuredBy` fica `"domain"` em **todos** os alvos, inclusive o lead, e isso
 * é o ponto: todo mundo é contado pelo mesmo critério. A versão anterior media
 * o lead por nome e domínio e os concorrentes só por domínio, e o lead saía
 * favorecido pela própria medição.
 */
export function mentionsFromCitations(input: {
  citations: GeoCitations
  leadDomain: string
  leadLabel: string
  limit: number
}): GeoAiMentions | null {
  if (input.citations.prompts === null) return null

  const total = input.citations.sources.reduce(
    (acc, source) => acc + source.mentions,
    0,
  )
  const doLead = input.citations.sources.find((source) =>
    matchesDomain(source.domain, input.leadDomain),
  )

  const targets: GeoMentionTarget[] = input.citations.sources
    .filter(
      (source) =>
        matchesDomain(source.domain, input.leadDomain) ||
        (!source.isAuthority &&
          !GENERIC_SOURCE_DOMAINS.some((root) =>
            matchesDomain(source.domain, root),
          )),
    )
    .slice(0, input.limit)
    .map((source) => {
      const isLead = matchesDomain(source.domain, input.leadDomain)
      return {
        key: source.domain,
        label: isLead ? input.leadLabel : source.domain,
        isLead,
        measuredBy: "domain" as const,
        mentions: source.mentions,
        aiSearchVolume: source.aiSearchVolume,
      }
    })

  return {
    source: "prompt_sources",
    promptCount: input.citations.prompts.length,
    targets,
    // Denominador é **toda** citação das respostas medidas, inclusive as
    // fontes de autoridade e os portais genéricos que a lista acima esconde.
    // Contar só os alvos exibidos inflaria a participação do lead por
    // construção.
    share: doLead && total > 0 ? doLead.mentions / total : null,
  }
}

/**
 * Quanto uma única pergunta contribui para a lista de fontes.
 *
 * Existe porque a amostra é derivada do que o **domínio** ranqueia, não de
 * prompts curados. Medido em 2026-09-11: uma pergunta genérica
 * ("como ganhar dinheiro na internet rápido") trouxe 22 das 66 citações e
 * arrastou para a lista hospedagem e finanças pessoais. A tela precisa dizer
 * isso — a diferença entre a nossa amostra e a do relatório de referência, que
 * usa dez prompts escolhidos, é exatamente esta.
 */
export function promptConcentration(citations: GeoCitations): {
  question: string
  share: number
} | null {
  const prompts = citations.prompts
  if (!prompts || prompts.length === 0) return null
  const total = prompts.reduce((acc, prompt) => acc + prompt.sources.length, 0)
  if (total === 0) return null
  const maior = prompts.reduce((maiorAte, prompt) =>
    prompt.sources.length > maiorAte.sources.length ? prompt : maiorAte,
  )
  return { question: maior.question, share: maior.sources.length / total }
}
