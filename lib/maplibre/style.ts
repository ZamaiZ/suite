/**
 * Estilo do mapa, por tema.
 *
 * O LocationIQ publica estilos prontos em claro e escuro — medido em
 * 2026-09-15: `light` e `dark` existem em `vector` e em `raster`, e os dois
 * responderam 200.
 *
 * **A chave é outra.** São dois tokens no painel, e o que serve tile é o de
 * permissão `Vector Map Tiles` / `Raster Map Tiles`, restrito por referrer.
 * Usar o de geocoding aqui devolve 401 no tile e nada no console — por isso o
 * nome da variável carrega o `MAPS`, para o erro ser óbvio na leitura.
 */

export const MAP_STYLE_UNCONFIGURED =
  "Mapa não configurado. Defina NEXT_PUBLIC_LOCATIONIQ_MAPS_KEY."

export type MapTheme = "light" | "dark"

export function getMapTilesKey(): string | null {
  const key = process.env.NEXT_PUBLIC_LOCATIONIQ_MAPS_KEY
  return typeof key === "string" && key.trim().length > 0 ? key.trim() : null
}

export function mapStyleUrl(theme: MapTheme): string | null {
  const key = getMapTilesKey()
  if (!key) return null
  return `https://tiles.locationiq.com/v3/${theme}/vector.json?key=${encodeURIComponent(key)}`
}
