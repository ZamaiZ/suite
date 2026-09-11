/**
 * Leitura das respostas da sondagem. Puro.
 *
 * **A LLM é objeto de medição, nunca instrumento de análise.** Nada aqui pede
 * opinião a um modelo: o que se lê é onde a marca aparece no texto e quais URLs
 * o modelo citou.
 */

import type {
  GeoPromptRun,
  GeoPromptRunStatus,
  GeoPromptVisibility,
} from "./geo-audit.ts"

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export type LlmAnnotation = {
  title: string | null
  url: string | null
}

/**
 * `annotations` mora em `items[].sections[].annotations[]`.
 *
 * **Não** em `items[].annotations[]`, que é onde a documentação a descreve. A
 * onda 0 leu pelo caminho documentado e obteve `annotations_count: 0` numa
 * resposta que tinha três, todas apontando para o domínio do lead — e o
 * veredito que sairia dali seria "a plataforma não devolve annotations", que
 * mata a métrica determinística da sondagem inteira.
 *
 * Evidência: `20-llm_responses-chat_gpt.json` e `14-llm_responses-claude.json`.
 */
export function readLlmAnnotations(result: unknown): LlmAnnotation[] {
  const row = asRecord(result)
  const items = Array.isArray(row?.items) ? row.items : []
  return items.flatMap((item) => {
    const sections = Array.isArray(asRecord(item)?.sections)
      ? (asRecord(item)?.sections as unknown[])
      : []
    return sections.flatMap((section) => {
      const list = Array.isArray(asRecord(section)?.annotations)
        ? (asRecord(section)?.annotations as unknown[])
        : []
      return list.flatMap((entry) => {
        const annotation = asRecord(entry)
        if (!annotation) return []
        return [
          {
            title: asTrimmed(annotation.title),
            url: asTrimmed(annotation.url),
          },
        ]
      })
    })
  })
}

/** O texto corrido da resposta, para casar nomes de marca. */
export function readLlmText(result: unknown): string {
  const row = asRecord(result)
  const items = Array.isArray(row?.items) ? row.items : []
  return items
    .flatMap((item) => {
      const sections = Array.isArray(asRecord(item)?.sections)
        ? (asRecord(item)?.sections as unknown[])
        : []
      return sections.map((section) => asTrimmed(asRecord(section)?.text) ?? "")
    })
    .join(" ")
}

/** Sem acento e sem caixa: "Agência Mestre" e "agencia mestre" são a mesma. */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

export type GeoBrandMatch = { name: string; position: number }

/**
 * Onde cada marca aparece pela primeira vez no texto, em ordem.
 *
 * **`position` é a ordem de ocorrência entre as marcas detectadas — não é
 * posição em lista numerada, e a tela precisa dizer isso.** Não havia
 * alternativa: `start_index`/`end_index` vêm preenchidos em `chat_gpt` e
 * `gemini` e **`null` em `claude` e `perplexity`**, medido em 2026-09-11.
 * Posição por índice de caractere não é portável entre plataformas.
 *
 * **Marca fora da lista fica não detectada, e a tela declara isso** — em vez de
 * afirmar dominância sobre um universo que ninguém mediu.
 */
export function matchBrands(
  text: string,
  brands: readonly string[],
): GeoBrandMatch[] {
  const haystack = fold(text)
  if (!haystack) return []
  const found: Array<{ name: string; at: number }> = []
  for (const brand of brands) {
    const needle = fold(brand)
    if (!needle) continue
    const at = haystack.indexOf(needle)
    if (at >= 0 && !found.some((item) => fold(item.name) === needle)) {
      found.push({ name: brand, at })
    }
  }
  return found
    .sort((left, right) => left.at - right.at)
    .map((item, index) => ({ name: item.name, position: index + 1 }))
}

export function domainCitedIn(
  annotations: readonly LlmAnnotation[],
  domain: string,
): boolean {
  const root = domain.trim().toLowerCase().replace(/^www\./, "")
  if (!root) return false
  return annotations.some((annotation) => {
    if (!annotation.url) return false
    try {
      const host = new URL(annotation.url).hostname
        .toLowerCase()
        .replace(/^www\./, "")
      return host === root || host.endsWith(`.${root}`)
    } catch {
      return annotation.url.toLowerCase().includes(root)
    }
  })
}

