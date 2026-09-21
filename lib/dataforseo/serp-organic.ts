/**
 * Leitor da SERP orgânica. **Puro** — a chamada é da Task 8.
 *
 * Esta é a peça mais reaproveitada da fase: a mesma resposta alimenta três
 * coisas que antes pareciam exigir chamadas separadas.
 *
 * 1. **Clustering** (Task 9) — pelas URLs do top 10.
 * 2. **Concorrentes** (Task 6) — quem ocupa essas posições. Medido em
 *    `loja de tintas em itu`, o top 10 traz `segtintas.com.br`,
 *    `itutintas.com.br` e `grupoitutintas.com.br` — lojas de tinta de verdade,
 *    enquanto o `competitors_domain` do mesmo cliente devolveu `instagram.com`
 *    e `cnpj.biz`.
 * 3. **People Also Ask** (pilar D) — no mesmo payload, sem custo extra.
 *
 * **URL exata, nunca domínio.** O agrupamento por sobreposição compara URLs;
 * duas keywords que trazem páginas diferentes do mesmo site pertencem a
 * clusters diferentes, e é esse o sinal de que precisam de páginas separadas.
 */

/** Quantas posições entram no conjunto de sobreposição. */
export const SERP_OVERLAP_DEPTH = 10

export const SERP_ORGANIC_LIVE_PATH = "/serp/google/organic/live/advanced"
export const SERP_ORGANIC_TASK_POST_PATH = "/serp/google/organic/task_post"
export const SERP_ORGANIC_TASK_GET_PATH =
  "/serp/google/organic/task_get/advanced"

/**
 * Profundidade pedida.
 *
 * Maior que `SERP_OVERLAP_DEPTH` de propósito: o corte para sobreposição é
 * feito depois, sobre `rank_group`, e pedir com folga evita que uma SERP
 * carregada de recursos deixe o top 10 orgânico incompleto.
 */
export const SERP_ORGANIC_DEPTH = 20

/**
 * Construtor da tarefa. Único, para consulta enfileirada e ao vivo medirem a
 * mesma coisa — é a armadilha dos métodos divergentes na mesma série temporal,
 * que já custou o `maps-task.ts`.
 *
 * `location_code` de **cidade** é aceito aqui: a restrição de país vale para
 * `dataforseo_labs/*`, não para a SERP.
 */
export function serpOrganicTask(params: {
  keyword: string
  locationCode: number
  languageCode: string
  /** Correlação de volta. Vai em `data.tag` no eco da resposta. */
  tag?: string | null
  depth?: number
}): Record<string, unknown> {
  const tarefa: Record<string, unknown> = {
    keyword: params.keyword,
    location_code: params.locationCode,
    language_code: params.languageCode,
    depth: params.depth ?? SERP_ORGANIC_DEPTH,
  }
  if (params.tag) tarefa.tag = params.tag
  return tarefa
}

/**
 * `rankGroup` e `rankAbsolute` dizem coisas diferentes, e confundi-los faz o
 * relatório mentir. Medido: nesta SERP o cliente é o **1º orgânico**
 * (`rank_group: 1`) mas o **4º item da página** (`rank_absolute: 4`), porque há
 * três resultados de local pack antes dele.
 *
 * Posição orgânica é `rankGroup`. `rankAbsolute` é onde o olho encontra.
 */
export type SerpOrganicItem = {
  url: string
  domain: string
  rankGroup: number | null
  rankAbsolute: number | null
  title: string | null
}

export type SerpLocalPackItem = {
  title: string | null
  domain: string | null
  rankGroup: number | null
  rankAbsolute: number | null
}

