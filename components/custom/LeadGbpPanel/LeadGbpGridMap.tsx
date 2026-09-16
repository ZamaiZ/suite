"use client"

import { useEffect, useRef, useState } from "react"
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type GeoJSONSource,
} from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import type { FeatureCollection, Point } from "geojson"
import { RiMapPinLine } from "react-icons/ri"
import { cn } from "cn"
import {
  ensureMapWorker,
  getMapTilesKey,
  MAP_STYLE_UNCONFIGURED,
  mapStyleUrl,
} from "@/lib/maplibre"
import type { GbpGridPoint } from "@/lib/leads/gbp-grid"
import { SHADCN_PALETTE } from "@/lib/theme/shadcn-palette"
import { Spinner } from "@/components/ui/spinner"

/**
 * Uma faixa só alimenta a cor do ponto e a legenda, para que as duas não
 * divirjam no primeiro ajuste. A ordem importa: vence a primeira que casar.
 *
 * "Falhou" tem tom neutro de propósito. Vermelho já significa "o perfil não
 * aparece aqui", e pintar falha de coleta da mesma cor fazia uma malha
 * inteiramente quebrada parecer um diagnóstico de invisibilidade.
 */
type GbpGridBand = {
  id: string
  label: string
  color: string
  match: (point: GbpGridPoint) => boolean
}

export const GBP_GRID_BANDS: readonly GbpGridBand[] = [
  {
    id: "failed",
    label: "Falhou",
    color: SHADCN_PALETTE.light.mutedForeground,
    match: (point) => point.status === "failed",
  },
  {
    id: "waiting",
    label: "Na fila",
    color: SHADCN_PALETTE.light.mutedForeground,
    match: (point) => point.status !== "done",
  },
  {
    id: "top",
    label: "Top 3",
    color: SHADCN_PALETTE.light.chart[0],
    match: (point) => point.position !== null && point.position <= 3,
  },
  {
    id: "good",
    label: "4–10",
    color: SHADCN_PALETTE.light.chart[1],
    match: (point) => point.position !== null && point.position <= 10,
  },
  {
    id: "mid",
    label: "11–20",
    color: SHADCN_PALETTE.light.chart[2],
    match: (point) => point.position !== null && point.position <= 20,
  },
  {
    id: "low",
    label: "21+",
    color: SHADCN_PALETTE.light.chart[3],
    match: (point) => point.position !== null,
  },
  {
    id: "absent",
    label: "Não aparece",
    color: SHADCN_PALETTE.light.destructive,
    match: () => true,
  },
]

const FALLBACK_COLOR = SHADCN_PALETTE.light.mutedForeground

function pointBand(point: GbpGridPoint): GbpGridBand | null {
  return GBP_GRID_BANDS.find((band) => band.match(point)) ?? null
}

function pointColor(point: GbpGridPoint): string {
  return pointBand(point)?.color ?? FALLBACK_COLOR
}

function pointLabel(point: GbpGridPoint): string {
  if (point.status === "failed") return "!"
  if (point.status !== "done") return ""
  if (point.position === null) return "—"
  return String(point.position)
}

function pointTitle(point: GbpGridPoint): string {
  const band = pointBand(point)?.label ?? ""
  if (point.status === "failed" && point.error) {
    return `${band}: ${point.error}`
  }
  return band
}

function isDarkMode(): boolean {
  return document.documentElement.classList.contains("dark")
}

const SOURCE_ID = "grid"
const CIRCLE_ID = "grid-circles"
const LABEL_ID = "grid-labels"

/**
 * Uma camada, e não um marcador por ponto.
 *
 * A malha vai a 121 pontos; com marcador isso é 121 nós no DOM, cada um com o
 * seu rótulo. Como camada é um desenho só, e a cor de cada ponto viaja como
 * propriedade da feature — as faixas continuam sendo a única fonte da cor.
 */
function pointsToGeoJson(
  points: readonly GbpGridPoint[],
): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      properties: {
        color: pointColor(point),
        label: pointLabel(point),
        title: pointTitle(point),
        // Ponto ainda não coletado fica translúcido, como no mapa anterior.
        opacity:
          point.status === "done" || point.status === "failed" ? 0.95 : 0.45,
      },
      geometry: { type: "Point", coordinates: [point.lng, point.lat] },
    })),
  }
}

function boundsOf(points: readonly GbpGridPoint[]): LngLatBounds | null {
  if (points.length === 0) return null
  const bounds = new LngLatBounds()
  for (const point of points) bounds.extend([point.lng, point.lat])
  return bounds
}

