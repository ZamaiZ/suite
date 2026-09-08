import { GBP_MAPS_ZOOM } from "../dataforseo/maps-task.ts"
import {
  GBP_MAPS_DEPTH,
  type GbpRankCompetitor,
} from "./gbp-audit.ts"

export const GBP_GRID_SIZES = [3, 5, 7, 11] as const
export const GBP_GRID_SIZE_DEFAULT = 5
export const GBP_GRID_RADIUS_KM_MIN = 1
export const GBP_GRID_RADIUS_KM_MAX = 25
export const GBP_GRID_RADIUS_KM_DEFAULT = 5

/**
 * Zoom da requisição, não o da tela. Vem do construtor de tarefa compartilhado
 * com a checagem avulsa, para que o ponto central da malha e a checagem de uma
 * keyword só continuem medindo a mesma coisa.
 */
export const GBP_GRID_ZOOM = GBP_MAPS_ZOOM

/** Teto do `task_post` do DataForSEO: 100 tarefas por requisição. */
export const GBP_GRID_POST_BATCH = 100

/**
 * O `task_get` é gratuito, então a fila coleta todos os pontos em aberto a cada
 * passada — fatiar criaria fila atrás dos primeiros pontos e a malha inteira
 * esperaria por eles. No modo live cada ponto é pago, e aí o lote existe.
 */
export const GBP_GRID_COLLECT_CONCURRENCY = 8
export const GBP_GRID_LIVE_CHUNK = 10

/**
 * Uma tentativa original mais uma repescagem. Sem teto, um ponto que falha de
 * verdade seria reenfileirado a cada passada — e cada reenfileiramento é pago.
 */
export const GBP_GRID_MAX_ATTEMPTS = 2

/** Janela em que um poll segura a malha antes de outro poder assumir. */
export const GBP_GRID_LEASE_MS = 120_000

/** Teto da fila padrão do DataForSEO; passou disso, a malha para de esperar. */
export const GBP_GRID_DEADLINE_MS = 45 * 60_000

const KM_PER_DEG_LAT = 111.32

export type GbpGridSize = (typeof GBP_GRID_SIZES)[number]

/**
 * `pending` ainda não tem tarefa. `queued` tem tarefa enfileirada e espera
 * resposta. `done` foi coletado — e aí `position` nula significa ausência real
 * do perfil naquele ponto. `failed` é coleta que não aconteceu, e é retentável:
 * confundir os dois foi o que fez uma malha inteiramente falha parecer um
 * diagnóstico de que o cliente não rankeia em lugar nenhum.
 */
export type GbpGridPointStatus = "pending" | "queued" | "done" | "failed"
export type GbpGridMode = "live" | "queued"

/** Modo sugerido pelo tamanho; o usuário pode escolher o outro na tela. */
export function gbpGridExecutionMode(size: number): GbpGridMode {
  return size <= 5 ? "live" : "queued"
}

export function isGbpGridMode(value: unknown): value is GbpGridMode {
  return value === "live" || value === "queued"
}

export type GbpGridPoint = {
  row: number
  col: number
  lat: number
  lng: number
  status: GbpGridPointStatus
  /** Nulo em ponto não coletado e também em ponto onde o perfil não aparece. */
  position: number | null
  competitors: GbpRankCompetitor[]
  /** Quantas vezes a tarefa deste ponto já foi enfileirada. */
  attempts: number
  error: string | null
}

export type GbpGridScanStatus =
  | "queued"
  | "running"
  | "ready"
  | "partial"
  | "failed"

export type LeadGbpGridScan = {
  id: string
  lead_id: string
  profile_id: string
  keyword: string
  center_lat: number
  center_lng: number
  size: number
  radius_km: number
  zoom: number
  source: string
  mode: GbpGridMode
  status: GbpGridScanStatus
  processed: number
  total: number
  points: GbpGridPoint[]
  /** Custo real acumulado, somado do campo `cost` de cada resposta. */
  cost_usd: number
  /** `"linha:coluna"` -> `task_id`, preenchido só no modo fila. */
  task_ids: Record<string, string>
  error_message: string | null
  /** Primeira passada do poll; base do prazo, então nunca é reescrito. */
  started_at: string | null
  captured_at: string
}

/** Identifica o ponto na `tag` da tarefa e na volta do `task_get`. */
export function gbpGridPointTag(
  scanId: string,
  point: { row: number; col: number },
): string {
  return `${scanId}:${point.row}:${point.col}`
}