export type SerpSnapshot = {
  keyword: string
  locationCode: number | null
  languageCode: string | null
  /** Endereço reproduzível da consulta, para auditoria. */
  checkUrl: string | null
  organic: SerpOrganicItem[]
  localPack: SerpLocalPackItem[]
  peopleAlsoAsk: string[]
  /** Tipos de item presentes, para saber o que a SERP tem sem varrer de novo. */
  featureTypes: string[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asTextOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null
  const texto = value.trim()
  return texto ? texto : null
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/**
 * Envelope de `serp/google/organic/live/advanced` → snapshot.
 *
 * Devolve `null` quando a tarefa falhou, e **não** um snapshot vazio: SERP que
 * não foi coletada e SERP sem resultado orgânico são coisas diferentes, e
 * confundir as duas faz o clustering inventar cluster de um item só.
 */
export function mapSerpOrganic(envelope: unknown): SerpSnapshot | null {
  const raiz = asRecord(envelope)
  const tarefa = asRecord(Array.isArray(raiz?.tasks) ? raiz.tasks[0] : null)
  if (!tarefa) return null

  const statusCode = asNumberOrNull(tarefa.status_code)
  if (statusCode !== null && statusCode >= 40000) return null

  const resultado = asRecord(
    Array.isArray(tarefa.result) ? tarefa.result[0] : null,
  )
  if (!resultado) return null

  const keyword = asTextOrNull(resultado.keyword)
  if (!keyword) return null

  const itens = Array.isArray(resultado.items) ? resultado.items : []

  const organic: SerpOrganicItem[] = []
  const localPack: SerpLocalPackItem[] = []
  const peopleAlsoAsk: string[] = []
  const featureTypes = new Set<string>()

  for (const bruto of itens) {
    const item = asRecord(bruto)
    if (!item) continue
    const tipo = asTextOrNull(item.type)
    if (tipo) featureTypes.add(tipo)

    if (tipo === "organic") {
      const url = asTextOrNull(item.url)
      const domain = asTextOrNull(item.domain)
      // Sem URL o item não serve para sobreposição, que é o uso principal.
      if (!url || !domain) continue
      organic.push({
        url,
        domain,
        rankGroup: asNumberOrNull(item.rank_group),
        rankAbsolute: asNumberOrNull(item.rank_absolute),
        title: asTextOrNull(item.title),
      })
      continue
    }

    if (tipo === "local_pack") {
      localPack.push({
        title: asTextOrNull(item.title),
        domain: asTextOrNull(item.domain),
        rankGroup: asNumberOrNull(item.rank_group),
        rankAbsolute: asNumberOrNull(item.rank_absolute),
      })
      continue
    }

    if (tipo === "people_also_ask") {
      const perguntas = Array.isArray(item.items) ? item.items : []
      for (const bruta of perguntas) {
        const pergunta = asRecord(bruta)
        const titulo = asTextOrNull(pergunta?.title)
        if (titulo) peopleAlsoAsk.push(titulo)
      }
    }
  }

  return {
    keyword,
    locationCode: asNumberOrNull(resultado.location_code),
    languageCode: asTextOrNull(resultado.language_code),
    checkUrl: asTextOrNull(resultado.check_url),
    organic,
    localPack,
    peopleAlsoAsk,
    featureTypes: [...featureTypes],
  }
}

/**
 * As URLs que entram no grafo de sobreposição.
 *
 * Corta em `SERP_OVERLAP_DEPTH` por `rank_absolute` quando ele existe — o
 * `depth` da consulta pode trazer mais que 10, e comparar profundidades
 * diferentes entre keywords produziria sobreposição inventada.
 */
export function overlapUrls(
  snapshot: SerpSnapshot,
  depth = SERP_OVERLAP_DEPTH,
): string[] {
  // Ordena por posição ORGÂNICA. `rankAbsolute` daria a mesma ordem aqui, mas
  // é o número da página inteira e não o da disputa que se está medindo.
  const ordenados = snapshot.organic
    .slice()
    .sort((a, b) => (a.rankGroup ?? 1e9) - (b.rankGroup ?? 1e9))
  return ordenados.slice(0, depth).map((item) => item.url)
}