export function LeadGbpGridMap({
  centerLat,
  centerLng,
  points,
  className,
}: {
  centerLat: number
  centerLng: number
  points: readonly GbpGridPoint[]
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const centerMarkerRef = useRef<Marker | null>(null)
  const pointsRef = useRef(points)
  useEffect(() => {
    pointsRef.current = points
  })
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // Derivado no render, não no efeito: a chave vem do ambiente e é constante.
  const scriptError =
    runtimeError ?? (getMapTilesKey() ? null : MAP_STYLE_UNCONFIGURED)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const style = mapStyleUrl(isDarkMode() ? "dark" : "light")
    if (!style) return

    // Antes de qualquer `new Map`: sem isto o worker não carrega e o mapa fica
    // em carregamento eterno, sem erro nenhum.
    ensureMapWorker()

    const center: [number, number] = [centerLng, centerLat]
    const map = new MapLibreMap({
      container: containerRef.current,
      style,
      center,
      zoom: 12,
      attributionControl: { compact: true },
    })
    mapRef.current = map

    map.addControl(new NavigationControl({ showCompass: false }))
    map.on("error", () => setRuntimeError("Não foi possível carregar o mapa."))

    // Trocar de estilo descarta camadas; o desenho mora numa função que roda no
    // primeiro `load` e a cada troca de tema.
    function drawGrid() {
      const data = pointsToGeoJson(pointsRef.current)
      const existing = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
      if (existing) {
        existing.setData(data)
        return
      }
      map.addSource(SOURCE_ID, { type: "geojson", data })
      map.addLayer({
        id: CIRCLE_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": 13,
          "circle-color": ["get", "color"],
          "circle-opacity": ["get", "opacity"],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": SHADCN_PALETTE.light.primaryForeground,
        },
      })
      map.addLayer({
        id: LABEL_ID,
        type: "symbol",
        source: SOURCE_ID,
        layout: {
          "text-field": ["get", "label"],
          // Stack que o próprio estilo do LocationIQ usa — conferido nas 96
          // camadas dele. Omitir cai na fonte padrão da especificação, que o
          // servidor de glyphs não serve, e o rótulo somia com erro no console.
          "text-font": [
            "Montserrat Regular",
            "Open Sans Regular",
            "Noto Sans Regular",
          ],
          "text-size": 11,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: { "text-color": SHADCN_PALETTE.light.primaryForeground },
      })
    }

    map.on("load", () => {
      setRuntimeError(null)
      setReady(true)
      drawGrid()
      centerMarkerRef.current = new Marker().setLngLat(center).addTo(map)
      const bounds = boundsOf(pointsRef.current)
      if (bounds) map.fitBounds(bounds, { padding: 32, animate: false })
    })

    map.on("styledata", () => {
      if (map.isStyleLoaded()) drawGrid()
    })

    return () => {
      centerMarkerRef.current?.remove()
      centerMarkerRef.current = null
      map.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [centerLat, centerLng])

  // Redesenha a cada mudança nos pontos, para que a malha preencha enquanto o
  // scan avança.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
    if (!source) return
    source.setData(pointsToGeoJson(points))
    const bounds = boundsOf(points)
    if (bounds) map.fitBounds(bounds, { padding: 32 })
  }, [points, ready])

  useEffect(() => {
    if (!ready) return
    const observer = new MutationObserver(() => {
      const map = mapRef.current
      if (!map) return
      const next = mapStyleUrl(isDarkMode() ? "dark" : "light")
      if (next) map.setStyle(next)
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })
    return () => observer.disconnect()
  }, [ready])

  if (scriptError) {
    return (
      <div
        className={cn(
          "flex min-h-56 flex-col items-center justify-center gap-2 rounded-lg",
          "border border-border/70 bg-popover px-4 text-center",
          className,
        )}
      >
        <RiMapPinLine aria-hidden className="size-5 text-muted-foreground" />
        <p className="text-xs/relaxed text-muted-foreground">{scriptError}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "relative min-h-56 overflow-hidden rounded-lg",
          className,
        )}
      >
        <div ref={containerRef} className="size-full min-h-56" />
        {!ready ? (
          <div className="absolute inset-0 flex items-center justify-center bg-popover">
            <Spinner aria-hidden className="size-5 text-muted-foreground" />
          </div>
        ) : null}
      </div>

      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {GBP_GRID_BANDS.map((band) => (
          <li key={band.id} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2.5 rounded-full"
              style={{ backgroundColor: band.color }}
            />
            <span className="text-xs/relaxed text-muted-foreground">
              {band.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
