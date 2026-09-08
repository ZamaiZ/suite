import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  GBP_GRID_MAX_ATTEMPTS,
  gbpGridFailedCount,
  gbpGridMergePoints,
  gbpGridMetrics,
  gbpGridNextStatus,
  gbpGridPoints,
  gbpGridPointsToCollect,
  gbpGridPointsToPost,
  gbpGridProcessed,
  gbpGridScanResumable,
  gbpGridTaskIdsFromPosted,
  parseGbpGridPointTag,
  readGbpGridPoints,
} from "./gbp-grid.ts"

const SCAN = "cbed5dfa-7f18-423d-85fd-e5e381113e26"

function point(row, col, patch = {}) {
  return {
    row,
    col,
    lat: -23.45,
    lng: -46.56,
    status: "pending",
    position: null,
    competitors: [],
    attempts: 0,
    error: null,
    ...patch,
  }
}

describe("gbpGridPoints", () => {
  it("monta a malha com o centro na coordenada do perfil", () => {
    const points = gbpGridPoints({
      centerLat: -23.45,
      centerLng: -46.56,
      size: 3,
      radiusKm: 1,
    })

    assert.equal(points.length, 9)
    const center = points.find((item) => item.row === 1 && item.col === 1)
    assert.equal(center.lat, -23.45)
    assert.equal(center.lng, -46.56)
    assert.equal(center.status, "pending")
    assert.equal(center.attempts, 0)
  })

  it("põe a linha 0 no norte e a coluna 0 no oeste", () => {
    const points = gbpGridPoints({
      centerLat: -23.45,
      centerLng: -46.56,
      size: 3,
      radiusKm: 1,
    })
    const north = points.find((item) => item.row === 0 && item.col === 1)
    const south = points.find((item) => item.row === 2 && item.col === 1)
    const west = points.find((item) => item.row === 1 && item.col === 0)
    const east = points.find((item) => item.row === 1 && item.col === 2)

    assert.ok(north.lat > south.lat, "linha 0 tem latitude maior")
    assert.ok(west.lng < east.lng, "coluna 0 tem longitude menor")
  })

  it("espaça os pontos em 2·raio/(tamanho−1)", () => {
    const points = gbpGridPoints({
      centerLat: 0,
      centerLng: 0,
      size: 3,
      radiusKm: 10,
    })
    const north = points.find((item) => item.row === 0 && item.col === 1)
    const center = points.find((item) => item.row === 1 && item.col === 1)

    // 2·10/(3−1) = 10 km entre linhas vizinhas.
    const km = (north.lat - center.lat) * 111.32
    assert.ok(Math.abs(km - 10) < 1e-9, `esperava 10 km, veio ${km}`)
  })

  it("degrada com tamanhos degenerados em vez de quebrar", () => {
    assert.deepEqual(gbpGridPoints({ centerLat: 0, centerLng: 0, size: 0, radiusKm: 5 }), [])
    const single = gbpGridPoints({
      centerLat: -23.45,
      centerLng: -46.56,
      size: 1,
      radiusKm: 5,
    })
    assert.equal(single.length, 1)
    assert.equal(single[0].lat, -23.45)
  })
})

describe("parseGbpGridPointTag", () => {
  it("lê linha e coluna da própria malha", () => {
    assert.deepEqual(parseGbpGridPointTag(SCAN, `${SCAN}:3:7`), {
      row: 3,
      col: 7,
    })
  })

  it("recusa tag de outra malha", () => {
    const other = "00000000-0000-0000-0000-000000000000"
    assert.equal(parseGbpGridPointTag(SCAN, `${other}:0:0`), null)
  })

  it("recusa tag malformada e ausente", () => {
    assert.equal(parseGbpGridPointTag(SCAN, `${SCAN}:0`), null)
    assert.equal(parseGbpGridPointTag(SCAN, `${SCAN}:a:b`), null)
    assert.equal(parseGbpGridPointTag(SCAN, null), null)
  })
})

