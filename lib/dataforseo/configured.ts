import "server-only"

/**
 * Única fonte de verdade sobre a credencial estar presente.
 *
 * Vivia em `lib/gbp-vendor/resolve.ts`, junto da escolha entre dois providers.
 * Com o DataForSEO como provider único, não há mais o que resolver — sobra só
 * a checagem de credencial.
 */
export function isDataForSeoConfigured(): boolean {
  return Boolean(
    process.env.DATAFORSEO_LOGIN?.trim() &&
    process.env.DATAFORSEO_PASSWORD?.trim(),
  )
}

export const DATAFORSEO_NOT_CONFIGURED =
  "DataForSEO não configurado. Defina DATAFORSEO_LOGIN e DATAFORSEO_PASSWORD."
