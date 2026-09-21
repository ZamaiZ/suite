/**
 * Expansão de palavras-chave — construtor da tarefa e leitor da resposta.
 * **Puro**, para ser testável: sem `server-only` e sem alias, como
 * `maps-task.ts`. Quem faz a chamada é `client.ts`.
 *
 * A forma dos campos foi **medida** na sondagem da Task 1 contra payload real,
 * não lida em documentação — `docs/auditoria/evidencias/2026-09-18-fase3-pesquisa/README.md`.
 * O repositório já pagou seis meses por supor forma de payload no
 * `mapRankedKeywordsLiveResult`.
 *
 * **`null` e `0` não são a mesma coisa, e a diferença é grande aqui.** Medido
 * numa só chamada: 4.831 candidatas, das quais **1.514 com `search_volume`
 * nulo** e **1.274 com `search_volume` zero**. Nulo é volume que o Google não
 * informou; zero é volume informado e igual a zero. Achatar os dois em zero
 * jogaria fora 31% do conjunto por um motivo que não é verdade, e faria o
 * veredito da Task 11 chamar de "sem volume" o que é "sem medida".
 */

import type { MonthlyVolume } from "../research/types.ts"

/**
 * Teto de seeds por chamada.
 *
 * **Medido**, não lido em documentação: mandar 50 seeds devolve
 * `40501 Invalid Field: 'keywords'. Max number exceeded (20/21)` — e custa
 * US$ 0, então o erro é barato mas o fatiamento é obrigatório.
 *
 * Consequência de custo: 50 seeds são **três chamadas** a US$ 0,09, não uma.
 */
export const KEYWORDS_FOR_KEYWORDS_MAX_SEEDS = 20

/**
 * O que a expansão sabe de uma candidata.
 *
 * `difficulty` e `mainIntent` só vêm de `keyword_ideas` — o
 * `keywords_for_keywords` não os traz. Ficam `null` para as candidatas da outra
 * fonte, e isso poupa parte das chamadas de `search_intent` da Task 5.
 */
export type ExpandedKeyword = {
  keyword: string
  searchVolume: number | null
  monthlySearches: MonthlyVolume[] | null
  /** Rótulo `HIGH` / `MEDIUM` / `LOW`, normalizado entre as duas fontes. */
  competition: string | null
  competitionIndex: number | null
  cpc: number | null
  /** Em qual localidade este volume foi medido. */
  locationCode: number | null
  difficulty: number | null
  mainIntent: string | null
}

export type KeywordsForKeywordsTask = {
  keywords: string[]
  location_code: number
  language_code: string
}

/* -------------------------------------------------------------------------- */
/*  Construtor                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Fatia os seeds em tarefas de no máximo `KEYWORDS_FOR_KEYWORDS_MAX_SEEDS`.
 *
 * `location_code` aqui pode ser cidade: este é endpoint de `keywords_data`, não
 * do Labs. A restrição de país vale para `dataforseo_labs/*`, que tem 94
 * localidades no mundo e uma para o Brasil.
 */
export function keywordsForKeywordsTasks(params: {
  seeds: string[]
  locationCode: number
  languageCode: string
}): KeywordsForKeywordsTask[] {
  const limpos: string[] = []
  const vistos = new Set<string>()
  for (const seed of params.seeds) {
    const texto = typeof seed === "string" ? seed.trim() : ""
    const chave = texto.toLowerCase()
    if (!texto || vistos.has(chave)) continue
    vistos.add(chave)
    limpos.push(texto)
  }

  const tarefas: KeywordsForKeywordsTask[] = []
  for (let i = 0; i < limpos.length; i += KEYWORDS_FOR_KEYWORDS_MAX_SEEDS) {
    tarefas.push({
      keywords: limpos.slice(i, i + KEYWORDS_FOR_KEYWORDS_MAX_SEEDS),
      location_code: params.locationCode,
      language_code: params.languageCode,
    })
  }
  return tarefas
}

/* -------------------------------------------------------------------------- */
/*  Leitor                                                                    */
/* -------------------------------------------------------------------------- */

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/** Preserva `null`. Só devolve número quando é número de verdade. */
function asNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asTextOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null
  const texto = value.trim()
  return texto ? texto : null
}

/**
 * `monthly_searches` nulo é ausência de histórico, e continua nulo. Lista
 * presente vira lista — nunca `null` virando `[]`, que afirmaria "medido e
 * vazio".
 */
function readMonthlySearches(value: unknown): MonthlyVolume[] | null {
  if (!Array.isArray(value)) return null
  const meses: MonthlyVolume[] = []
  for (const bruto of value) {
    const item = asRecord(bruto)
    if (!item) continue
    const year = asNumberOrNull(item.year)
    const month = asNumberOrNull(item.month)
    const searchVolume = asNumberOrNull(item.search_volume)
    if (year === null || month === null) continue
    meses.push({ year, month, searchVolume: searchVolume ?? 0 })
  }
  return meses
}

