/**
 * Amostra de avaliações. Subiu de 50 para 200 porque frequência, rajada e média
 * por janela ficavam limitadas ao recorte que coubesse — num perfil ativo, 50
 * cobrem poucas semanas. Custa US$ 0,00075 por 10.
 */
export const GBP_REVIEW_DEPTH = 200
export const GBP_UPDATES_DEPTH = 10
export const GBP_QNA_DEPTH = 20
export const GBP_STALE_POSTS_DAYS = 90
export const GBP_WEAK_REVIEW_REPLY_RATIO = 0.8
export const GBP_RANK_KEYWORDS_MAX = 3
export const GBP_RANK_KEYWORD_MAX_LEN = 80
export const GBP_MAPS_DEPTH = 20

/**
 * Quantos concorrentes cada superfície guarda. A checagem avulsa exibe a lista
 * na tela, então cinco cabem; a malha guarda por ponto e multiplica por até 121
 * pontos de jsonb, então três. A diferença é deliberada.
 */
export const GBP_RANK_COMPETITORS = 5
export const GBP_GRID_COMPETITORS = 3

export type GbpPost = {
  text: string | null
  publishedAt: string | null
  url: string | null
  imageUrl: string | null
}

export type GbpReviewSampleItem = {
  rating: number | null
  text: string | null
  publishedAt: string | null
  ownerAnswer: string | null
  /**
   * Campos abaixo entraram depois da primeira coleta. Ausente é `null` — nunca
   * zero, nunca `false` — para que amostra antiga não pareça um perfil sem
   * autor, sem foto e sem resposta datada.
   */
  id: string | null
  /** Quando o proprietário respondeu. Sem isso não há tempo de resposta. */
  answeredAt: string | null
  authorName: string | null
  /** Link direto: achado sem link não vira ação. */
  url: string | null
  /** Quantas avaliações o autor já escreveu — autor novo não pesa igual. */
  authorReviewCount: number | null
  authorIsLocalGuide: boolean | null
  hasPhotos: boolean | null
  /** Idioma original, quando a avaliação veio traduzida. */
  originalLanguage: string | null
}

export type GbpReviewSortBy = "newest" | "relevant"

export type GbpReviewSummary = {
  sampled: number
  replied: number
  unrepliedLowRating: number
  sortBy: GbpReviewSortBy
  items: GbpReviewSampleItem[]
  /**
   * Total e média do perfil **na mesma resposta da amostra**.
   *
   * Antes o total só existia na distribuição de `my_business_info`, outra
   * chamada e outro instante — e era essa dessincronia que obrigava a
   * matemática histórica a bloquear. Vindo daqui, os dois lados da subtração
   * descrevem o mesmo momento.
   */
  total: number | null
  profileAverage: number | null
  /** Profundidade pedida na coleta: amostra menor não é perfil menor. */
  depth: number | null
}

export type GbpRankSource = "dataforseo_maps" | "serpapi_maps"

export type GbpQnaAnswer = {
  text: string
  isOwner: boolean
}

export type GbpQnaItem = {
  question: string
  askedAt: string | null
  answers: GbpQnaAnswer[]
}

export type GbpQna = {
  questionCount: number
  unansweredCount: number
  items: GbpQnaItem[]
}

export type GbpJobKind = "reviews" | "updates"
export type GbpJobStatus = "queued" | "ready" | "failed"

export type GbpJob = {
  kind: GbpJobKind
  status: GbpJobStatus
  error_message: string | null
}

export type GbpRankCompetitor = {
  title: string
  placeId: string | null
  position: number
}

export type GbpRankCheck = {
  keyword: string
  maps_position: number | null
  in_top3: boolean
  competitors: GbpRankCompetitor[]
  check_url: string | null
  checked_at: string
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asImageUrl(value: unknown): string | null {
  const direct = asString(value)
  if (direct) return direct
  if (!Array.isArray(value)) return null
  return asString(value[0])
}

export function dataForSeoTimeToIso(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) /, "$1T$2")
  const ms = Date.parse(normalized)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

