import "server-only"

import { getDataForSeo } from "./client"
import {
  DATAFORSEO_USAGE_ERROR,
  DATAFORSEO_USER_DATA_PATH,
  readDataForSeoUserData,
  type DataForSeoUserData,
} from "./usage"

/**
 * Só a busca. Tipos, leitores e cálculo de custo ficam em `usage.ts`, que é
 * puro — a página de Ferramentas é componente de cliente e não pode importar
 * nada que dependa de `server-only`.
 */
export type FetchDataForSeoUserDataResult =
  | { status: "ok"; data: DataForSeoUserData }
  | { status: "error"; message: string }

export async function fetchDataForSeoUserData(): Promise<FetchDataForSeoUserDataResult> {
  const fetched = await getDataForSeo<Record<string, unknown>>(
    DATAFORSEO_USER_DATA_PATH,
    DATAFORSEO_USAGE_ERROR,
  )
  if (fetched.status === "error") return fetched
  const data = readDataForSeoUserData(fetched.data)
  if (!data) return { status: "error", message: DATAFORSEO_USAGE_ERROR }
  return { status: "ok", data }
}
