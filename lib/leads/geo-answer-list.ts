/**
 * A lista ordenada de empresas que cada LLM escreveu na resposta. Puro.
 *
 * **A LLM é objeto de medição, nunca instrumento de análise.** Nada aqui pede
 * opinião a um modelo: o que se lê é a lista que ele mesmo escreveu, do jeito
 * que escreveu.
 *
 * **`rank` é ordem de aparição, nunca ranking de qualidade.** Medido em
 * 2026-09-11: o ChatGPT declara no próprio texto que sua lista está em *"ordem
 * alfabética"* — e está —, e as outras três não declaram ordem nenhuma. Pintar
 * esse número com faixa de cor diria que quem começa com A é melhor. A tela
 * mostra `6ª de 8` em tom neutro, e chama de ordem de aparição.
 *
 * **São quatro leitores, não um.** A spec supunha uma forma com variações. A
 * medição achou quatro formas, e uma delas não é lista — o Perplexity responde
 * em tabela. Um leitor genérico de "todos os bullets" acha 17 itens no ChatGPT
 * e **zero** no Perplexity.
 *
 * Evidência: `docs/auditoria/evidencias/2026-09-11-lista-ordenada/`.
 */

export type GeoAnswerEntry = { name: string; rank: number }

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/**
 * Sem acento e sem caixa: "Agência Mestre" e "agencia mestre" são a mesma.
 *
 * Mora aqui, e não em `geo-prompt-visibility.ts`, porque aquele módulo importa
 * deste — duas dobras divergem na primeira mudança, e a importação inversa
 * fecharia um ciclo.
 */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * O texto da **resposta**, sem o raciocínio do modelo.
 *
 * `items[].type` é `"reasoning"` ou `"message"` — campo tipado, não heurística
 * de texto. Medido no dump do ChatGPT: 3 items, 2 de raciocínio e 1 de
 * resposta, e os **únicos dois** trechos em negrito da resposta inteira estão
 * no raciocínio (`**Searching for SEO companies**`, `**Compiling agency
 * recommendations**`). Um leitor que não filtrasse devolveria exatamente esses
 * dois como as empresas.
 */
export function readMessageText(result: unknown): string {
  const row = asRecord(result)
  const items = Array.isArray(row?.items) ? row.items : []
  return items
    .filter((item) => asRecord(item)?.type === "message")
    .flatMap((item) => {
      const sections = Array.isArray(asRecord(item)?.sections)
        ? (asRecord(item)?.sections as unknown[])
        : []
      return sections.map((section) => {
        const text = asRecord(section)?.text
        return typeof text === "string" ? text : ""
      })
    })
    .join("\n")
}

/** Teto de leitura. Lista maior que isto é resposta que fugiu do formato. */
const MAX_ENTRIES = 30

/**
 * Limpa o que gruda no nome e não é nome.
 *
 * Medido: o Perplexity sufixa marcador de citação (`[5]`), o ChatGPT sufixa a
 * fonte entre parênteses (`([host](url))`), o Gemini termina o nome em `:`.
 * Nome com sujeira não casa com a marca do lead — e falso negativo aqui vira
 * "as IAs não reconhecem a marca" num documento comercial.
 */
function cleanName(raw: string): string | null {
  const name = raw
    .replace(/\(\[[^\]]*\]\([^)]*\)\)/g, "")
    .replace(/\[\d+\]/g, "")
    .replace(/\*\*/g, "")
    .replace(/[\s:–—-]+$/u, "")
    .replace(/^[\s*•:–—-]+/u, "")
    .replace(/\s+/g, " ")
    .trim()
  if (name.length < 2 || name.length > 90) return null
  return name
}

function entries(names: readonly string[]): GeoAnswerEntry[] {
  const out: GeoAnswerEntry[] = []
  const vistos = new Set<string>()
  for (const raw of names) {
    const name = cleanName(raw)
    if (!name) continue
    const chave = fold(name)
    // Marca repetida não ganha duas posições: o Perplexity cita os mesmos nomes
    // na frase e de novo na tabela.
    if (vistos.has(chave)) continue
    vistos.add(chave)
    out.push({ name, rank: out.length + 1 })
    if (out.length >= MAX_ENTRIES) break
  }
  return out
}

const BULLET = /^\s*[-*•]\s+(\S.*)$/
const NUMBERED_BOLD = /^\s*(\d+)[.)]\s+\*\*(.+?)\*\*/