export function gbpGridPointKey(point: { row: number; col: number }): string {
  return `${point.row}:${point.col}`
}

/**
 * Lê a `tag` de volta. Exige o prefixo do próprio scan: o `tasks_ready` lista a
 * conta inteira, e uma tag de outra malha não pode virar ponto desta.
 */
export function parseGbpGridPointTag(
  scanId: string,
  tag: string | null,
): { row: number; col: number } | null {
  if (!tag) return null
  const prefix = `${scanId}:`
  if (!tag.startsWith(prefix)) return null
  const rest = tag.slice(prefix.length).split(":")
  if (rest.length !== 2) return null
  const row = Number(rest[0])
  const col = Number(rest[1])
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null
  if (row < 0 || col < 0) return null
  return { row, col }
}

export type GbpGridTaskIdsResult = {
  taskIds: Record<string, string>
  /** Tags enviadas que voltaram sem identificador utilizável. */
  unmapped: string[]
  /** Quantas correlações vieram da posição na resposta, e não da tag. */
  byIndex: number
}

/**
 * Correlaciona o que o `task_post` criou com os pontos de origem.
 *
 * A `tag` é a correlação primária. A posição na resposta é a reserva, mas só
 * quando a resposta é completa e não traz tag nenhuma — se **alguma** tag veio,
 * ela é usada para conferir o alinhamento, e um desalinhamento derruba a
 * reserva inteira. Adivinhar posição erraria o ponto geográfico de um resultado
 * e isso apareceria no relatório do cliente como dado bom.
 */
export function gbpGridTaskIdsFromPosted(input: {
  scanId: string
  /** Tags enviadas, na ordem exata do request. */
  requested: readonly string[]
  created: readonly { index: number; id: string; tag: string | null }[]
}): GbpGridTaskIdsResult {
  const { scanId, requested, created } = input
  const taskIds: Record<string, string> = {}
  const resolved = new Set<string>()
  let tagged = 0
  let aligned = 0

  for (const task of created) {
    if (task.tag === null) continue
    tagged += 1
    if (requested[task.index] === task.tag) aligned += 1
    const point = parseGbpGridPointTag(scanId, task.tag)
    if (!point) continue
    const key = gbpGridPointKey(point)
    taskIds[key] = task.id
    resolved.add(task.tag)
  }

  // Reserva por posição: só com a resposta inteira de volta e sem tag alguma
  // para conferir, ou com todas as tags conferindo.
  const orderTrusted =
    created.length === requested.length &&
    (tagged === 0 || aligned === tagged)

  let byIndex = 0
  if (orderTrusted) {
    for (const task of created) {
      if (task.tag !== null) continue
      const tag = requested[task.index]
      if (tag === undefined || resolved.has(tag)) continue
      const point = parseGbpGridPointTag(scanId, tag)
      if (!point) continue
      taskIds[gbpGridPointKey(point)] = task.id
      resolved.add(tag)
      byIndex += 1
    }
  }

  const unmapped = requested.filter((tag) => !resolved.has(tag))
  return { taskIds, unmapped, byIndex }
}

export type GbpGridMetrics = {
  arp: number | null
  atrp: number | null
  solv: number | null
  found: number
  total: number
}

export function isGbpGridSize(value: unknown): value is GbpGridSize {
  return (
    typeof value === "number" &&
    (GBP_GRID_SIZES as readonly number[]).includes(value)
  )
}

export function gbpGridCenterIndex(size: number): number {
  return (size - 1) / 2
}

/** Quantas requisições pagas a malha dispara. */
export function gbpGridCost(size: number): number {
  return size * size
}

/**
 * Malha quadrada centrada na coordenada do perfil.
 *
 * O raio é a meia-largura do quadrado, não o círculo circunscrito: os cantos
 * ficam a `raio·√2` do centro. Linha 0 é o norte e coluna 0 é o oeste, para
 * que a matriz se leia na mesma ordem do mapa.
 */
export function gbpGridPoints(input: {
  centerLat: number
  centerLng: number
  size: number
  radiusKm: number
}): GbpGridPoint[] {
  const { centerLat, centerLng, size, radiusKm } = input
  if (size < 1) return []
  const spacing = size > 1 ? (2 * radiusKm) / (size - 1) : 0
  const half = gbpGridCenterIndex(size)
  const kmPerDegLng = KM_PER_DEG_LAT * Math.cos((centerLat * Math.PI) / 180)
  const points: GbpGridPoint[] = []
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const northKm = (half - row) * spacing
      const eastKm = (col - half) * spacing
      points.push({
        row,
        col,
        lat: centerLat + northKm / KM_PER_DEG_LAT,
        lng: kmPerDegLng > 0 ? centerLng + eastKm / kmPerDegLng : centerLng,
        status: "pending",
        position: null,
        competitors: [],
        attempts: 0,
        error: null,
      })
    }
  }
  return points
}

