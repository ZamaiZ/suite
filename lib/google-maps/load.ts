import { importLibrary, setOptions } from "@googlemaps/js-api-loader"

let configured = false

export function getGoogleMapsBrowserKey(): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  return typeof key === "string" && key.trim().length > 0 ? key.trim() : null
}

export type LoadGoogleMapsResult =
  | { status: "ok"; maps: google.maps.MapsLibrary }
  | { status: "error"; message: string }

export async function loadGoogleMaps(): Promise<LoadGoogleMapsResult> {
  const key = getGoogleMapsBrowserKey()
  if (!key) {
    return {
      status: "error",
      message: "Mapa não configurado. Defina NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.",
    }
  }

  try {
    if (!configured) {
      setOptions({
        key,
        language: "pt-BR",
        region: "BR",
        v: "weekly",
      })
      configured = true
    }

    const maps = await importLibrary("maps")
    return { status: "ok", maps }
  } catch {
    return {
      status: "error",
      message: "Não foi possível carregar o Google Maps.",
    }
  }
}
