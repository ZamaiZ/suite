"use client"

import { useEffect, useRef, useState } from "react"
import { RiLoader4Line, RiMapPinLine, RiRefreshLine } from "react-icons/ri"
import { Button } from "@/components/ui/button"
import { cn } from "cn"
import { SHADCN_PALETTE } from "@/lib/theme/shadcn-palette"
import { GOOGLE_MAPS_DARK_STYLES, loadGoogleMaps } from "@/lib/google-maps"
import type { BriefingServiceRadiusMapProps } from "./BriefingServiceRadiusMap.types"

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

function fitCircle(map: google.maps.Map, circle: google.maps.Circle) {
  const bounds = circle.getBounds()
  if (!bounds) return
  map.fitBounds(bounds, 28)
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
  const mapRef = useRef<google.maps.Map | null>(null)
  const circleRef = useRef<google.maps.Circle | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const radiusRef = useRef(radiusKm)
  const addressRef = useRef(formattedAddress)
  radiusRef.current = radiusKm
  addressRef.current = formattedAddress

  const [scriptError, setScriptError] = useState<string | null>(null)
  const [scriptReady, setScriptReady] = useState(false)

  const showMap =
    latitude !== null && longitude !== null && !loading && !scriptError

  useEffect(() => {
    if (!showMap || !containerRef.current || mapRef.current) return

    let cancelled = false

    void loadGoogleMaps().then((result) => {
      if (cancelled || !containerRef.current || mapRef.current) return

      if (result.status === "error") {
        setScriptError(result.message)
        setScriptReady(false)
        return
      }

      setScriptError(null)
      setScriptReady(true)

      const { Map } = result.maps
      const center = {
        lat: latitude as number,
        lng: longitude as number,
      }
      const accent = readPrimaryColor()

      const map = new Map(containerRef.current, {
        center,
        zoom: 12,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "cooperative",
        clickableIcons: false,
        styles: isDarkMode() ? GOOGLE_MAPS_DARK_STYLES : [],
      })

      const marker = new google.maps.Marker({
        map,
        position: center,
        title: addressRef.current || undefined,
      })

      const circle = new google.maps.Circle({
        map,
        center,
        radius: Math.max(radiusRef.current, 1) * 1000,
        strokeColor: accent,
        strokeOpacity: 1,
        strokeWeight: 2,
        fillColor: accent,
        fillOpacity: 0.16,
        clickable: false,
      })

      fitCircle(map, circle)

      mapRef.current = map
      markerRef.current = marker
      circleRef.current = circle
    })

    return () => {
      cancelled = true
      circleRef.current?.setMap(null)
      markerRef.current?.setMap(null)
      circleRef.current = null
      markerRef.current = null
      mapRef.current = null
      setScriptReady(false)
    }
  }, [latitude, longitude, showMap])

  useEffect(() => {
    if (
      latitude === null ||
      longitude === null ||
      !mapRef.current ||
      !circleRef.current ||
      !markerRef.current
    ) {
      return
    }

    const center = { lat: latitude, lng: longitude }
    markerRef.current.setPosition(center)
    markerRef.current.setTitle(formattedAddress || "")
    circleRef.current.setCenter(center)
    circleRef.current.setRadius(Math.max(radiusKm, 1) * 1000)
    fitCircle(mapRef.current, circleRef.current)
  }, [latitude, longitude, radiusKm, formattedAddress])

  useEffect(() => {
    if (!showMap || !scriptReady) return

    const observer = new MutationObserver(() => {
      if (!mapRef.current) return
      mapRef.current.setOptions({
        styles: isDarkMode() ? GOOGLE_MAPS_DARK_STYLES : [],
      })
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
                <RiLoader4Line
                  size={18}
                  aria-hidden
                  className="animate-spin text-primary"
                />
                Carregando mapa…
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex h-64 w-full flex-col items-center justify-center gap-3 px-4 text-center sm:h-80">
            {loading ? (
              <>
                <RiLoader4Line
                  size={22}
                  aria-hidden
                  className="animate-spin text-primary"
                />
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
