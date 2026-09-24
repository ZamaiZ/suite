import type {
  Feature,
  FeatureCollection,
  GeoJsonObject,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson"

export type MunicipalityGeometry = Polygon | MultiPolygon
export type GeoPoint = { latitude: number; longitude: number }
export type CoverageCircle = GeoPoint & { radiusKm: number }

const EARTH_RADIUS_KM = 6371.0088
const EDGE_EPSILON = 1e-10

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function samePosition(left: Position, right: Position): boolean {
  return left[0] === right[0] && left[1] === right[1]
}

function validPosition(value: unknown): value is Position {
  if (!Array.isArray(value) || value.length < 2) return false
  const [longitude, latitude] = value
  return (
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90
  )
}

function validRing(value: unknown): value is Position[] {
  return (
    Array.isArray(value) &&
    value.length >= 4 &&
    value.every(validPosition) &&
    samePosition(value[0], value[value.length - 1])
  )
}

function validPolygonCoordinates(value: unknown): value is Position[][] {
  return Array.isArray(value) && value.length > 0 && value.every(validRing)
}

function readDirectGeometry(value: unknown): MunicipalityGeometry | null {
  const row = record(value)
  if (row?.type === "Polygon" && validPolygonCoordinates(row.coordinates)) {
    return { type: "Polygon", coordinates: row.coordinates }
  }
  if (
    row?.type === "MultiPolygon" &&
    Array.isArray(row.coordinates) &&
    row.coordinates.length > 0 &&
    row.coordinates.every(validPolygonCoordinates)
  ) {
    return { type: "MultiPolygon", coordinates: row.coordinates }
  }
  return null
}

function polygonParts(geometry: MunicipalityGeometry): Position[][][] {
  return geometry.type === "Polygon"
    ? [geometry.coordinates]
    : geometry.coordinates
}

export function readMunicipalityGeometry(
  value: unknown,
): MunicipalityGeometry | null {
  const direct = readDirectGeometry(value)
  if (direct) return direct
  const row = record(value)
  if (row?.type === "Feature") {
    return readDirectGeometry(row.geometry)
  }
  if (row?.type !== "FeatureCollection" || !Array.isArray(row.features)) {
    return null
  }

  const parts: Position[][][] = []
  for (const feature of row.features) {
    const featureRow = record(feature)
    if (featureRow?.type !== "Feature") return null
    const geometry = readDirectGeometry(featureRow.geometry)
    if (!geometry) return null
    parts.push(...polygonParts(geometry))
  }
  if (parts.length === 0) return null
  return parts.length === 1
    ? { type: "Polygon", coordinates: parts[0] }
    : { type: "MultiPolygon", coordinates: parts }
}

function pointOnSegment(
  longitude: number,
  latitude: number,
  start: Position,
  end: Position,
): boolean {
  const cross =
    (longitude - start[0]) * (end[1] - start[1]) -
    (latitude - start[1]) * (end[0] - start[0])
  if (Math.abs(cross) > EDGE_EPSILON) return false
  return (
    longitude >= Math.min(start[0], end[0]) - EDGE_EPSILON &&
    longitude <= Math.max(start[0], end[0]) + EDGE_EPSILON &&
    latitude >= Math.min(start[1], end[1]) - EDGE_EPSILON &&
    latitude <= Math.max(start[1], end[1]) + EDGE_EPSILON
  )
}

function pointInRing(point: GeoPoint, ring: Position[]): boolean {
  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const currentPoint = ring[index]
    const previousPoint = ring[previous]
    if (
      pointOnSegment(
        point.longitude,
        point.latitude,
        previousPoint,
        currentPoint,
      )
    ) {
      return true
    }
    const crosses =
      currentPoint[1] > point.latitude !== previousPoint[1] > point.latitude &&
      point.longitude <
        ((previousPoint[0] - currentPoint[0]) *
          (point.latitude - currentPoint[1])) /
          (previousPoint[1] - currentPoint[1]) +
          currentPoint[0]
    if (crosses) inside = !inside
  }
  return inside
}

function pointInPolygon(point: GeoPoint, polygon: Position[][]): boolean {
  if (!pointInRing(point, polygon[0])) return false
  for (const hole of polygon.slice(1)) {
    if (pointInRing(point, hole)) return false
  }
  return true
}

export function pointInMunicipality(
  geometry: MunicipalityGeometry,
  point: GeoPoint,
): boolean {
  if (
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude) ||
    point.latitude < -90 ||
    point.latitude > 90 ||
    point.longitude < -180 ||
    point.longitude > 180
  ) {
    return false
  }
  return polygonParts(geometry).some((polygon) => pointInPolygon(point, polygon))
}

function radians(value: number): number {
  return (value * Math.PI) / 180
}

function distanceKm(left: GeoPoint, right: GeoPoint): number {
  const latitudeDelta = radians(right.latitude - left.latitude)
  const longitudeDelta = radians(right.longitude - left.longitude)
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(left.latitude)) *
      Math.cos(radians(right.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function coverageCircle(
  geometry: MunicipalityGeometry,
): CoverageCircle {
  const points = polygonParts(geometry).flat(2)
  let minLongitude = 180
  let maxLongitude = -180
  let minLatitude = 90
  let maxLatitude = -90
  for (const [longitude, latitude] of points) {
    minLongitude = Math.min(minLongitude, longitude)
    maxLongitude = Math.max(maxLongitude, longitude)
    minLatitude = Math.min(minLatitude, latitude)
    maxLatitude = Math.max(maxLatitude, latitude)
  }
  const center = {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
  }
  const radiusKm = Math.max(
    ...points.map(([longitude, latitude]) =>
      distanceKm(center, { longitude, latitude }),
    ),
  )
  return {
    latitude: Number(center.latitude.toFixed(7)),
    longitude: Number(center.longitude.toFixed(7)),
    radiusKm: Number((radiusKm * 1.02).toFixed(6)),
  }
}