export function isGbpOwnerAnswer(input: {
  profileUrl: string | null
  profileImageUrl: string | null
  profileName: string | null
  establishmentTitle: string | null
}): boolean {
  if (input.profileUrl) return false
  const image = input.profileImageUrl ?? ""
  if (image.includes("placeqa/merchant")) return true
  const name = input.profileName?.trim().toLowerCase()
  const title = input.establishmentTitle?.trim().toLowerCase()
  return Boolean(name && title && name === title)
}

function readPost(value: unknown): GbpPost | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const text = asString(row.text)
  const publishedAt = asString(row.publishedAt)
  const url = asString(row.url)
  const imageUrl = asString(row.imageUrl)
  if (!text && !publishedAt && !url && !imageUrl) return null
  return { text, publishedAt, url, imageUrl }
}

export function readGbpPosts(value: unknown): GbpPost[] | null {
  if (value === null || value === undefined) return null
  if (!Array.isArray(value)) return null
  const items: GbpPost[] = []
  for (const item of value) {
    const post = readPost(item)
    if (!post) return null
    items.push(post)
  }
  return items
}

function asOptionalBool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null
}

function readReviewItem(value: unknown): GbpReviewSampleItem | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const rating = asNumber(row.rating)
  if (row.rating != null && rating === null) return null
  // Os campos da coleta ampliada são opcionais: amostra gravada antes deles
  // continua legível, e ausência lê como `null` em vez de zero.
  return {
    rating,
    text: asString(row.text),
    publishedAt: asString(row.publishedAt),
    ownerAnswer: asString(row.ownerAnswer),
    id: asString(row.id),
    answeredAt: asString(row.answeredAt),
    authorName: asString(row.authorName),
    url: asString(row.url),
    authorReviewCount: asNumber(row.authorReviewCount),
    authorIsLocalGuide: asOptionalBool(row.authorIsLocalGuide),
    hasPhotos: asOptionalBool(row.hasPhotos),
    originalLanguage: asString(row.originalLanguage),
  }
}

export function readGbpReviews(value: unknown): GbpReviewSummary | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (row.sortBy !== "newest" && row.sortBy !== "relevant") return null
  if (!Array.isArray(row.items)) return null
  const items: GbpReviewSampleItem[] = []
  for (const item of row.items) {
    const parsed = readReviewItem(item)
    if (!parsed) return null
    items.push(parsed)
  }
  const sampled = asNumber(row.sampled)
  const replied = asNumber(row.replied)
  const unrepliedLowRating = asNumber(row.unrepliedLowRating)
  if (sampled === null || replied === null || unrepliedLowRating === null) {
    return null
  }
  return {
    sampled,
    replied,
    unrepliedLowRating,
    sortBy: row.sortBy,
    items,
    total: asNumber(row.total),
    profileAverage: asNumber(row.profileAverage),
    depth: asNumber(row.depth),
  }
}

function readQnaAnswer(value: unknown): GbpQnaAnswer | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const text = asString(row.text)
  if (!text || typeof row.isOwner !== "boolean") return null
  return { text, isOwner: row.isOwner }
}

function readQnaItem(value: unknown): GbpQnaItem | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const question = asString(row.question)
  if (!question || !Array.isArray(row.answers)) return null
  const answers: GbpQnaAnswer[] = []
  for (const answer of row.answers) {
    const parsed = readQnaAnswer(answer)
    if (!parsed) return null
    answers.push(parsed)
  }
  return {
    question,
    askedAt: asString(row.askedAt),
    answers,
  }
}

