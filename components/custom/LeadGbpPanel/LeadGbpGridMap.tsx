"use client"

import { useEffect, useRef, useState } from "react"
import { RiLoader4Line, RiMapPinLine } from "react-icons/ri"
import { cn } from "@/lib/cn"
import { GOOGLE_MAPS_DARK_STYLES, loadGoogleMaps } from "@/lib/google-maps"
import type { GbpGridPoint } from "@/lib/leads/gbp-grid"
import { SHADCN_PALETTE } from "@/lib/theme/shadcn-palette"

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
  const mapRef = useRef<google.maps.Map | null>(null)
  const centerMarkerRef = useRef<google.maps.Marker | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const [scriptError, setScriptError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false

    void loadGoogleMaps().then((result) => {
      if (cancelled || !containerRef.current || mapRef.current) return
      if (result.status === "error") {
        setScriptError(result.message)
        return
      }
      setScriptError(null)

      const { Map } = result.maps
      const center = { lat: centerLat, lng: centerLng }
      const map = new Map(containerRef.current, {
        center,
        zoom: 12,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "cooperative",
        clickableIcons: false,
        styles: isDarkMode() ? GOOGLE_MAPS_DARK_STYLES : [],
      })

      centerMarkerRef.current = new google.maps.Marker({
        map,
        position: center,
        zIndex: 1000,
      })

      mapRef.current = map
      setReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [centerLat, centerLng])

  // Redesenha a cada mudança nos pontos, para que a malha preencha enquanto o
  // scan avança.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    for (const marker of markersRef.current) marker.setMap(null)
    markersRef.current = []

    const bounds = new google.maps.LatLngBounds()
    for (const point of points) {
      const position = { lat: point.lat, lng: point.lng }
      bounds.extend(position)
      const collected = point.status === "done" || point.status === "failed"
      const marker = new google.maps.Marker({
        map,
        position,
        title: pointTitle(point),
        label: {
          text: pointLabel(point),
          color: SHADCN_PALETTE.light.primaryForeground,
          fontSize: "11px",
          fontWeight: "600",
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: pointColor(point),
          fillOpacity: collected ? 0.95 : 0.45,
          strokeColor: SHADCN_PALETTE.light.primaryForeground,
          strokeWeight: 1.5,
        },
      })
      markersRef.current.push(marker)
    }

    if (!bounds.isEmpty()) map.fitBounds(bounds, 32)
  }, [points, ready])

  useEffect(() => {
    return () => {
      for (const marker of markersRef.current) marker.setMap(null)
      markersRef.current = []
      centerMarkerRef.current?.setMap(null)
      centerMarkerRef.current = null
      mapRef.current = null
    }
  }, [])

  if (scriptError) {
    return (
      <div
        className={cn(
          "flex min-h-56 flex-col items-center justify-center gap-2 rounded-lg",
          "border border-border-subtle bg-elevated px-4 text-center",
          className,
        )}
      >
        <RiMapPinLine aria-hidden className="size-5 text-fg-muted" />
        <p className="font-sans text-caption text-fg-muted">{scriptError}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn("relative min-h-56 overflow-hidden rounded-lg", className)}
      >
        <div ref={containerRef} className="size-full min-h-56" />
        {!ready ? (
          <div className="absolute inset-0 flex items-center justify-center bg-elevated">
            <RiLoader4Line
              aria-hidden
              className="size-5 animate-spin text-fg-muted"
            />
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
            <span className="font-sans text-caption text-fg-muted">
              {band.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
