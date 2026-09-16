"use client"

import { useEffect, useRef, useState } from "react"
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type GeoJSONSource,
} from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import type { Feature, Polygon } from "geojson"
import { RiMapPinLine, RiRefreshLine } from "react-icons/ri"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { cn } from "cn"
import { SHADCN_PALETTE } from "@/lib/theme/shadcn-palette"
import {
  ensureMapWorker,
  getMapTilesKey,
  MAP_STYLE_UNCONFIGURED,
  mapStyleUrl,
} from "@/lib/maplibre"
import type { BriefingServiceRadiusMapProps } from "./BriefingServiceRadiusMap.types"

const SOURCE_ID = "radius"
const FILL_ID = "radius-fill"
const LINE_ID = "radius-line"

/** Vértices do círculo. 64 já não mostra canto no zoom que a tela usa. */
const CIRCLE_VERTICES = 64
const EARTH_KM = 6371

function readPrimaryColor(): string {
  if (typeof window === "undefined") return SHADCN_PALETTE.light.primary
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--primary")
    .trim()
  return value || SHADCN_PALETTE.light.primary
}

function isDarkMode(): boolean {
  return document.documentElement.classList.contains("dark")
}

/**
 * Círculo geodésico em GeoJSON.
 *
 * O `google.maps.Circle` desenhava em metros sobre a projeção; o MapLibre
 * desenha polígono em graus. Raio constante em graus vira elipse achatada longe
 * do equador — por isso a longitude é dividida pelo cosseno da latitude, e não
 * apenas somada. No Brasil a diferença chega a um terço da largura.
 */
function circlePolygon(
  latitude: number,
  longitude: number,
  radiusKm: number,
): Feature<Polygon> {
  const latDelta = (radiusKm / EARTH_KM) * (180 / Math.PI)
  const lonDelta = latDelta / Math.cos((latitude * Math.PI) / 180)
  const ring: [number, number][] = []
  for (let step = 0; step <= CIRCLE_VERTICES; step += 1) {
    const angle = (step / CIRCLE_VERTICES) * 2 * Math.PI
    ring.push([
      longitude + lonDelta * Math.cos(angle),
      latitude + latDelta * Math.sin(angle),
    ])
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ring] },
  }
}

function circleBounds(
  latitude: number,
  longitude: number,
  radiusKm: number,
): [[number, number], [number, number]] {
  const latDelta = (radiusKm / EARTH_KM) * (180 / Math.PI)
  const lonDelta = latDelta / Math.cos((latitude * Math.PI) / 180)
  return [
    [longitude - lonDelta, latitude - latDelta],
    [longitude + lonDelta, latitude + latDelta],
  ]
}