export function readGbpQna(value: unknown): GbpQna | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (!Array.isArray(row.items)) return null
  const items: GbpQnaItem[] = []
  for (const item of row.items) {
    const parsed = readQnaItem(item)
    if (!parsed) return null
    items.push(parsed)
  }
  const questionCount = asNumber(row.questionCount)
  const unansweredCount = asNumber(row.unansweredCount)
  if (questionCount === null || unansweredCount === null) return null
  return { questionCount, unansweredCount, items }
}

function readJobKind(value: unknown): GbpJobKind | null {
  return value === "reviews" || value === "updates" ? value : null
}

function readJobStatus(value: unknown): GbpJobStatus | null {
  return value === "queued" || value === "ready" || value === "failed"
    ? value
    : null
}

export function readGbpJobs(value: unknown): GbpJob[] {
  if (!Array.isArray(value)) return []
  const jobs: GbpJob[] = []
  const seen = new Set<GbpJobKind>()
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const kind = readJobKind(row.kind)
    const status = readJobStatus(row.status)
    if (!kind || !status || seen.has(kind)) continue
    seen.add(kind)
    jobs.push({
      kind,
      status,
      error_message: asString(row.error_message),
    })
  }
  return jobs
}

export function gbpJobReady(jobs: GbpJob[], kind: GbpJobKind): boolean {
  return jobs.some((job) => job.kind === kind && job.status === "ready")
}

export function gbpJobQueued(jobs: GbpJob[], kind: GbpJobKind): boolean {
  return jobs.some((job) => job.kind === kind && job.status === "queued")
}

export function mapDataForSeoPosts(items: unknown): GbpPost[] {
  if (!Array.isArray(items)) return []
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    if (row.type && row.type !== "google_business_post") return []
    const post = readPost({
      text: asString(row.post_text),
      publishedAt: dataForSeoTimeToIso(row.timestamp),
      url: asString(row.url),
      imageUrl: asImageUrl(row.images_url),
    })
    return post ? [post] : []
  })
}

/**
 * A resposta do proprietário vem com HTML — o payload real trazia
 * `"Obrigado pelo feedback, Leandro! <br><br>"`. Limpar na entrada, e não na
 * tela, para que nenhum consumidor futuro precise lembrar disso.
 */
function stripHtml(value: unknown): string | null {
  const text = asString(value)
  if (!text) return null
  // `<br>` vira espaço em vez de quebra: a resposta é curta e um separador
  // simples evita depender de escape em toda a cadeia até a tela.
  const plain = text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return plain.length > 0 ? plain : null
}

/**
 * Recebe o **resultado inteiro**, não só `items`.
 *
 * `reviews_count` e `rating` moram no nível do resultado e são o total e a
 * média do perfil medidos na mesma chamada da amostra. Ler os dois daqui é o
 * que permite à matemática histórica comparar dois números do mesmo instante,
 * em vez de casar a amostra com uma distribuição coletada noutra hora.
 */
export function mapDataForSeoReviews(result: unknown): GbpReviewSummary {
  const resultRow =
    result && typeof result === "object" && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : null
  const items = resultRow?.items
  const parsed: GbpReviewSampleItem[] = []
  if (Array.isArray(items)) {
    for (const item of items) {
      if (!item || typeof item !== "object") continue
      const row = item as Record<string, unknown>
      const ratingRow =
        row.rating && typeof row.rating === "object"
          ? (row.rating as Record<string, unknown>)
          : null
      const images = row.images
      parsed.push({
        rating: asNumber(ratingRow?.value),
        text: asString(row.review_text),
        publishedAt: dataForSeoTimeToIso(row.timestamp),
        ownerAnswer: stripHtml(row.owner_answer),
        id: asString(row.review_id),
        answeredAt: dataForSeoTimeToIso(row.owner_timestamp),
        authorName: asString(row.profile_name),
        url: asString(row.review_url),
        authorReviewCount: asNumber(row.reviews_count),
        authorIsLocalGuide: asOptionalBool(row.local_guide),
        hasPhotos: Array.isArray(images) ? images.length > 0 : null,
        originalLanguage: asString(row.original_language),
      })
    }
  }
  const replied = parsed.filter((item) => item.ownerAnswer).length
  const unrepliedLowRating = parsed.filter(
    (item) => !item.ownerAnswer && item.rating !== null && item.rating <= 3,
  ).length
  const profileRating =
    resultRow?.rating && typeof resultRow.rating === "object"
      ? (resultRow.rating as Record<string, unknown>)
      : null

  return {
    sampled: parsed.length,
    replied,
    unrepliedLowRating,
    sortBy: "newest",
    items: parsed,
    total: asNumber(resultRow?.reviews_count),
    profileAverage: asNumber(profileRating?.value),
    depth: GBP_REVIEW_DEPTH,
  }
}