/**
 * Pontos que precisam de tarefa: nunca coletados ou falhos, ainda dentro do
 * teto de tentativas. Um ponto `queued` já tem tarefa em aberto e um `done` já
 * foi pago — nenhum dos dois volta para a fila.
 */
export function gbpGridPointsToPost(
  points: readonly GbpGridPoint[],
  taskIds: Readonly<Record<string, string>>,
  limit: number,
): GbpGridPoint[] {
  const out: GbpGridPoint[] = []
  for (const point of points) {
    if (point.status === "done" || point.status === "queued") continue
    if (point.status === "pending" && taskIds[gbpGridPointKey(point)]) continue
    if (point.attempts >= GBP_GRID_MAX_ATTEMPTS) continue
    out.push(point)
    if (out.length >= limit) break
  }
  return out
}

/** Pontos com tarefa em aberto, à espera de resposta. */
export function gbpGridPointsToCollect(
  points: readonly GbpGridPoint[],
  taskIds: Readonly<Record<string, string>>,
): GbpGridPoint[] {
  return points.filter((point) => {
    if (point.status !== "queued" && point.status !== "pending") return false
    return Boolean(taskIds[gbpGridPointKey(point)])
  })
}

/** Pontos pendentes de coleta paga no modo live, em lotes. */
export function gbpGridPointsToFetchLive(
  points: readonly GbpGridPoint[],
  limit: number,
): GbpGridPoint[] {
  const out: GbpGridPoint[] = []
  for (const point of points) {
    if (point.status === "done") continue
    if (point.attempts >= GBP_GRID_MAX_ATTEMPTS) continue
    out.push(point)
    if (out.length >= limit) break
  }
  return out
}

/** Ponto já concluído nunca é sobrescrito: é requisição paga. */
export function gbpGridMergePoints(
  points: readonly GbpGridPoint[],
  updates: ReadonlyMap<string, GbpGridPoint>,
): GbpGridPoint[] {
  return points.map((point) => {
    if (point.status === "done") return point
    return updates.get(gbpGridPointKey(point)) ?? point
  })
}

/** Coletado ou desistido. Ponto na fila ainda não foi processado. */
export function gbpGridProcessed(points: readonly GbpGridPoint[]): number {
  return points.filter(
    (point) => point.status === "done" || point.status === "failed",
  ).length
}

export function gbpGridFailedCount(points: readonly GbpGridPoint[]): number {
  return points.filter((point) => point.status === "failed").length
}

export function gbpGridNextStatus(
  points: readonly GbpGridPoint[],
  options: { deadlineReached: boolean },
): GbpGridScanStatus {
  const open = points.some(
    (point) => point.status === "pending" || point.status === "queued",
  )
  if (open && !options.deadlineReached) return "running"
  if (open || points.some((point) => point.status === "failed")) return "partial"
  return "ready"
}

/**
 * ARP considera só onde o perfil aparece. ATRP conta a ausência como pior que
 * a última posição coletada, para que um perfil invisível não seja premiado
 * por ter poucas aparições boas. SoLV é a fatia de pontos no top 3.
 */
