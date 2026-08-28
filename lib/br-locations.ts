import raw from "@/lib/br-locations.json"

type RawState = {
  sigla: string
  nome: string
  cidades: string[]
}

type RawLocations = {
  estados: RawState[]
}

const data = raw as RawLocations

export type BrazilStateCode = RawState["sigla"]

export type BrazilState = {
  code: BrazilStateCode
  name: string
}

export type CitySearchItem = {
  name: string
  stateCode: BrazilStateCode
  label: string
}

export type CitySearchResult = {
  items: CitySearchItem[]
  hasMore: boolean
}

const STATE_CODES = new Set<string>()
const STATES: BrazilState[] = []
const CITIES_BY_STATE = new Map<BrazilStateCode, readonly string[]>()
const FLAT_CITIES: CitySearchItem[] = []

for (const state of data.estados) {
  const code = state.sigla as BrazilStateCode
  STATE_CODES.add(code)
  STATES.push({ code, name: state.nome })
  const cities = Object.freeze([...state.cidades])
  CITIES_BY_STATE.set(code, cities)
  for (const name of cities) {
    FLAT_CITIES.push({
      name,
      stateCode: code,
      label: `${name} · ${code}`,
    })
  }
}

Object.freeze(STATES)
Object.freeze(FLAT_CITIES)

export const BR_STATES: readonly BrazilState[] = STATES

const DEFAULT_SEARCH_LIMIT = 50

function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
}

export function isBrazilStateCode(value: unknown): value is BrazilStateCode {
  return typeof value === "string" && STATE_CODES.has(value.toUpperCase())
}

export function normalizeStateCode(value: string): BrazilStateCode | null {
  const code = value.trim().toUpperCase()
  return isBrazilStateCode(code) ? code : null
}

export function citiesForState(code: BrazilStateCode): readonly string[] {
  return CITIES_BY_STATE.get(code) ?? []
}

export function normalizeCityMatch(
  stateCode: BrazilStateCode,
  input: string,
): string | null {
  const needle = foldText(input)
  if (!needle) return null
  for (const city of citiesForState(stateCode)) {
    if (foldText(city) === needle) return city
  }
  return null
}

export function isValidCity(stateCode: BrazilStateCode, city: string): boolean {
  return normalizeCityMatch(stateCode, city) !== null
}

export function searchCities(input: {
  q?: string
  offset?: number
  limit?: number
}): CitySearchResult {
  const offset = Math.max(0, input.offset ?? 0)
  const limit = Math.max(1, input.limit ?? DEFAULT_SEARCH_LIMIT)
  const needle = foldText(input.q ?? "")

  const filtered = needle
    ? FLAT_CITIES.filter((item) => {
        const cityKey = foldText(item.name)
        const labelKey = foldText(item.label)
        return cityKey.includes(needle) || labelKey.includes(needle)
      })
    : FLAT_CITIES

  const items = filtered.slice(offset, offset + limit)
  return {
    items,
    hasMore: offset + limit < filtered.length,
  }
}

export function brStateOptions() {
  return BR_STATES.map((state) => ({
    value: state.code,
    label: `${state.code} — ${state.name}`,
  }))
}

export function cityOptionsForState(code: BrazilStateCode | null | undefined) {
  if (!code) return []
  return citiesForState(code).map((city) => ({
    value: city,
    label: city,
  }))
}