describe("gbpGridTaskIdsFromPosted", () => {
  const requested = [`${SCAN}:0:0`, `${SCAN}:0:1`, `${SCAN}:0:2`]

  it("correlaciona pela tag, mesmo fora de ordem", () => {
    const read = gbpGridTaskIdsFromPosted({
      scanId: SCAN,
      requested,
      created: [
        { index: 0, id: "t-c", tag: `${SCAN}:0:2` },
        { index: 1, id: "t-a", tag: `${SCAN}:0:0` },
        { index: 2, id: "t-b", tag: `${SCAN}:0:1` },
      ],
    })

    assert.deepEqual(read.taskIds, { "0:0": "t-a", "0:1": "t-b", "0:2": "t-c" })
    assert.deepEqual(read.unmapped, [])
    assert.equal(read.byIndex, 0)
  })

  it("cai para a posição quando a resposta inteira volta sem tag", () => {
    const read = gbpGridTaskIdsFromPosted({
      scanId: SCAN,
      requested,
      created: [
        { index: 0, id: "t-a", tag: null },
        { index: 1, id: "t-b", tag: null },
        { index: 2, id: "t-c", tag: null },
      ],
    })

    assert.deepEqual(read.taskIds, { "0:0": "t-a", "0:1": "t-b", "0:2": "t-c" })
    assert.equal(read.byIndex, 3)
    assert.deepEqual(read.unmapped, [])
  })

  it("não adivinha pela posição quando uma tag desalinha", () => {
    const read = gbpGridTaskIdsFromPosted({
      scanId: SCAN,
      requested,
      created: [
        // A tag presente prova que a ordem não corresponde ao request.
        { index: 0, id: "t-b", tag: `${SCAN}:0:1` },
        { index: 1, id: "t-a", tag: null },
        { index: 2, id: "t-c", tag: null },
      ],
    })

    assert.deepEqual(read.taskIds, { "0:1": "t-b" })
    assert.equal(read.byIndex, 0)
    assert.deepEqual(read.unmapped, [`${SCAN}:0:0`, `${SCAN}:0:2`])
  })

  it("não adivinha pela posição quando a resposta veio incompleta", () => {
    const read = gbpGridTaskIdsFromPosted({
      scanId: SCAN,
      requested,
      created: [{ index: 0, id: "t-a", tag: null }],
    })

    assert.deepEqual(read.taskIds, {})
    assert.equal(read.unmapped.length, 3)
  })
})

describe("gbpGridPointsToPost", () => {
  it("enfileira pendente e falho, nunca concluído nem já na fila", () => {
    const points = [
      point(0, 0),
      point(0, 1, { status: "failed", error: "erro" }),
      point(0, 2, { status: "done", position: 3 }),
      point(1, 0, { status: "queued", attempts: 1 }),
    ]

    const chosen = gbpGridPointsToPost(points, {}, 10)

    assert.deepEqual(
      chosen.map((item) => `${item.row}:${item.col}`),
      ["0:0", "0:1"],
    )
  })

  it("respeita o teto de tentativas para não reenfileirar sem fim", () => {
    const points = [
      point(0, 0, { status: "failed", attempts: GBP_GRID_MAX_ATTEMPTS }),
      point(0, 1, { status: "failed", attempts: GBP_GRID_MAX_ATTEMPTS - 1 }),
    ]

    const chosen = gbpGridPointsToPost(points, {}, 10)

    assert.deepEqual(
      chosen.map((item) => `${item.row}:${item.col}`),
      ["0:1"],
    )
  })

  it("não reenfileira pendente que já tem tarefa em aberto", () => {
    const chosen = gbpGridPointsToPost([point(0, 0)], { "0:0": "t-a" }, 10)

    assert.deepEqual(chosen, [])
  })

  it("respeita o tamanho do lote", () => {
    const points = [point(0, 0), point(0, 1), point(0, 2)]

    assert.equal(gbpGridPointsToPost(points, {}, 2).length, 2)
  })
})

describe("gbpGridPointsToCollect", () => {
  it("coleta só quem tem tarefa em aberto", () => {
    const points = [
      point(0, 0, { status: "queued" }),
      point(0, 1, { status: "queued" }),
      point(0, 2, { status: "done", position: 1 }),
      point(1, 0, { status: "failed" }),
    ]

    const chosen = gbpGridPointsToCollect(points, {
      "0:0": "t-a",
      "0:2": "t-c",
      "1:0": "t-d",
    })

    assert.deepEqual(
      chosen.map((item) => `${item.row}:${item.col}`),
      ["0:0"],
    )
  })
})

describe("gbpGridMergePoints", () => {
  it("nunca sobrescreve ponto já concluído, porque foi pago", () => {
    const points = [
      point(0, 0, { status: "done", position: 2 }),
      point(0, 1, { status: "queued" }),
    ]
    const updates = new Map([
      ["0:0", point(0, 0, { status: "failed" })],
      ["0:1", point(0, 1, { status: "done", position: 5 })],
    ])

    const merged = gbpGridMergePoints(points, updates)

    assert.equal(merged[0].status, "done")
    assert.equal(merged[0].position, 2)
    assert.equal(merged[1].status, "done")
    assert.equal(merged[1].position, 5)
  })
})

