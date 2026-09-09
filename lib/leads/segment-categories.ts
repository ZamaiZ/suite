/**
 * A categoria principal do perfil no Google conversa com o segmento do lead?
 *
 * O documento de referência afirma "Categoria principal: Casa funerária
 * (✔ correto)" — um julgamento que hoje ninguém faz, porque a categoria é
 * coletada e nenhuma regra a confronta com nada.
 *
 * **Sem dicionário grande de propósito.** O casamento primário é por palavra
 * significativa compartilhada, que funciona para a maioria dos pares reais
 * ("Funerária" × "Casa funerária") e envelhece sozinho. A tabela de sinônimos
 * existe só para os pares em que as palavras genuinamente diferem, e nasce
 * pequena: hoje há **um** segmento cadastrado no banco, e escrever entradas para
 * segmentos que ninguém criou seria escrever para envelhecer.
 *
 * Módulo puro: consumido por regra de gap que roda em componente de cliente.
 */

/** Abaixo disto a palavra casa por acidente e não distingue segmento nenhum. */
const MIN_WORD_LENGTH = 4

/**
 * Palavras que aparecem em categoria de qualquer ramo. Sem esta lista,
 * "Loja de tintas" e "Loja de móveis" casariam por "loja".
 */
const GENERIC_WORDS = new Set([
  "casa",
  "loja",
  "empresa",
  "servico",
  "servicos",
  "centro",
  "agencia",
  "escritorio",
  "comercio",
  "geral",
  "profissional",
])

/**
 * Só para pares cujas palavras não se encontram. Cada entrada precisa de um par
 * real que a justifique — entrada especulativa é dívida que ninguém revisa.
 */
const SEGMENT_SYNONYMS: Record<string, readonly string[]> = {
  advocacia: ["advogado", "juridico"],
  contabilidade: ["contador", "contabil"],
  odontologia: ["dentista", "odontologico"],
  veterinaria: ["veterinario", "petshop"],
  estetica: ["esteticista", "beleza"],
}

export type SegmentCategoryVerdict = "aligned" | "misaligned" | "unknown"

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

function significantWords(value: string): string[] {
  return fold(value)
    .split(" ")
    .filter(Boolean)
    .map((word) => (word.length >= 5 && word.endsWith("s") ? word.slice(0, -1) : word))
    .filter((word) => word.length >= MIN_WORD_LENGTH && !GENERIC_WORDS.has(word))
}

function expectedWords(segmentName: string): Set<string> {
  const words = significantWords(segmentName)
  const expected = new Set(words)
  for (const word of words) {
    for (const synonym of SEGMENT_SYNONYMS[word] ?? []) {
      for (const part of significantWords(synonym)) expected.add(part)
    }
  }
  return expected
}

/**
 * `unknown` quando não há segmento, quando não há categoria, ou quando o
 * segmento não tem palavra significativa — as três são ausência de referência,
 * e ausência de referência não é divergência. É a mesma disciplina que fez
 * `no_services` exigir `services !== null`.
 */
export function segmentCategoryVerdict(input: {
  segmentName: string | null | undefined
  category: string | null | undefined
  additionalCategories?: ReadonlyArray<string> | null
}): SegmentCategoryVerdict {
  if (!input.segmentName?.trim() || !input.category?.trim()) return "unknown"
  const expected = expectedWords(input.segmentName)
  if (expected.size === 0) return "unknown"

  const found = new Set<string>()
  for (const label of [input.category, ...(input.additionalCategories ?? [])]) {
    if (!label) continue
    for (const word of significantWords(label)) found.add(word)
  }
  if (found.size === 0) return "unknown"

  for (const word of expected) {
    if (found.has(word)) return "aligned"
  }
  return "misaligned"
}

/** O detalhe carrega os dois lados: sem eles o achado é acusação sem prova. */
export function segmentCategoryDetail(input: {
  segmentName: string | null | undefined
  category: string | null | undefined
}): string | undefined {
  if (!input.segmentName || !input.category) return undefined
  return `Segmento “${input.segmentName}”, categoria “${input.category}”`
}