/**
 * Envelope de `keywords_for_keywords` → candidatas.
 *
 * O resultado deste endpoint fica em `tasks[i].result[]` **direto**, sem o
 * `result[0].items[]` que os endpoints do Labs usam. Confundir os dois devolve
 * lista vazia sem erro nenhum.
 */
export function mapKeywordsForKeywords(envelope: unknown): ExpandedKeyword[] {
  const raiz = asRecord(envelope)
  const tasks = Array.isArray(raiz?.tasks) ? raiz.tasks : []

  const saida: ExpandedKeyword[] = []
  const vistos = new Set<string>()

  for (const brutaTarefa of tasks) {
    const tarefa = asRecord(brutaTarefa)
    if (!tarefa) continue
    const resultados = Array.isArray(tarefa.result) ? tarefa.result : []

    for (const bruto of resultados) {
      const item = asRecord(bruto)
      if (!item) continue

      const keyword = asTextOrNull(item.keyword)
      if (!keyword) continue

      const chave = keyword.toLowerCase()
      if (vistos.has(chave)) continue
      vistos.add(chave)

      saida.push({
        keyword,
        searchVolume: asNumberOrNull(item.search_volume),
        monthlySearches: readMonthlySearches(item.monthly_searches),
        competition: asTextOrNull(item.competition),
        competitionIndex: asNumberOrNull(item.competition_index),
        cpc: asNumberOrNull(item.cpc),
        locationCode: asNumberOrNull(item.location_code),
        difficulty: null,
        mainIntent: null,
      })
    }
  }

  return saida
}

/**
 * Envelope de `keyword_ideas` → candidatas.
 *
 * **Três diferenças de forma** em relação ao `keywords_for_keywords`, e cada
 * uma quebra em silêncio se ignorada:
 *
 * 1. O resultado é aninhado — `result[0].items[]` — e não `result[]` direto.
 * 2. As métricas moram em `keyword_info`, não na raiz do item.
 * 3. `competition` é **número de 0 a 1**, e o rótulo está em
 *    `competition_level`. No outro endpoint `competition` já é o rótulo. Ler o
 *    número como se fosse rótulo produz `"1"` onde deveria estar `"HIGH"`.
 *
 * Em troca ele traz o que o outro não tem: `keyword_difficulty` e
 * `search_intent_info.main_intent`.
 *
 * Vale a chamada: medido contra as 4.831 já pagas, **72% dos 200 itens eram
 * inéditos** — e o que apareceu foi categoria inteira que faltava, marcas de
 * tinta como `suvinil` e `coral`, que seeds genéricos não alcançam.
 */
export function mapKeywordIdeas(envelope: unknown): ExpandedKeyword[] {
  const raiz = asRecord(envelope)
  const tasks = Array.isArray(raiz?.tasks) ? raiz.tasks : []

  const saida: ExpandedKeyword[] = []
  const vistos = new Set<string>()

  for (const brutaTarefa of tasks) {
    const tarefa = asRecord(brutaTarefa)
    if (!tarefa) continue
    const resultados = Array.isArray(tarefa.result) ? tarefa.result : []

    for (const brutoResultado of resultados) {
      const resultado = asRecord(brutoResultado)
      const itens = Array.isArray(resultado?.items) ? resultado.items : []

      for (const bruto of itens) {
        const item = asRecord(bruto)
        if (!item) continue

        const keyword = asTextOrNull(item.keyword)
        if (!keyword) continue

        const chave = keyword.toLowerCase()
        if (vistos.has(chave)) continue
        vistos.add(chave)

        const info = asRecord(item.keyword_info)
        const props = asRecord(item.keyword_properties)
        const intent = asRecord(item.search_intent_info)

        saida.push({
          keyword,
          searchVolume: asNumberOrNull(info?.search_volume),
          monthlySearches: readMonthlySearches(info?.monthly_searches),
          competition: asTextOrNull(info?.competition_level),
          competitionIndex: asNumberOrNull(info?.competition),
          cpc: asNumberOrNull(info?.cpc),
          locationCode: asNumberOrNull(item.location_code),
          difficulty: asNumberOrNull(props?.keyword_difficulty),
          mainIntent: asTextOrNull(intent?.main_intent),
        })
      }
    }
  }

  return saida
}

/**
 * Soma dos 12 meses, quando há histórico.
 *
 * Existe porque `search_volume` é média e some a sazonalidade: medido,
 * `tinta emborrachada` tem média 170 e picos de 210 em julho e agosto. Quem
 * decide calendário de conteúdo precisa do pico, não da média.
 */
export function yearlyVolume(kw: ExpandedKeyword): number | null {
  if (!kw.monthlySearches || kw.monthlySearches.length === 0) return null
  return kw.monthlySearches.reduce((total, mes) => total + mes.searchVolume, 0)
}

/** Maior mês do histórico, com o volume. `null` quando não há histórico. */
export function peakMonth(
  kw: ExpandedKeyword,
): { year: number; month: number; searchVolume: number } | null {
  if (!kw.monthlySearches || kw.monthlySearches.length === 0) return null
  return kw.monthlySearches.reduce((maior, mes) =>
    mes.searchVolume > maior.searchVolume ? mes : maior,
  )
}
