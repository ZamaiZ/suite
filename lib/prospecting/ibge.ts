import "server-only"

import type { BrazilStateCode } from "@/lib/br-locations"
import { normalizeCityMatch } from "@/lib/br-locations"
import {
  coverageCircle,
  readMunicipalityGeometry,
  type CoverageCircle,
  type MunicipalityGeometry,
} from "@/lib/prospecting/geometry"

const IBGE_BASE = "https://servicodados.ibge.gov.br/api"
const IBGE_TIMEOUT_MS = 20_000
const IBGE_ERROR = "Não foi possível validar os limites do município."

type IbgeMunicipalityRow = {
  id?: unknown
  nome?: unknown
}

export type IbgeMunicipality = {
  code: string
  city: string
  stateCode: BrazilStateCode
}

export type ProspectingBoundary = IbgeMunicipality & {
  geometry: MunicipalityGeometry
  circle: CoverageCircle
  sourceUpdatedAt: string | null
  fetchedAt: string
}

export type IbgeMunicipalityResult =
  | { status: "ok"; data: IbgeMunicipality }
  | { status: "error"; message: string }

export type ProspectingBoundaryResult =
  | { status: "ok"; data: ProspectingBoundary }
  | { status: "error"; message: string }

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()
}

async function ibgeFetch(path: string, accept = "application/json") {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), IBGE_TIMEOUT_MS)
  try {
    const response = await fetch(`${IBGE_BASE}${path}`, {
      cache: "no-store",
      headers: { Accept: accept },
      signal: controller.signal,
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function resolveIbgeMunicipality(
  city: string,
  stateCode: BrazilStateCode,
): Promise<IbgeMunicipalityResult> {
  const canonical = normalizeCityMatch(stateCode, city)
  if (!canonical) return { status: "error", message: "Município inválido." }

  const response = await ibgeFetch(
    `/v1/localidades/estados/${encodeURIComponent(stateCode)}/municipios`,
  )
  if (!Array.isArray(response)) return { status: "error", message: IBGE_ERROR }
  const matches = (response as IbgeMunicipalityRow[]).filter(
    (row) => typeof row.nome === "string" && fold(row.nome) === fold(canonical),
  )
  if (matches.length !== 1) return { status: "error", message: IBGE_ERROR }
  const code = matches[0]?.id
  if ((typeof code !== "number" && typeof code !== "string") || !String(code)) {
    return { status: "error", message: IBGE_ERROR }
  }
  return {
    status: "ok",
    data: { code: String(code), city: canonical, stateCode },
  }
}

export async function loadProspectingBoundary(
  city: string,
  stateCode: BrazilStateCode,
): Promise<ProspectingBoundaryResult> {
  const municipality = await resolveIbgeMunicipality(city, stateCode)
  if (municipality.status === "error") return municipality
  const geoJson = await ibgeFetch(
    `/v3/malhas/municipios/${encodeURIComponent(municipality.data.code)}?formato=application/vnd.geo+json&qualidade=minima`,
    "application/vnd.geo+json, application/json",
  )
  const geometry = readMunicipalityGeometry(geoJson)
  if (!geometry) return { status: "error", message: IBGE_ERROR }
  return {
    status: "ok",
    data: {
      ...municipality.data,
      geometry,
      circle: coverageCircle(geometry),
      // A resposta GeoJSON não publica Last-Modified no corpo.
      sourceUpdatedAt: null,
      fetchedAt: new Date().toISOString(),
    },
  }
}
