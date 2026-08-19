export const GBP_DATA_PROVIDERS = ["dataforseo", "serpapi"] as const

export type GbpDataProvider = (typeof GBP_DATA_PROVIDERS)[number]

export const GBP_DATA_PROVIDER_KEY = "gbp_data_provider"

export const GBP_VENDOR_UNCONFIGURED =
  "A análise do perfil não está configurada."
export const GBP_VENDOR_CHOOSE =
  "Escolha a fonte de dados em Ferramentas."
export const SERPAPI_QUOTA_EMPTY =
  "Não há consultas SerpAPI restantes neste mês."
export const SERPAPI_QUOTA_RANK =
  "Não há consultas SerpAPI suficientes para checar o ranking."

export type ResolveGbpDataProviderResult =
  | { status: "ok"; provider: GbpDataProvider }
  | { status: "error"; message: string }

export type SerpApiQuota = {
  planSearchesLeft: number
  searchesPerMonth: number
}

export function isGbpDataProvider(value: unknown): value is GbpDataProvider {
  return value === "dataforseo" || value === "serpapi"
}
