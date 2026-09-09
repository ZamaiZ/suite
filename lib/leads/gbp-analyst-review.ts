/**
 * Julgamento estruturado do analista sobre o perfil.
 *
 * Duas coisas que nenhuma API responde. **Tempo de resposta**: o corpo da
 * avaliação traz a data de quem avaliou, não a da resposta do proprietário —
 * então velocidade de resposta não é calculável e passa a ser observada.
 * **Diretórios**: backlinks só enxerga citação com link, e a citação local
 * clássica é NAP num diretório sem link nenhum.
 *
 * Mora no perfil e não no snapshot, como `reputation_note`: recoletar não pode
 * apagar nem duplicar julgamento de analista.
 */

export const GBP_REPLY_TIME_BANDS = [
  "same_day",
  "up_to_3_days",
  "up_to_a_week",
  "over_a_week",
  "no_reply",
] as const

export type GbpReplyTimeBand = (typeof GBP_REPLY_TIME_BANDS)[number]

export const GBP_REPLY_TIME_LABELS: Record<GbpReplyTimeBand, string> = {
  same_day: "No mesmo dia",
  up_to_3_days: "Em até 3 dias",
  up_to_a_week: "Em até uma semana",
  over_a_week: "Mais de uma semana",
  no_reply: "Não responde",
}

/** Da faixa para cima a resposta perde o efeito comercial que teria. */
const SLOW_REPLY_BANDS = new Set<GbpReplyTimeBand>(["over_a_week", "no_reply"])

export const GBP_DIRECTORY_IDS = [
  "apontador",
  "guiamais",
  "telelistas",
  "foursquare",
  "yelp",
  "bing_places",
  "waze",
  "kekanto",
] as const

export type GbpDirectoryId = (typeof GBP_DIRECTORY_IDS)[number]

/**
 * O domínio serve para montar uma busca `site:` — sempre funciona e é como o
 * analista confere na prática. Guardar a URL de busca de cada diretório
 * significaria adivinhar parâmetros que mudam sem aviso.
 */
export const GBP_DIRECTORIES: ReadonlyArray<{
  id: GbpDirectoryId
  label: string
  domain: string
}> = [
  { id: "apontador", label: "Apontador", domain: "apontador.com.br" },
  { id: "guiamais", label: "GuiaMais", domain: "guiamais.com.br" },
  { id: "telelistas", label: "Telelistas", domain: "telelistas.net" },
  { id: "foursquare", label: "Foursquare", domain: "foursquare.com" },
  { id: "yelp", label: "Yelp", domain: "yelp.com.br" },
  { id: "bing_places", label: "Bing Places", domain: "bing.com/maps" },
  { id: "waze", label: "Waze", domain: "waze.com" },
  { id: "kekanto", label: "Kekanto", domain: "kekanto.com.br" },
]

/**
 * Três estados pelo mesmo motivo que o NAP do site tem três: "não encontrei" e
 * "encontrei divergente" são diagnósticos diferentes e pedem ações diferentes.
 */
export type GbpDirectoryState = "present" | "absent" | "nap_mismatch"

export const GBP_DIRECTORY_STATE_LABELS: Record<GbpDirectoryState, string> = {
  present: "Cadastrado",
  absent: "Ausente",
  nap_mismatch: "NAP divergente",
}

export type GbpAnalystAnswerMeta = {
  updatedAt: string | null
  updatedBy: string | null
}

export type GbpReplyTimeAnswer = GbpAnalystAnswerMeta & {
  band: GbpReplyTimeBand | null
}

export type GbpDirectoryAnswer = GbpAnalystAnswerMeta & {
  state: GbpDirectoryState | null
}

export type GbpAnalystReview = {
  replyTime: GbpReplyTimeAnswer
  directories: Record<GbpDirectoryId, GbpDirectoryAnswer>
}

function emptyAnswerMeta(): GbpAnalystAnswerMeta {
  return { updatedAt: null, updatedBy: null }
}

export function emptyGbpDirectoryAnswer(): GbpDirectoryAnswer {
  return { state: null, ...emptyAnswerMeta() }
}

export function emptyGbpAnalystReview(): GbpAnalystReview {
  const directories = {} as Record<GbpDirectoryId, GbpDirectoryAnswer>
  for (const id of GBP_DIRECTORY_IDS) {
    directories[id] = emptyGbpDirectoryAnswer()
  }
  return {
    replyTime: { band: null, ...emptyAnswerMeta() },
    directories,
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readMeta(row: Record<string, unknown>): GbpAnalystAnswerMeta {
  return {
    updatedAt: asString(row.updatedAt),
    updatedBy: asString(row.updatedBy),
  }
}

function readBand(value: unknown): GbpReplyTimeBand | null {
  return GBP_REPLY_TIME_BANDS.includes(value as GbpReplyTimeBand)
    ? (value as GbpReplyTimeBand)
    : null
}

function readState(value: unknown): GbpDirectoryState | null {
  return value === "present" || value === "absent" || value === "nap_mismatch"
    ? value
    : null
}

/**
 * Perfil anterior à coluna, ou com conteúdo que não bate, lê como **vazio** —
 * nunca como respondido. Resposta que não existe não pode virar diagnóstico.
 */
export function readGbpAnalystReview(value: unknown): GbpAnalystReview {
  const review = emptyGbpAnalystReview()
  const row = asRecord(value)
  if (!row) return review

  const replyTime = asRecord(row.replyTime)
  if (replyTime) {
    review.replyTime = {
      band: readBand(replyTime.band),
      ...readMeta(replyTime),
    }
  }

  const directories = asRecord(row.directories)
  if (directories) {
    for (const id of GBP_DIRECTORY_IDS) {
      const answer = asRecord(directories[id])
      if (!answer) continue
      review.directories[id] = {
        state: readState(answer.state),
        ...readMeta(answer),
      }
    }
  }

  return review
}

export function gbpReplyTimeIsSlow(review: GbpAnalystReview): boolean {
  const band = review.replyTime.band
  return band !== null && SLOW_REPLY_BANDS.has(band)
}

export function gbpDirectoriesInState(
  review: GbpAnalystReview,
  state: GbpDirectoryState,
): GbpDirectoryId[] {
  return GBP_DIRECTORY_IDS.filter(
    (id) => review.directories[id].state === state,
  )
}

export function gbpDirectoryLabel(id: GbpDirectoryId): string {
  return GBP_DIRECTORIES.find((item) => item.id === id)?.label ?? id
}

/** Busca `site:` que o analista abre para conferir o cadastro. */
export function gbpDirectorySearchUrl(
  domain: string,
  companyName: string,
): string {
  const query = `site:${domain} ${companyName}`.trim()
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}
