"use server"

import { digitsOnly } from "@/lib/br-documents"
import { isBrazilStateCode } from "@/lib/br-locations"
import { requirePortalClient } from "@/lib/clients/portal-session"

export type LookupPostalCodeState =
  | {
      status: "success"
      street: string
      neighborhood: string
      city: string
      stateCode: string
      postalCode: string
    }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

type ViaCepResponse = {
  erro?: boolean
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  cep?: string
}

export async function lookupBriefingPostalCode(
  postalCode: string,
): Promise<LookupPostalCodeState> {
  const loaded = await requirePortalClient()
  if (loaded.status === "unauthenticated") return loaded

  const digits = digitsOnly(postalCode)
  if (digits.length !== 8) {
    return { status: "error", message: "CEP inválido." }
  }

  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
    cache: "no-store",
  })

  if (!response.ok) {
    return {
      status: "error",
      message: "Não foi possível consultar o CEP. Tente novamente.",
    }
  }

  const body = (await response.json()) as ViaCepResponse
  if (body.erro) {
    return { status: "error", message: "CEP não encontrado." }
  }

  const stateCode = typeof body.uf === "string" ? body.uf.toUpperCase() : ""
  if (stateCode && !isBrazilStateCode(stateCode)) {
    return { status: "error", message: "CEP não encontrado." }
  }

  return {
    status: "success",
    street: typeof body.logradouro === "string" ? body.logradouro : "",
    neighborhood: typeof body.bairro === "string" ? body.bairro : "",
    city: typeof body.localidade === "string" ? body.localidade : "",
    stateCode,
    postalCode: digits,
  }
}