/**
 * A **primeira** sequência de bullets, e só ela.
 *
 * Três das quatro plataformas emendam uma seção de "como escolher" depois das
 * empresas, na mesma marcação. Medido: o ChatGPT lista 8 empresas e depois 6
 * bullets de conselho (*"Transparência e relatórios:"*); o Gemini lista 11 e
 * depois 4. Sem este corte, "Transparência e relatórios" entra na tela como
 * concorrente do lead.
 *
 * O corte é a primeira linha de prosa depois que a lista começou — que é onde
 * as duas põem a frase que abre o conselho. Linha em branco não corta: ela
 * separa itens, não seções.
 */
function firstBulletRun(text: string): string[] {
  const out: string[] = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    const bullet = BULLET.exec(line)
    if (bullet) {
      out.push(bullet[1])
      continue
    }
    if (out.length > 0) break
  }
  return out
}

/**
 * ChatGPT — bullet `- Nome — descrição ([host](url))`.
 *
 * O nome termina no travessão. Zero linha numerada na resposta medida, e o
 * negrito só aparece no raciocínio, então nem numeração nem negrito servem
 * aqui.
 */
function readChatGpt(text: string): GeoAnswerEntry[] {
  return entries(
    firstBulletRun(text).map((item) => item.split(/\s[—–]\s/)[0] ?? item),
  )
}

/**
 * Claude — numerada `N. **Nome** - descrição`, sob heading `##`.
 *
 * É a única das quatro que separa as empresas do conselho por heading, e a
 * única cujo conselho é bullet enquanto as empresas são numeradas. A numeração
 * sequencial a partir de 1 é o corte: o conselho não entra porque não é
 * numerado, e a descrição cai em linha própria, que não casa o padrão.
 */
function readClaude(text: string): GeoAnswerEntry[] {
  const nomes: string[] = []
  let esperado = 1
  for (const line of text.split(/\r?\n/)) {
    const m = NUMBERED_BOLD.exec(line)
    if (!m) continue
    if (Number(m[1]) !== esperado) continue
    nomes.push(m[2])
    esperado += 1
  }
  return entries(nomes)
}

/** Gemini — bullet `*   **Nome:** descrição`. O nome mora no negrito. */
function readGemini(text: string): GeoAnswerEntry[] {
  return entries(
    firstBulletRun(text).flatMap((item) => {
      const m = /^\*\*(.+?)\*\*/.exec(item.trim())
      return m ? [m[1]] : []
    }),
  )
}

/**
 * Perplexity — tabela markdown.
 *
 * **Não tem bullet nem numeração**: zero de cada na resposta medida. A lista
 * dele é uma tabela, e o nome é a primeira célula.
 *
 * Só a primeira célula, e por isso: a segunda também tem negrito, mas com
 * atributo em vez de nome — *"**SEO técnico e de conteúdo**"*, *"**10 anos de
 * mercado**"*. Ler o negrito da linha inteira misturaria os dois. Exigir
 * negrito na primeira célula também é o que descarta o cabeçalho da tabela.
 */
function readPerplexity(text: string): GeoAnswerEntry[] {
  const nomes: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith("|")) continue
    const primeira = trimmed.split("|")[1] ?? ""
    const m = /\*\*(.+?)\*\*/.exec(primeira)
    if (!m) continue
    nomes.push(m[1])
  }
  return entries(nomes)
}

const READERS: Record<string, (text: string) => GeoAnswerEntry[]> = {
  chat_gpt: readChatGpt,
  claude: readClaude,
  gemini: readGemini,
  perplexity: readPerplexity,
}

/**
 * A lista ordenada que o modelo escreveu, na forma daquela plataforma.
 *
 * Plataforma desconhecida devolve `[]` — **não** um palpite. Um leitor genérico
 * de reserva erraria calado, que é o modo de falha que esta etapa recusa.
 */
export function readAnswerList(
  result: unknown,
  platform: string,
): GeoAnswerEntry[] {
  const reader = READERS[platform]
  if (!reader) return []
  const text = readMessageText(result)
  if (!text.trim()) return []
  return reader(text)
}

/**
 * Onde o lead caiu na lista. `null` = não está nela.
 *
 * `null` **não** é "não citado": a marca pode aparecer na prosa sem entrar na
 * lista. Quem responde por menção é `mentioned`.
 */
export function rankOfBrand(
  list: readonly GeoAnswerEntry[],
  brands: readonly string[],
): number | null {
  const alvos = brands.map(fold).filter((value) => value.length > 0)
  if (alvos.length === 0) return null
  for (const entry of list) {
    const nome = fold(entry.name)
    if (alvos.some((alvo) => nome === alvo || nome.includes(alvo))) {
      return entry.rank
    }
  }
  return null
}
