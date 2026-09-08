"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import {
  fetchGoogleMapsGridPoint,
  getGoogleMapsGridTask,
  postGoogleMapsGridTasks,
  readyGoogleMapsGridTasks,
} from "@/lib/dataforseo/google-maps-grid"
import { mapDataForSeoMapsRank } from "@/lib/leads/gbp-audit"
import {
  GBP_GRID_COLLECT_CONCURRENCY,
  GBP_GRID_DEADLINE_MS,
  GBP_GRID_LEASE_MS,
  GBP_GRID_LIVE_CHUNK,
  GBP_GRID_POST_BATCH,
  gbpGridCenterIndex,
  gbpGridMergePoints,
  gbpGridNextStatus,
  gbpGridPointKey,
  gbpGridPointTag,
  gbpGridPointsToCollect,
  gbpGridPointsToFetchLive,
  gbpGridPointsToPost,
  gbpGridProcessed,
  gbpGridTaskIdsFromPosted,
  parseGbpGridPointTag,
  readLeadGbpGridScanRow,
  type GbpGridPoint,
  type LeadGbpGridScan,
} from "@/lib/leads/gbp-grid"
import {
  pollGbpGridScanSchema,
  readPollGbpGridScanFields,
} from "@/lib/validations/lead-gbp-grid"
import { createClient } from "@/lib/supabase/server"
import {
  denyGbpEdit,
  GRID_SCAN_SELECT,
  insertGbpRankCheck,
  loadGbpProfileRow,
} from "./gbp-access"

export type PollLeadGbpGridScanState =
  | { status: "success"; scan: LeadGbpGridScan }
  | { status: "error"; message: string }

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

const POLL_FAILED = "Não foi possível continuar a malha. Tente novamente."
const CONFLICT = "Já existe outra malha em andamento para esta keyword."
const NO_TASK = "A fila não devolveu identificador para este ponto."
const HISTORY_FAILED =
  "A malha foi salva, mas o histórico de ranking não foi atualizado."

/** Concorrência limitada dentro do lote; `mapPool` do crawler é privado. */
async function mapPool<T, R>(
  items: readonly T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return []
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next
      next += 1
      const item = items[index]
      // Buraco no array não pode matar o worker: só pula o índice.
      if (item === undefined) continue
      results[index] = await fn(item)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, () => worker()),
  )
  return results
}

type PointOutcome = {
  point: GbpGridPoint
  next: GbpGridPoint
  cost: number
  /** Resultado cru do ponto central, para alimentar o histórico avulso. */
  raw: Record<string, unknown> | null
}

function usd(value: number): number {
  return Number(value.toFixed(6))
}

/**
 * Readota tarefas já pagas que nunca foram coletadas.
 *
 * Uma tarefa criada e não coletada continua listada em `tasks_ready` por três
 * dias, com o `tag` que diz de que ponto ela é. Foi assim que a malha quebrada
 * cobrou treze vezes o mesmo trabalho: sem identificador gravado, cada passada
 * do poll comprava a grade inteira de novo. Antes de enfileirar qualquer coisa,
 * vale olhar o que já está pago.
 *
 * Muta `taskIds` de propósito, para que o chamador grave o mapa completo.
 */
async function adoptReadyTasks(
  scanId: string,
  points: readonly GbpGridPoint[],
  taskIds: Record<string, string>,
): Promise<{ points: GbpGridPoint[]; adopted: number }> {
  const ready = await readyGoogleMapsGridTasks()
  // Falha aqui não é problema: o caminho normal enfileira o que faltar.
  if (ready.status === "error") return { points: [...points], adopted: 0 }

  let adopted = 0
  for (const task of ready.tasks) {
    const point = parseGbpGridPointTag(scanId, task.tag)
    if (!point) continue
    const key = gbpGridPointKey(point)
    if (taskIds[key]) continue
    taskIds[key] = task.id
    adopted += 1
  }
  if (adopted === 0) return { points: [...points], adopted: 0 }

  // O ponto adotado volta para a espera sem consumir tentativa: não foi pago
  // agora.
  const next = points.map((point) => {
    if (point.status === "done" || point.status === "queued") return point
    if (!taskIds[gbpGridPointKey(point)]) return point
    return { ...point, status: "queued" as const, error: null }
  })
  return { points: next, adopted }
}