export function BriefingServiceRadiusMapCanvas({
  latitude,
  longitude,
  radiusKm,
  formattedAddress,
  loading = false,
  errorMessage = null,
  onRetry,
  className,
}: BriefingServiceRadiusMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const radiusRef = useRef(radiusKm)
  const addressRef = useRef(formattedAddress)
  // Ref de "valor mais recente": a escrita vai para um efeito, nunca no render.
  useEffect(() => {
    radiusRef.current = radiusKm
    addressRef.current = formattedAddress
  })

  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [scriptReady, setScriptReady] = useState(false)

  // Derivado no render, não no efeito: a chave vem do ambiente, é embutida na
  // compilação e não muda. Marcá-la por `setState` dentro do efeito seria uma
  // renderização em cascata para dizer algo que já se sabia antes de montar.
  const scriptError =
    runtimeError ?? (getMapTilesKey() ? null : MAP_STYLE_UNCONFIGURED)

  const showMap =
    latitude !== null && longitude !== null && !loading && !scriptError

  useEffect(() => {
    if (!showMap || !containerRef.current || mapRef.current) return

    const style = mapStyleUrl(isDarkMode() ? "dark" : "light")
    if (!style) return

    // Antes de qualquer `new Map`: sem isto o worker não carrega e o mapa fica
    // em carregamento eterno, sem erro nenhum.
    ensureMapWorker()

    const center: [number, number] = [longitude as number, latitude as number]
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

    // Trocar de estilo descarta camadas e fontes, então o desenho do raio mora
    // numa função que roda no primeiro `load` e a cada troca de tema.
    function drawRadius() {
      if (latitude === null || longitude === null) return
      const accent = readPrimaryColor()
      const data = circlePolygon(
        latitude,
        longitude,
        Math.max(radiusRef.current, 1),
      )
      if (map.getSource(SOURCE_ID)) {
        ;(map.getSource(SOURCE_ID) as GeoJSONSource).setData(data)
        return
      }
      map.addSource(SOURCE_ID, { type: "geojson", data })
      map.addLayer({
        id: FILL_ID,
        type: "fill",
        source: SOURCE_ID,
        paint: { "fill-color": accent, "fill-opacity": 0.16 },
      })
      map.addLayer({
        id: LINE_ID,
        type: "line",
        source: SOURCE_ID,
        paint: { "line-color": accent, "line-width": 2 },
      })
    }

    map.on("load", () => {
      setRuntimeError(null)
      setScriptReady(true)
      drawRadius()
      markerRef.current = new Marker({ color: readPrimaryColor() })
        .setLngLat(center)
        .addTo(map)
      map.fitBounds(
        circleBounds(
          latitude as number,
          longitude as number,
          Math.max(radiusRef.current, 1),
        ),
        { padding: 28, animate: false },
      )
    })

    // `styledata` dispara depois de cada `setStyle`; sem isto o raio some ao
    // alternar claro e escuro.
    map.on("styledata", () => {
      if (map.isStyleLoaded()) drawRadius()
    })

    return () => {
      markerRef.current?.remove()
      markerRef.current = null
      map.remove()
      mapRef.current = null
      setScriptReady(false)
    }
  }, [latitude, longitude, showMap])

  useEffect(() => {
    const map = mapRef.current
    if (latitude === null || longitude === null || !map || !scriptReady) return

    const center: [number, number] = [longitude, latitude]
    markerRef.current?.setLngLat(center)
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
    source?.setData(circlePolygon(latitude, longitude, Math.max(radiusKm, 1)))
    map.fitBounds(circleBounds(latitude, longitude, Math.max(radiusKm, 1)), {
      padding: 28,
    })
  }, [latitude, longitude, radiusKm, scriptReady])

  useEffect(() => {
    if (!showMap || !scriptReady) return

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
  }, [showMap, scriptReady])

  const placeholderMessage =
    scriptError ?? errorMessage ?? "Não foi possível localizar o endereço"

  const showRetry = Boolean(onRetry) && !scriptError

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      <div className="relative overflow-hidden rounded-xl border border-border bg-popover">
        {showMap ? (
          <div className="relative h-64 w-full sm:h-80">
            <div ref={containerRef} className="size-full" />
            {!scriptReady ? (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-popover text-xs/relaxed text-muted-foreground">
                <Spinner aria-hidden className="size-4.5 text-primary" />
                Carregando mapa…
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex h-64 w-full flex-col items-center justify-center gap-3 px-4 text-center sm:h-80">
            {loading ? (
              <>
                <Spinner aria-hidden className="size-5.5 text-primary" />
                <p className="text-xs/relaxed text-muted-foreground">
                  Localizando o endereço no mapa…
                </p>
              </>
            ) : (
              <>
                <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <RiMapPinLine size={18} aria-hidden />
                </span>
                <div className="max-w-sm">
                  <p className="text-xs/relaxed font-medium text-foreground">
                    {placeholderMessage}
                  </p>
                  {formattedAddress ? (
                    <p className="mt-1 text-xs/relaxed text-muted-foreground">
                      {formattedAddress}
                    </p>
                  ) : null}
                </div>
                {showRetry ? (
                  <Button type="button" variant="outline" onClick={onRetry}>
                    <RiRefreshLine
                      size={16}
                      aria-hidden
                      data-icon="inline-start"
                    />
                    Tentar novamente
                  </Button>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>
      {showMap && formattedAddress ? (
        <p className="text-xs/relaxed text-muted-foreground">
          {formattedAddress}
        </p>
      ) : null}
    </div>
  )
}
