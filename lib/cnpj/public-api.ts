import "server-only"

import { digitsOnly, isValidCnpj } from "@/lib/br-documents"
import type { ProspectIdentity, ProspectPartner } from "@/lib/prospect/types"

import { parseCnpjPayload } from "./payload"

/**
 * Consulta de CNPJ na base pública da Receita Federal.
 *
 * Gratuita, sem chave e sem cadastro. Traz razão social, **capital social**,
 * porte, natureza jurídica, CNAEs, endereço, telefones, e-mail e o **QSA** —
 * exatamente o que a prospecção precisa e o que nenhuma ferramenta
 * internacional entrega no Brasil.
 *
 * É o mesmo raciocínio do ViaCEP em
 * `app/actions/briefing/lookup-postal-code.ts`: serviço público brasileiro,
 * sem credencial, usado para um dado que também é público.
 *
 * O teto declarado é de 100 consultas por minuto. O `mapPool` de quem chama
 * respeita isso; aqui não há retry, pelo mesmo motivo do cliente do
 * DataForSEO — repescagem é decisão da fila, que tem teto de tentativa e
 * sabe o que já foi feito.
 *
 * Forma do payload medida em 2026-09-21 contra dois CNPJs reais, não lida na
 * documentação. O parsing mora em `./payload.ts`, puro e testável.
 */

const BASE = "https://api.opencnpj.org"
const TIMEOUT_MS = 10_000

export const CNPJ_LOOKUP_ERROR = "Não foi possível consultar o CNPJ."

export type CnpjLookupResult =
  | { status: "ok"; identity: ProspectIdentity }
  /** O CNPJ é válido mas não existe na base. Ausência real, não falha. */
  | { status: "not_found" }
  | { status: "error"; message: string }

export async function lookupCnpj(value: string): Promise<CnpjLookupResult> {
  const cnpj = digitsOnly(value)
  if (!isValidCnpj(cnpj)) return { status: "not_found" }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${BASE}/${cnpj}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
    // 404 é "não existe", e não falha de rede. Confundir os dois faria a fila
    // retentar para sempre um CNPJ que nunca vai existir — e cada retentativa
    // ocupa a vaga de um que existiria.
    if (response.status === 404) return { status: "not_found" }
    if (!response.ok) return { status: "error", message: CNPJ_LOOKUP_ERROR }

    const body: unknown = await response.json()
    const identity = parseCnpjPayload(body)
    if (!identity) return { status: "not_found" }
    return { status: "ok", identity }
  } catch {
    return { status: "error", message: CNPJ_LOOKUP_ERROR }
  } finally {
    clearTimeout(timer)
  }
}

export type { ProspectIdentity, ProspectPartner }
