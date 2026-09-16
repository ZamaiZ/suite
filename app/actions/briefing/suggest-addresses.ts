"use server"

import { requireBriefingWriter } from "@/lib/briefing/writer"
import { autocompleteAddresses } from "@/lib/locationiq/client"
import {
  LOCATIONIQ_SUGGEST_MIN_CHARS,
  type BriefingAddressCandidate,
} from "@/lib/locationiq/address"
import { z } from "zod"

/**
 * Uma chamada, não duas.
 *
 * O Places exigia autocomplete e depois detalhes, porque a sugestão vinha só
 * com texto. O autocomplete do LocationIQ já devolve endereço estruturado e
 * coordenada no mesmo resultado — então o `applyBriefingPlace`, que era a
 * segunda chamada, deixou de ter o que buscar e foi removido.
 *
 * **O horário saiu junto.** O Places devolvia `weekdayDescriptions` e o
 * LocationIQ não tem o campo. Com perfil do Google vinculado ao lead o horário
 * continua vindo do snapshot, que é a fonte melhor; sem perfil, o campo fica
 * para o cliente preencher, e a tela para de prometer preenchimento automático.
 */
export type SuggestBriefingAddressesState =
  | { status: "success"; candidates: BriefingAddressCandidate[] }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

const suggestSchema = z.object({
  query: z.string().trim().min(LOCATIONIQ_SUGGEST_MIN_CHARS).max(200),
})

export async function suggestBriefingAddresses(input: {
  query: string
  clientId?: string
}): Promise<SuggestBriefingAddressesState> {
  const loaded = await requireBriefingWriter(input.clientId)
  if (loaded.status !== "ok") return loaded

  const parsed = suggestSchema.safeParse({ query: input.query })
  if (!parsed.success) {
    return {
      status: "error",
      message: `Digite pelo menos ${LOCATIONIQ_SUGGEST_MIN_CHARS} caracteres.`,
    }
  }

  const result = await autocompleteAddresses(parsed.data.query)
  if (result.status === "error") {
    return { status: "error", message: result.message }
  }
  return { status: "success", candidates: result.data }
}
