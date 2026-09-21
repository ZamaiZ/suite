"use server"

/**
 * Lê a pesquisa mais recente de um cliente, para a tela. Não gasta nada.
 *
 * Devolve também o fingerprint **corrente** do briefing, porque é a comparação
 * entre ele e o da pesquisa que revela defasagem — o briefing é editável por
 * definição, e uma pesquisa feita sobre a versão anterior continua no banco
 * parecendo atual.
 */

import { z } from "zod"
import { denyUnlessCanView, loadStaffClient } from "@/lib/clients/staff"
import type { ClientResearchSnapshot } from "@/lib/research/types"
import { createAdminClient } from "@/lib/supabase/admin"

const schema = z.object({ clientId: z.string().uuid() })

export type ClientResearchView = {
  snapshot: ClientResearchSnapshot | null
  /** Quando a pesquisa foi coletada. `null` quando nunca houve uma. */
  fetchedAt: string | null
  /** Fingerprint corrente do briefing. `null` quando não há export. */
  currentFingerprint: string | null
  /** Domínio do cliente, para separar o próprio site dos concorrentes. */
  selfDomain: string | null
}

export type LoadClientResearchState =
  | { status: "success"; view: ClientResearchView }
  | { status: "error"; message: string }

export async function loadClientResearch(
  input: unknown,
): Promise<LoadClientResearchState> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { status: "error", message: "Cliente inválido." }

  const { clientId } = parsed.data

  const loaded = await loadStaffClient(clientId)
  if (loaded.status === "error") return loaded
  const denied = denyUnlessCanView(loaded.context)
  if (denied) return denied

  // `client_briefing_steps` e `client_briefing_exports` têm RLS que o staff
  // autenticado não atravessa — com a sessão, a consulta volta vazia **sem
  // erro**. Autorização acima, leitura com admin, como em
  // `load-staff-briefing-overview.ts`.
  const supabase = createAdminClient()

  const [pesquisa, exportado, empresa] = await Promise.all([
    // Append-only: a mais recente é por `fetched_at`, nunca pela ordem natural
    // da consulta.
    supabase
      .from("client_research_audits")
      .select("snapshot, fetched_at")
      .eq("client_id", clientId)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("client_briefing_exports")
      .select("content_fingerprint")
      .eq("client_id", clientId)
      .eq("is_current", true)
      .maybeSingle(),
    supabase
      .from("client_briefing_steps")
      .select("payload")
      .eq("client_id", clientId)
      .eq("step", "company")
      .maybeSingle(),
  ])

  if (pesquisa.error) {
    return { status: "error", message: "Não foi possível ler a pesquisa." }
  }

  return {
    status: "success",
    view: {
      snapshot:
        (pesquisa.data?.snapshot as ClientResearchSnapshot | undefined) ?? null,
      fetchedAt: (pesquisa.data?.fetched_at as string | undefined) ?? null,
      currentFingerprint:
        (exportado.data?.content_fingerprint as string | undefined) ?? null,
      selfDomain: readWebsiteDomain(empresa.data?.payload),
    },
  }
}

/**
 * Domínio do canal `website` do briefing.
 *
 * Sem ele o painel não consegue distinguir o próprio site dos concorrentes — e
 * foi exatamente assim que `leotintas.com.br` apareceu na lista de
 * concorrentes de si mesmo na sondagem.
 */
function readWebsiteDomain(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null
  }
  const canais = (payload as Record<string, unknown>).channels
  if (!Array.isArray(canais)) return null

  for (const bruto of canais) {
    if (!bruto || typeof bruto !== "object") continue
    const canal = bruto as Record<string, unknown>
    if (canal.type !== "website") continue
    const valor = typeof canal.value === "string" ? canal.value.trim() : ""
    if (!valor) continue
    try {
      const url = valor.startsWith("http") ? valor : `https://${valor}`
      return new URL(url).hostname.replace(/^www\./, "")
    } catch {
      return valor.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
    }
  }

  return null
}