export function buildGeoPromptRun(input: {
  promptId: string
  provider: string
  status: GeoPromptRunStatus
  statusMessage: string | null
  modelName: string | null
  at: string
  result: unknown
  leadBrands: readonly string[]
  competitorBrands: readonly string[]
  domain: string
  costUsd: number | null
}): GeoPromptRun {
  // Execução que não aconteceu não afirma nada sobre a marca. Preencher
  // `mentioned: false` aqui **inventaria ausência**, e de graça — `50301` e
  // `40501` custam zero, então nem o custo denunciaria.
  if (input.status !== "ok") {
    return {
      promptId: input.promptId,
      provider: input.provider,
      modelName: input.modelName,
      at: input.at,
      status: input.status,
      statusMessage: input.statusMessage,
      mentioned: false,
      position: null,
      domainCited: false,
      brands: [],
      costUsd: input.costUsd,
    }
  }

  const text = readLlmText(input.result)
  const annotations = readLlmAnnotations(input.result)
  const todas = [...input.leadBrands, ...input.competitorBrands]
  const brands = matchBrands(text, todas)
  const lead = brands.find((brand) =>
    input.leadBrands.some((name) => fold(name) === fold(brand.name)),
  )

  return {
    promptId: input.promptId,
    provider: input.provider,
    modelName: input.modelName,
    at: input.at,
    status: "ok",
    statusMessage: null,
    mentioned: Boolean(lead),
    position: lead?.position ?? null,
    domainCited: domainCitedIn(annotations, input.domain),
    brands,
    costUsd: input.costUsd,
  }
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((acc, value) => acc + value, 0) / values.length
}

/**
 * As agregadas, **sobre as execuções `ok`**.
 *
 * Contar uma execução que o provedor recusou como "não mencionou" derrubaria a
 * taxa por um motivo que não tem nada a ver com o lead.
 */
export function buildGeoPromptVisibility(input: {
  promptSetVersion: number
  runs: GeoPromptRun[]
  /**
   * Havia marca de concorrente na lista de casamento?
   *
   * **Sem isto a dominância mente para cima.** Medido em 2026-09-11: a lista de
   * concorrentes veio vazia, só o nome do lead entrou no casamento, e a conta
   * deu `dominance: 1` — 100% de participação sobre um universo de uma marca,
   * que é a própria. É exatamente a "dominância sobre um universo que ninguém
   * mediu" que a spec proíbe, e o número mais lisonjeiro que a tela poderia
   * mostrar.
   */
  hasCompetitorBrands: boolean
}): GeoPromptVisibility {
  const ok = input.runs.filter((run) => run.status === "ok")
  const mencionadas = ok.filter((run) => run.mentioned)

  const providers = [...new Set(ok.map((run) => run.provider))]
  const byProvider = providers.map((provider) => {
    const doProvider = ok.filter((run) => run.provider === provider)
    const comMencao = doProvider.filter((run) => run.mentioned)
    return {
      provider,
      mentionRate:
        doProvider.length > 0 ? comMencao.length / doProvider.length : 0,
      averagePosition: mean(
        comMencao
          .map((run) => run.position)
          .filter((value): value is number => value !== null),
      ),
    }
  })

  const todasAsMarcas = new Map<string, { total: number; posicoes: number[] }>()
  for (const run of ok) {
    for (const brand of run.brands) {
      const atual = todasAsMarcas.get(brand.name) ?? { total: 0, posicoes: [] }
      atual.total += 1
      atual.posicoes.push(brand.position)
      todasAsMarcas.set(brand.name, atual)
    }
  }
  const somaDeMencoes = [...todasAsMarcas.values()].reduce(
    (acc, item) => acc + item.total,
    0,
  )

  return {
    promptSetVersion: input.promptSetVersion,
    runs: input.runs,
    metrics: {
      mentionRate: ok.length > 0 ? mencionadas.length / ok.length : 0,
      averagePosition: mean(
        mencionadas
          .map((run) => run.position)
          .filter((value): value is number => value !== null),
      ),
      // `null` em dois casos, e os dois significam "não medido": ninguém
      // detectado (denominador zero), ou nenhuma marca de concorrente na lista
      // de casamento — aí o denominador é só o lead e a conta daria 100%.
      dominance:
        input.hasCompetitorBrands && somaDeMencoes > 0
          ? mencionadas.length / somaDeMencoes
          : null,
      byProvider,
      competitors: [...todasAsMarcas.entries()]
        .map(([name, item]) => ({
          name,
          mentionRate: ok.length > 0 ? item.total / ok.length : 0,
          averagePosition: mean(item.posicoes),
        }))
        .sort((left, right) => right.mentionRate - left.mentionRate),
    },
  }
}
