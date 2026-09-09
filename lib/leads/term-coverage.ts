import { BR_STATES, type BrazilStateCode } from "@/lib/br-locations"

/**
 * Cobertura de termos: a descrição do perfil e o conteúdo do site mencionam o
 * que o negócio faz e onde atua?
 *
 * Responde "menciona / não menciona", e nada além disso. Qualidade de texto
 * continua sendo julgamento humano — o projeto não tem LLM e abrir essa porta é
 * decisão de arquitetura, não um cálculo. Ver a spec do Report 0.
 *
 * Módulo puro de propósito: as regras de gap que o consomem rodam em componente
 * de cliente, e alcançar `server-only` por caminho transitivo quebraria o build.
 */

/** Abaixo disto o termo casa por acidente dentro de qualquer texto. */
const MIN_TERM_LENGTH = 2

/**
 * Só palavras a partir deste tamanho perdem o "s" final na comparação. Sem o
 * piso, "gás" viraria "gá" e "mês" viraria "mê".
 */
const MIN_PLURAL_LENGTH = 4

export type TermGroup = "services" | "region" | "category"

export const TERM_GROUP_LABELS: Record<TermGroup, string> = {
  services: "serviços",
  region: "região",
  category: "categoria",
}

export type Term = {
  /** Como o termo aparece no achado, com acento e maiúscula. */
  label: string
  /** Forma comparável, já dobrada e sem plural. */
  folded: string
}

export type TermSet = Record<TermGroup, Term[]>

export type TermGroupCoverage = {
  group: TermGroup
  present: string[]
  missing: string[]
  /**
   * `false` quando o grupo nasceu sem nenhum termo. Grupo sem fonte não é grupo
   * descoberto: não há o que cobrir, e tratar os dois igual acusaria todo lead
   * sem serviços cadastrados de não falar dos serviços.
   */
  measured: boolean
}

export type TermCoverage = Record<TermGroup, TermGroupCoverage>

/**
 * Mesma técnica de `foldTitle` e de `foldText` em `br-locations`, com um passo a
 * mais: pontuação vira espaço. Aqui o casamento acontece dentro de prosa, e
 * "Cremação, velório" precisa render dois termos e não um.
 */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

/**
 * Tolerância de plural, deliberadamente rasa: "planos funerários" casa com
 * "plano funerário", e é isso. Não é stemmer — "análise" e "analisar" seguem
 * sendo termos diferentes, e fingir o contrário produziria cobertura falsa.
 */
function singular(word: string): string {
  return word.length >= MIN_PLURAL_LENGTH && word.endsWith("s")
    ? word.slice(0, -1)
    : word
}

function comparable(value: string): string {
  const folded = fold(value)
  if (!folded) return ""
  return folded.split(" ").filter(Boolean).map(singular).join(" ")
}

function term(label: string): Term | null {
  const trimmed = label.trim()
  if (trimmed.length < MIN_TERM_LENGTH) return null
  const folded = comparable(trimmed)
  if (folded.length < MIN_TERM_LENGTH) return null
  return { label: trimmed, folded }
}

function uniqueTerms(labels: ReadonlyArray<string | null | undefined>): Term[] {
  const seen = new Set<string>()
  const terms: Term[] = []
  for (const label of labels) {
    if (!label) continue
    const parsed = term(label)
    if (!parsed || seen.has(parsed.folded)) continue
    seen.add(parsed.folded)
    terms.push(parsed)
  }
  return terms
}

function stateName(code: BrazilStateCode | null | undefined): string | null {
  if (!code) return null
  return BR_STATES.find((state) => state.code === code)?.name ?? null
}

export type BuildTermSetInput = {
  /** Títulos dos serviços do perfil. `null` distingue ausente de vazio. */
  services?: ReadonlyArray<string> | null
  category?: string | null
  additionalCategories?: ReadonlyArray<string> | null
  segmentName?: string | null
  city?: string | null
  stateCode?: BrazilStateCode | null
}

/**
 * As âncoras de ranking ficam de fora de propósito. Elas são frases que o
 * analista escolheu monitorar — "funeraria em sao paulo" —, e os termos úteis
 * dentro delas já entram por `category` e por `city`. Quebrá-las em pedaços
 * inventaria termos que ninguém escreveu.
 */
export function buildTermSet(input: BuildTermSetInput): TermSet {
  return {
    services: uniqueTerms(input.services ?? []),
    region: uniqueTerms([input.city, input.stateCode, stateName(input.stateCode)]),
    category: uniqueTerms([
      input.category,
      ...(input.additionalCategories ?? []),
      input.segmentName,
    ]),
  }
}

export function termSetIsEmpty(termSet: TermSet): boolean {
  return (
    termSet.services.length === 0 &&
    termSet.region.length === 0 &&
    termSet.category.length === 0
  )
}

function coverGroup(
  group: TermGroup,
  terms: readonly Term[],
  haystack: string,
): TermGroupCoverage {
  if (terms.length === 0) {
    return { group, present: [], missing: [], measured: false }
  }
  const present: string[] = []
  const missing: string[] = []
  for (const item of terms) {
    // Espaço nas bordas dos dois lados: sem isso "SP" casaria dentro de
    // "esporte" e a cobertura seria sempre perfeita.
    if (haystack.includes(` ${item.folded} `)) present.push(item.label)
    else missing.push(item.label)
  }
  return { group, present, missing, measured: true }
}

/**
 * `texts` recebe título, headings e corpo separados em vez de um texto só: quem
 * chama já tem as partes, e concatenar do lado de fora esconderia que um termo
 * apareceu apenas no menu.
 */
export function termCoverage(
  texts: ReadonlyArray<string | null | undefined>,
  termSet: TermSet,
): TermCoverage {
  const joined = texts.filter(Boolean).join(" ")
  const haystack = ` ${comparable(joined)} `
  return {
    services: coverGroup("services", termSet.services, haystack),
    region: coverGroup("region", termSet.region, haystack),
    category: coverGroup("category", termSet.category, haystack),
  }
}

/** Teto de nomes no detalhe do achado: a lista é evidência, não inventário. */
export const TERM_DETAIL_MAX = 5

export function missingTermsDetail(coverage: TermGroupCoverage): string | null {
  if (!coverage.measured || coverage.missing.length === 0) return null
  const shown = coverage.missing.slice(0, TERM_DETAIL_MAX)
  const rest = coverage.missing.length - shown.length
  const list = shown.join(", ")
  return rest > 0 ? `Não menciona: ${list} e mais ${rest}` : `Não menciona: ${list}`
}