function mapQnaQuestion(
  item: Record<string, unknown>,
  establishmentTitle: string | null,
): GbpQnaItem | null {
  const question = asString(item.question_text)
  if (!question) return null
  const answersRaw = Array.isArray(item.items) ? item.items : []
  const answers = answersRaw.flatMap((answer) => {
    if (!answer || typeof answer !== "object") return []
    const row = answer as Record<string, unknown>
    const text = asString(row.answer_text)
    if (!text) return []
    return [
      {
        text,
        isOwner: isGbpOwnerAnswer({
          profileUrl: asString(row.profile_url),
          profileImageUrl: asString(row.profile_image_url),
          profileName: asString(row.profile_name),
          establishmentTitle,
        }),
      },
    ]
  })
  return {
    question,
    askedAt: dataForSeoTimeToIso(item.timestamp),
    answers,
  }
}

export function mapDataForSeoQna(
  result: Record<string, unknown>,
  establishmentTitle: string | null,
): GbpQna | null {
  const answeredRaw = Array.isArray(result.items) ? result.items : []
  const unansweredRaw = Array.isArray(result.items_without_answers)
    ? result.items_without_answers
    : []
  const answered = answeredRaw.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const parsed = mapQnaQuestion(
      item as Record<string, unknown>,
      establishmentTitle,
    )
    return parsed ? [parsed] : []
  })
  const unanswered = unansweredRaw.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const parsed = mapQnaQuestion(
      item as Record<string, unknown>,
      establishmentTitle,
    )
    return parsed ? [parsed] : []
  })
  const items = [...answered, ...unanswered]
  const unansweredCount = unanswered.length
  const questionCount = items.length
  if (questionCount === 0) return null
  return { questionCount, unansweredCount, items }
}

export function normalizeGbpRankKeywords(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  const seen = new Set<string>()
  const keywords: string[] = []
  for (const item of values) {
    if (typeof item !== "string") continue
    const trimmed = item.trim()
    if (!trimmed || trimmed.length > GBP_RANK_KEYWORD_MAX_LEN) continue
    const folded = trimmed.toLowerCase()
    if (seen.has(folded)) continue
    seen.add(folded)
    keywords.push(trimmed)
    if (keywords.length >= GBP_RANK_KEYWORDS_MAX) break
  }
  return keywords
}

export function readGbpRankKeywords(value: unknown): string[] {
  return normalizeGbpRankKeywords(value)
}

function readRankCompetitor(value: unknown): GbpRankCompetitor | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const title = asString(row.title)
  const position = asNumber(row.position)
  if (!title || position === null || position < 1) return null
  return {
    title,
    placeId: asString(row.placeId),
    position: Math.trunc(position),
  }
}

function readRankCheck(value: unknown): GbpRankCheck | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const keyword = asString(row.keyword)
  const checked_at = asString(row.checked_at)
  if (!keyword || !checked_at) return null
  if (keyword.length > GBP_RANK_KEYWORD_MAX_LEN) return null
  if (typeof row.in_top3 !== "boolean") return null
  if (!Array.isArray(row.competitors)) return null
  const competitors: GbpRankCompetitor[] = []
  for (const item of row.competitors) {
    const parsed = readRankCompetitor(item)
    if (!parsed) return null
    competitors.push(parsed)
  }
  const maps_position = asNumber(row.maps_position)
  if (row.maps_position != null && maps_position === null) return null
  return {
    keyword,
    maps_position: maps_position === null ? null : Math.trunc(maps_position),
    in_top3: row.in_top3,
    competitors,
    check_url: asString(row.check_url),
    checked_at,
  }
}