describe("gbpGridNextStatus", () => {
  it("segue rodando enquanto houver ponto na fila", () => {
    const points = [point(0, 0, { status: "done" }), point(0, 1, { status: "queued" })]

    assert.equal(gbpGridNextStatus(points, { deadlineReached: false }), "running")
  })

  it("fecha como parcial quando o prazo estoura com ponto em aberto", () => {
    const points = [point(0, 0, { status: "done" }), point(0, 1, { status: "queued" })]

    assert.equal(gbpGridNextStatus(points, { deadlineReached: true }), "partial")
  })

  it("fecha como parcial quando sobra ponto falho", () => {
    const points = [point(0, 0, { status: "done" }), point(0, 1, { status: "failed" })]

    assert.equal(gbpGridNextStatus(points, { deadlineReached: false }), "partial")
  })

  it("fecha como pronta quando tudo foi coletado", () => {
    const points = [point(0, 0, { status: "done" }), point(0, 1, { status: "done" })]

    assert.equal(gbpGridNextStatus(points, { deadlineReached: false }), "ready")
  })
})

describe("contagens", () => {
  it("conta processado como coletado mais desistido, e não a fila", () => {
    const points = [
      point(0, 0, { status: "done" }),
      point(0, 1, { status: "failed" }),
      point(0, 2, { status: "queued" }),
      point(1, 0),
    ]

    assert.equal(gbpGridProcessed(points), 2)
    assert.equal(gbpGridFailedCount(points), 1)
  })
})

describe("gbpGridMetrics", () => {
  it("ignora ponto falho e ponto na fila", () => {
    const points = [
      point(0, 0, { status: "done", position: 1 }),
      point(0, 1, { status: "done", position: null }),
      point(0, 2, { status: "failed" }),
      point(1, 0, { status: "queued" }),
    ]

    const metrics = gbpGridMetrics(points)

    assert.equal(metrics.total, 2)
    assert.equal(metrics.found, 1)
    assert.equal(metrics.arp, 1)
    assert.equal(metrics.solv, 50)
  })

  it("devolve vazio quando nada foi coletado", () => {
    const metrics = gbpGridMetrics([point(0, 0, { status: "failed" })])

    assert.deepEqual(metrics, {
      arp: null,
      atrp: null,
      solv: null,
      found: 0,
      total: 0,
    })
  })
})

describe("readGbpGridPoints", () => {
  it("lê malha antiga, sem attempts nem error", () => {
    const points = readGbpGridPoints([
      {
        row: 0,
        col: 0,
        lat: -23.36,
        lng: -46.66,
        status: "failed",
        position: null,
        competitors: [],
      },
    ])

    assert.equal(points.length, 1)
    assert.equal(points[0].attempts, 0)
    assert.equal(points[0].error, null)
    assert.equal(points[0].status, "failed")
  })

  it("aceita o estado de fila e degrada estado desconhecido", () => {
    const points = readGbpGridPoints([
      { row: 0, col: 0, lat: 1, lng: 2, status: "queued" },
      { row: 0, col: 1, lat: 1, lng: 2, status: "sei-la" },
    ])

    assert.equal(points[0].status, "queued")
    assert.equal(points[1].status, "pending")
  })
})

describe("gbpGridScanResumable", () => {
  it("só oferece retomada quando sobrou ponto por coletar", () => {
    const base = {
      id: SCAN,
      lead_id: "l",
      profile_id: "p",
      keyword: "SEO Local",
      center_lat: -23.45,
      center_lng: -46.56,
      size: 3,
      radius_km: 1,
      zoom: 15,
      source: "dataforseo_maps",
      mode: "queued",
      processed: 1,
      total: 1,
      cost_usd: 0,
      task_ids: {},
      error_message: null,
      started_at: null,
      captured_at: "2026-09-07T01:52:55.272Z",
    }

    assert.equal(
      gbpGridScanResumable({
        ...base,
        status: "partial",
        points: [point(0, 0, { status: "failed" })],
      }),
      true,
    )
    assert.equal(
      gbpGridScanResumable({
        ...base,
        status: "partial",
        points: [point(0, 0, { status: "done" })],
      }),
      false,
    )
    assert.equal(
      gbpGridScanResumable({
        ...base,
        status: "running",
        points: [point(0, 0, { status: "failed" })],
      }),
      false,
    )
    assert.equal(gbpGridScanResumable(null), false)
  })
})
