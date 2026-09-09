import type { GbpGridPoint } from "./gbp-grid.ts"

/**
 * O retrato de posicionamento que já estava pago e não tinha tela.
 *
 * A malha guarda até 3 concorrentes por ponto, em até 121 pontos — mais de
 * trezentos registros por scan — e nada os exibia. Agregar é gratuito e
 * retroativo a toda malha já coletada.
 *
 * Isto é o **retrato**, não o teardown: quem aparece, onde e em que posição. A
 * análise profunda de concorrente é outra fase.
 */

export type GbpGridCompetitor = {
  /** `placeId` quando existe; título normalizado quando não. */
  key: string
  title: string
  placeId: string | null
  /** Em quantas células apareceu entre os guardados. */
  cells: number
  averagePosition: number
  bestPosition: number
  /** Em quantas células ficou à frente do perfil auditado. */
  cellsAhead: number
}

export type GbpGridPositionSnapshot = {
  /** Células coletadas com sucesso — a base de tudo abaixo. */
  measured: number
  /** Células em que o perfil está no top 3. */
  ownTop3: number
  /** Células em que o perfil não aparece. */
  ownAbsent: number
  competitors: GbpGridCompetitor[]
}

function foldTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

type Bucket = {
  title: string
  placeId: string | null
  positions: number[]
  cellsAhead: number
}

export function gbpGridPositionSnapshot(
  points: readonly GbpGridPoint[],
): GbpGridPositionSnapshot {
  const buckets = new Map<string, Bucket>()
  let measured = 0
  let ownTop3 = 0
  let ownAbsent = 0

  for (const point of points) {
    if (point.status !== "done") continue
    measured += 1
    if (point.position === null) ownAbsent += 1
    else if (point.position <= 3) ownTop3 += 1

    for (const competitor of point.competitors) {
      // Agrupar só por título juntaria negócios homônimos — rede de franquia
      // com o mesmo nome em bairros diferentes é o caso comum.
      const key = competitor.placeId ?? foldTitle(competitor.title)
      const bucket = buckets.get(key) ?? {
        title: competitor.title,
        placeId: competitor.placeId,
        positions: [],
        cellsAhead: 0,
      }
      bucket.positions.push(competitor.position)
      // Perfil ausente na célula significa que todo mundo ali está à frente.
      if (point.position === null || competitor.position < point.position) {
        bucket.cellsAhead += 1
      }
      buckets.set(key, bucket)
    }
  }

  const competitors: GbpGridCompetitor[] = []
  for (const [key, bucket] of buckets) {
    if (bucket.positions.length === 0) continue
    const sum = bucket.positions.reduce((total, value) => total + value, 0)
    competitors.push({
      key,
      title: bucket.title,
      placeId: bucket.placeId,
      cells: bucket.positions.length,
      averagePosition: sum / bucket.positions.length,
      bestPosition: Math.min(...bucket.positions),
      cellsAhead: bucket.cellsAhead,
    })
  }

  // Quem aparece em mais células primeiro; empate desempata pela posição média.
  competitors.sort((left, right) => {
    if (left.cells !== right.cells) return right.cells - left.cells
    return left.averagePosition - right.averagePosition
  })

  return { measured, ownTop3, ownAbsent, competitors }
}