export function readGbpRankChecks(value: unknown): GbpRankCheck[] {
  if (!Array.isArray(value)) return []
  // A tabela e append-only, entao a mesma keyword traz varias checagens.
  // Mantem a mais recente, sem depender da ordem da consulta.
  const latest = new Map<string, GbpRankCheck>()
  for (const item of value) {
    const parsed = readRankCheck(item)
    if (!parsed) continue
    const folded = parsed.keyword.toLowerCase()
    const current = latest.get(folded)
    if (current && current.checked_at >= parsed.checked_at) continue
    latest.set(folded, parsed)
  }
  return [...latest.values()]
}

type MapsRankItem = {
  title: string
  placeId: string | null
  position: number
}

function readMapsItems(items: unknown): MapsRankItem[] {
  if (!Array.isArray(items)) return []
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    const position = asNumber(row.rank_absolute)
    const title = asString(row.title)
    if (position === null || position < 1 || !title) return []
    return [
      {
        title,
        placeId: asString(row.place_id),
        position: Math.trunc(position),
      },
    ]
  })
}

/**
 * Os primeiros colocados do resultado, sem filtrar pela posição do cliente.
 *
 * O filtro antigo da checagem avulsa — "só quem está acima dele" — exigia que o
 * cliente aparecesse no top 20; quando ele não aparecia, gravávamos zero
 * concorrente, justamente no caso em que saber quem está lá é o que mais
 * interessa. A malha já fazia certo, e as duas divergiram por montarem a mesma
 * lista em dois lugares. Agora é uma função só.
 *
 * O próprio cliente sai da lista: ele não é concorrente de si mesmo.
 */
function topCompetitors(
  items: readonly MapsRankItem[],
  placeId: string,
  max: number,
): GbpRankCompetitor[] {
  return items
    .filter((item) => item.placeId !== placeId)
    .slice()
    .sort((left, right) => left.position - right.position)
    .slice(0, max)
    .map((item) => ({
      title: item.title,
      placeId: item.placeId,
      position: item.position,
    }))
}

export type GbpGridPointResult = {
  position: number | null
  competitors: GbpRankCompetitor[]
}

/**
 * Um ponto da malha, a partir de um resultado de Maps.
 *
 * Guarda menos concorrentes que a checagem avulsa porque multiplica por ponto —
 * e reescanear depois custaria outra requisição paga, então descartar não é
 * opção.
 */
export function mapDataForSeoGridPoint(input: {
  placeId: string
  result: Record<string, unknown> | null
}): GbpGridPointResult {
  const items = readMapsItems(input.result?.items).slice(0, GBP_MAPS_DEPTH)
  const target = items.find((item) => item.placeId === input.placeId) ?? null
  return {
    position: target?.position ?? null,
    competitors: topCompetitors(items, input.placeId, GBP_GRID_COMPETITORS),
  }
}

export function mapDataForSeoMapsRank(input: {
  keyword: string
  placeId: string
  result: Record<string, unknown> | null
  checkedAt: string
}): GbpRankCheck {
  const items = readMapsItems(input.result?.items)
  const target = items.find((item) => item.placeId === input.placeId) ?? null
  const maps_position = target?.position ?? null
  const competitors = topCompetitors(items, input.placeId, GBP_RANK_COMPETITORS)
  return {
    keyword: input.keyword,
    maps_position,
    in_top3: maps_position !== null && maps_position <= 3,
    competitors,
    check_url: asString(input.result?.check_url),
    checked_at: input.checkedAt,
  }
}