/** Devolve o lease sem tocar no resto, para o próximo poll não esperar à toa. */
async function releaseLease(
  supabase: SupabaseClient,
  scanId: string,
  leaseIso: string,
): Promise<void> {
  await supabase
    .from("lead_gbp_grid_scans")
    .update({ polling_at: null, updated_at: new Date().toISOString() })
    .eq("id", scanId)
    .eq("polling_at", leaseIso)
}

export async function pollLeadGbpGridScan(
  formData: FormData,
): Promise<PollLeadGbpGridScanState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = pollGbpGridScanSchema.safeParse(
    readPollGbpGridScanFields(formData),
  )
  if (!parsed.success) {
    return { status: "error", message: "Malha inválida." }
  }

  const supabase = await createClient()
  const { data: scanRow, error: scanError } = await supabase
    .from("lead_gbp_grid_scans")
    .select(GRID_SCAN_SELECT)
    .eq("id", parsed.data.scan_id)
    .maybeSingle()

  if (scanError) return { status: "error", message: POLL_FAILED }
  if (!scanRow) return { status: "error", message: "Malha não encontrada." }

  const current = readLeadGbpGridScanRow(scanRow as Record<string, unknown>)
  if (!current) return { status: "error", message: POLL_FAILED }

  const loaded = await loadGbpProfileRow(supabase, current.profile_id)
  if (loaded.status === "error") {
    return { status: "error", message: POLL_FAILED }
  }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Perfil não encontrado." }
  }

  const denied = denyGbpEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  // Só a malha concluída é terminal. `partial` e `failed` seguem em frente:
  // é por elas que o botão "Retomar" existe, e ele era um clique morto.
  if (current.status === "ready") {
    return { status: "success", scan: current }
  }

  const nowIso = new Date().toISOString()
  const leaseCutoff = new Date(Date.now() - GBP_GRID_LEASE_MS).toISOString()
  const resetFailed = parsed.data.reset_failed

  // Lease: um único UPDATE ... WHERE, atômico. A trava antiga comparava o
  // status contra ele mesmo, então dois polls simultâneos em "running" passavam
  // os dois — e no primeiro deles isso significava enfileirar a malha duas
  // vezes, pagando duas vezes.
  const { data: claimed, error: claimError } = await supabase
    .from("lead_gbp_grid_scans")
    .update({
      status: "running",
      polling_at: nowIso,
      // Retomar reinicia o prazo; o laço automático preserva o início real.
      started_at: resetFailed ? nowIso : (current.started_at ?? nowIso),
      updated_at: nowIso,
    })
    .eq("id", current.id)
    .or(`polling_at.is.null,polling_at.lt."${leaseCutoff}"`)
    .select(GRID_SCAN_SELECT)
    .maybeSingle()

  if (claimError) {
    // O índice único parcial recusa duas malhas ativas para a mesma keyword.
    if (claimError.code === "23505") {
      return { status: "error", message: CONFLICT }
    }
    return { status: "error", message: POLL_FAILED }
  }
  // Outro poll está no comando: sai sem tocar em nada.
  if (!claimed) return { status: "success", scan: current }

  const scan =
    readLeadGbpGridScanRow(claimed as Record<string, unknown>) ?? current
  const placeId = loaded.profile.place_id
  const centerIndex = gbpGridCenterIndex(scan.size)

  let points = scan.points
  let taskIds = { ...scan.task_ids }
  let costUsd = scan.cost_usd
  let note: string | null = null

  // Zerar tentativas é decisão explícita de gastar de novo.
  if (resetFailed) {
    points = points.map((point) =>
      point.status === "failed"
        ? { ...point, attempts: 0, error: null }
        : point,
    )
  }

  if (scan.mode === "queued") {
    let dirty = false

    // Antes de comprar, olha o que já está pago: uma passada anterior pode ter
    // criado a tarefa e perdido o identificador antes de gravá-lo.
    if (gbpGridPointsToPost(points, taskIds, 1).length > 0) {
      const rescued = await adoptReadyTasks(scan.id, points, taskIds)
      if (rescued.adopted > 0) {
        points = rescued.points
        dirty = true
        note = `${rescued.adopted} ponto(s) reaproveitaram tarefas já pagas.`
      }
    }

    const toPost = gbpGridPointsToPost(points, taskIds, GBP_GRID_POST_BATCH)
    if (toPost.length > 0) {
      dirty = true
      const requested = toPost.map((point) => gbpGridPointTag(scan.id, point))
      const posted = await postGoogleMapsGridTasks(
        toPost.map((point, index) => ({
          tag: requested[index] ?? gbpGridPointTag(scan.id, point),
          keyword: scan.keyword,
          latitude: point.lat,
          longitude: point.lng,
          zoom: scan.zoom,
        })),
      )

      if (posted.status === "error") {
        // Nada foi criado, então nenhum ponto vira falho por isto.
        await releaseLease(supabase, scan.id, nowIso)
        return { status: "error", message: posted.message }
      }

      const mapped = gbpGridTaskIdsFromPosted({
        scanId: scan.id,
        requested,
        created: posted.created,
      })
      taskIds = { ...taskIds, ...mapped.taskIds }
      costUsd += posted.cost

      const rejectedByTag = new Map(
        posted.rejected.map((item) => [item.tag ?? "", item.message]),
      )
      const attempted = new Set(toPost.map((point) => gbpGridPointKey(point)))
      points = points.map((point) => {
        const key = gbpGridPointKey(point)
        if (!attempted.has(key)) return point
        const attempts = point.attempts + 1
        if (taskIds[key]) {
          return { ...point, status: "queued", attempts, error: null }
        }
        const message =
          rejectedByTag.get(gbpGridPointTag(scan.id, point)) ?? NO_TASK
        return { ...point, status: "failed", attempts, error: message }
      })

      if (mapped.unmapped.length > 0) {
        note = `A fila não devolveu identificador para ${mapped.unmapped.length} ponto(s).`
      } else if (mapped.byIndex > 0) {
        note = `${mapped.byIndex} ponto(s) foram correlacionados pela ordem da resposta.`
      }
    }

    // Gravação dedicada, antes de qualquer coleta: daqui em diante as buscas já
    // estão pagas, e perder os identificadores significa comprá-las de novo —
    // foi exatamente assim que uma malha de 121 pontos virou 1573 tarefas.
    // Não é filtrada pelo lease de propósito: proteger o gasto pesa mais que a
    // serialização.
    if (dirty) {
      const { error: persistError } = await supabase
        .from("lead_gbp_grid_scans")
        .update({
          task_ids: taskIds,
          points,
          cost_usd: usd(costUsd),
          updated_at: new Date().toISOString(),
        })
        .eq("id", scan.id)
      if (persistError) {
        await releaseLease(supabase, scan.id, nowIso)
        return { status: "error", message: POLL_FAILED }
      }
    }
  }

  // No modo fila o `task_get` é gratuito, então a passada coleta tudo que está
  // em aberto: fatiar criaria fila atrás dos primeiros pontos. No modo live
  // cada ponto é pago, e aí o lote continua existindo.
  const pending =
    scan.mode === "queued"
      ? gbpGridPointsToCollect(points, taskIds)
      : gbpGridPointsToFetchLive(points, GBP_GRID_LIVE_CHUNK)

  const outcomes = await mapPool<GbpGridPoint, PointOutcome | null>(
    pending,
    GBP_GRID_COLLECT_CONCURRENCY,
    async (point) => {
      if (scan.mode === "queued") {
        const taskId = taskIds[gbpGridPointKey(point)]
        if (!taskId) return null
        const got = await getGoogleMapsGridTask({ taskId, placeId })
        if (got.status === "pending") return null
        if (got.status === "error") {
          return {
            point,
            next: { ...point, status: "failed", error: got.message },
            cost: 0,
            raw: null,
          }
        }
        return {
          point,
          next: {
            ...point,
            status: "done",
            position: got.point.position,
            competitors: got.point.competitors,
            error: null,
          },
          cost: got.cost,
          raw: got.raw,
        }
      }

      const live = await fetchGoogleMapsGridPoint({
        keyword: scan.keyword,
        placeId,
        latitude: point.lat,
        longitude: point.lng,
        zoom: scan.zoom,
      })
      const attempts = point.attempts + 1
      if (live.status === "error") {
        return {
          point,
          next: { ...point, status: "failed", attempts, error: live.message },
          cost: 0,
          raw: null,
        }
      }
      return {
        point,
        next: {
          ...point,
          status: "done",
          attempts,
          position: live.point.position,
          competitors: live.point.competitors,
          error: null,
        },
        cost: live.cost,
        raw: live.raw,
      }
    },
  )

  const updates = new Map<string, GbpGridPoint>()
  let centerRaw: Record<string, unknown> | null = null
  for (const outcome of outcomes) {
    if (!outcome) continue
    costUsd += outcome.cost
    updates.set(gbpGridPointKey(outcome.point), outcome.next)
    if (
      outcome.raw &&
      outcome.point.row === centerIndex &&
      outcome.point.col === centerIndex
    ) {
      centerRaw = outcome.raw
    }
  }

  const nextPoints = gbpGridMergePoints(points, updates)
  const startedAt = scan.started_at ?? nowIso
  const deadlineReached =
    Date.now() - Date.parse(startedAt) >= GBP_GRID_DEADLINE_MS
  const nextStatus = gbpGridNextStatus(nextPoints, { deadlineReached })

  // O ponto central usa a mesma coordenada e o mesmo construtor de tarefa da
  // checagem avulsa, então vale como checagem — desde que os concorrentes sejam
  // calculados pela regra dela, e não pela da malha.
  let historyFailed = false
  if (Number.isInteger(centerIndex) && centerRaw) {
    const ok = await insertGbpRankCheck(
      supabase,
      scan.profile_id,
      mapDataForSeoMapsRank({
        keyword: scan.keyword,
        placeId,
        result: centerRaw,
        checkedAt: new Date().toISOString(),
      }),
      "dataforseo_maps",
    )
    historyFailed = !ok
  }

  const firstFailure =
    nextPoints.find((point) => point.status === "failed" && point.error)
      ?.error ?? null
  const errorMessage =
    note ??
    (historyFailed ? HISTORY_FAILED : null) ??
    (nextStatus === "running" ? null : firstFailure)

  const { data: saved, error: saveError } = await supabase
    .from("lead_gbp_grid_scans")
    .update({
      points: nextPoints,
      processed: gbpGridProcessed(nextPoints),
      status: nextStatus,
      task_ids: taskIds,
      cost_usd: usd(costUsd),
      error_message: errorMessage ? errorMessage.slice(0, 500) : null,
      polling_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scan.id)
    // O próprio timestamp do lease é o token: um poll cujo lease expirou não
    // sobrescreve o trabalho de quem assumiu.
    .eq("polling_at", nowIso)
    .select(GRID_SCAN_SELECT)
    .maybeSingle()

  if (saveError) {
    if (saveError.code === "23505") {
      return { status: "error", message: CONFLICT }
    }
    return { status: "error", message: POLL_FAILED }
  }

  if (!saved) {
    // Lease perdido no meio: devolve o estado de quem assumiu, sem sobrescrever.
    const { data: fresh } = await supabase
      .from("lead_gbp_grid_scans")
      .select(GRID_SCAN_SELECT)
      .eq("id", scan.id)
      .maybeSingle()
    const latest = fresh
      ? readLeadGbpGridScanRow(fresh as Record<string, unknown>)
      : null
    return latest
      ? { status: "success", scan: latest }
      : { status: "error", message: POLL_FAILED }
  }

  const nextScan = readLeadGbpGridScanRow(saved as Record<string, unknown>)
  if (!nextScan) return { status: "error", message: POLL_FAILED }
  return { status: "success", scan: nextScan }
}