export function gbpGridMetrics(
  points: readonly GbpGridPoint[],
): GbpGridMetrics {
  const scored = points.filter((point) => point.status === "done")
  const total = scored.length
  const found = scored.filter((point) => point.position !== null)
  if (total === 0) {
    return { arp: null, atrp: null, solv: null, found: 0, total: 0 }
  }
  const arp =
    found.length > 0
      ? found.reduce((sum, point) => sum + (point.position ?? 0), 0) /
        found.length
      : null
  const atrp =
    scored.reduce(
      (sum, point) => sum + (point.position ?? GBP_MAPS_DEPTH + 1),
      0,
    ) / total
  const topThree = found.filter(
    (point) => (point.position ?? Number.POSITIVE_INFINITY) <= 3,
  ).length
  return {
    arp: arp === null ? null : round2(arp),
    atrp: round2(atrp),
    solv: round2((topThree / total) * 100),
    found: found.length,
    total,
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function asFinite(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function asInt(value: unknown): number | null {
  const parsed = asFinite(value)
  return parsed === null ? null : Math.trunc(parsed)
}

function readPointStatus(value: unknown): GbpGridPointStatus {
  return value === "done" || value === "failed" || value === "queued"
    ? value
    : "pending"
}

function readScanStatus(value: unknown): GbpGridScanStatus | null {
  return value === "queued" ||
    value === "running" ||
    value === "ready" ||
    value === "partial" ||
    value === "failed"
    ? value
    : null
}

function readCompetitors(value: unknown): GbpRankCompetitor[] {
  if (!Array.isArray(value)) return []
  const items: GbpRankCompetitor[] = []
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    const title = asString(row.title)
    const position = asInt(row.position)
    if (!title || position === null || position < 1) continue
    items.push({ title, placeId: asString(row.placeId), position })
  }
  return items
}

/** Scans gravados antes de `attempts` e `error` continuam legíveis. */
export function readGbpGridPoints(value: unknown): GbpGridPoint[] {
  if (!Array.isArray(value)) return []
  const points: GbpGridPoint[] = []
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as Record<string, unknown>
    const gridRow = asInt(row.row)
    const col = asInt(row.col)
    const lat = asFinite(row.lat)
    const lng = asFinite(row.lng)
    if (gridRow === null || col === null || lat === null || lng === null) {
      continue
    }
    const position = asInt(row.position)
    const attempts = asInt(row.attempts)
    points.push({
      row: gridRow,
      col,
      lat,
      lng,
      status: readPointStatus(row.status),
      position: position !== null && position >= 1 ? position : null,
      competitors: readCompetitors(row.competitors),
      attempts: attempts !== null && attempts > 0 ? attempts : 0,
      error: asString(row.error),
    })
  }
  return points
}

export function readLeadGbpGridScanRow(
  row: Record<string, unknown>,
): LeadGbpGridScan | null {
  const id = asString(row.id)
  const lead_id = asString(row.lead_id)
  const profile_id = asString(row.profile_id)
  const keyword = asString(row.keyword)
  const captured_at = asString(row.captured_at)
  const source = asString(row.source)
  const center_lat = asFinite(row.center_lat)
  const center_lng = asFinite(row.center_lng)
  const size = asInt(row.size)
  const radius_km = asFinite(row.radius_km)
  const zoom = asInt(row.zoom)
  const status = readScanStatus(row.status)
  const processed = asInt(row.processed)
  const total = asInt(row.total)
  if (
    !id ||
    !lead_id ||
    !profile_id ||
    !keyword ||
    !captured_at ||
    !source ||
    center_lat === null ||
    center_lng === null ||
    size === null ||
    radius_km === null ||
    zoom === null ||
    !status ||
    processed === null ||
    total === null
  ) {
    return null
  }
  return {
    id,
    lead_id,
    profile_id,
    keyword,
    center_lat,
    center_lng,
    size,
    radius_km,
    zoom,
    source,
    mode: row.mode === "queued" ? "queued" : "live",
    status,
    processed,
    total,
    points: readGbpGridPoints(row.points),
    cost_usd: asFinite(row.cost_usd) ?? 0,
    task_ids: readTaskIds(row.task_ids),
    error_message: asString(row.error_message),
    started_at: asString(row.started_at),
    captured_at,
  }
}

function readTaskIds(value: unknown): Record<string, string> {
  const row = asRecord(value)
  if (!row) return {}
  const out: Record<string, string> = {}
  for (const [key, item] of Object.entries(row)) {
    if (typeof item === "string" && item.trim()) out[key] = item.trim()
  }
  return out
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/**
 * A tabela é append-only, então o embed traz vários scans do mesmo perfil.
 * Escolhe o mais recente sem depender da ordem da consulta.
 */
export function latestGbpGridScan(embed: unknown): LeadGbpGridScan | null {
  if (!Array.isArray(embed)) return null
  let latest: LeadGbpGridScan | null = null
  for (const item of embed) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const scan = readLeadGbpGridScanRow(item as Record<string, unknown>)
    if (!scan) continue
    if (latest && latest.captured_at >= scan.captured_at) continue
    latest = scan
  }
  return latest
}

export function gbpGridScanActive(scan: LeadGbpGridScan | null): boolean {
  return scan?.status === "queued" || scan?.status === "running"
}

/** Malha parada com ponto por coletar — o "Retomar" tem o que fazer. */
export function gbpGridScanResumable(scan: LeadGbpGridScan | null): boolean {
  if (!scan) return false
  if (scan.status !== "partial" && scan.status !== "failed") return false
  return scan.points.some((point) => point.status !== "done")
}
