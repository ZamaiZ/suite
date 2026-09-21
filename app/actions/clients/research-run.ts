"use server"

/**
 * Orquestração da pesquisa: briefing → expansão → pool → filtro → fila.
 *
 * São **dois passos com confirmação separada**, e não um botão só, porque os
 * dois gastam em ordens diferentes. `planResearch` é gratuito e diz se o
 * briefing está em condição de rodar; `startResearch` paga a expansão e devolve
 * quantas SERPs o filtro autorizou — que é o número que domina o preço da fase
 * e que a tela mostra antes de a coleta começar.
 *
 * Nada aqui decide: as regras moram em `lib/research/*`, puras e testadas.
 */

import { z } from "zod"
import { BR_STATES } from "@/lib/br-locations"
import { denyUnlessCanView, loadStaffClient } from "@/lib/clients/staff"
import {
  BRAZIL_LOCATION_CODE,
  expandLocalKeywords,
  expandNationalKeywords,
  fetchBrazilLocations,
} from "@/lib/dataforseo/research-collect"
import { KEYWORDS_FOR_KEYWORDS_MAX_SEEDS } from "@/lib/dataforseo/keyword-expansion"
import {
  buildResearchInput,
  type Refusal,
  type Warning,
} from "@/lib/research/briefing-input"
import { buildCandidatePool } from "@/lib/research/candidate-pool"
import {
  DEFAULT_SERP_LIMIT,
  filterCandidates,
  serpCallCount,
} from "@/lib/research/candidate-filter"
import { resolveCities, type ResolvedCity } from "@/lib/research/location-match"
import { createAdminClient } from "@/lib/supabase/admin"

const LANGUAGE = "pt"

const planSchema = z.object({ clientId: z.string().uuid() })
const startSchema = z.object({
  clientId: z.string().uuid(),
  runId: z.string().uuid(),
  serpLimit: z.number().int().positive().max(1000).optional(),
})

export type ResearchPlan = {
  primaryKeyword: string
  /**
   * As palavras do briefing, e não só a contagem: é sobre elas que o veredito
   * da Task 11 é emitido, e sem a lista a compilação devolveria zero
   * julgamentos — depois de a coleta já ter sido paga.
   */
  seeds: string[]
  seedCount: number
  cities: { name: string; stateCode: string; isPrimary: boolean; locationCode: number | null; granularity: "city" | "state" | null }[]
  neighborhoodCount: number
  briefingFingerprint: string
  /** Chamadas de expansão que `startResearch` vai fazer. */
  expansionCalls: number
  warnings: Warning[]
}

export type PlanResearchState =
  | { status: "success"; plan: ResearchPlan }
  | { status: "refused"; refusals: Refusal[] }
  | { status: "error"; message: string }

/**
 * Lê o briefing, valida e resolve as localidades. **Não gasta** — o endpoint de
 * localidades é gratuito.
 */
export async function planResearch(
  input: unknown,
): Promise<PlanResearchState> {
  const parsed = planSchema.safeParse(input)
  if (!parsed.success) return { status: "error", message: "Cliente inválido." }

  const loaded = await loadStaffClient(parsed.data.clientId)
  if (loaded.status === "error") return loaded
  const denied = denyUnlessCanView(loaded.context)
  if (denied) return denied

  const briefing = await lerBriefing(parsed.data.clientId)
  if (!briefing) {
    return {
      status: "error",
      message: "O briefing deste cliente ainda não foi preenchido.",
    }
  }

  const entrada = buildResearchInput({
    audience: briefing.audience,
    company: briefing.company,
    briefingFingerprint: briefing.fingerprint,
  })
  if (entrada.status === "refused") {
    return { status: "refused", refusals: entrada.refusals }
  }

  const localidades = await fetchBrazilLocations()
  if (localidades.status === "error") {
    return { status: "error", message: localidades.message }
  }

  const resolvidas = resolveCities({
    cities: entrada.input.cities.map((c) => ({
      name: c.name,
      stateCode: c.stateCode,
      stateName: nomeDoEstado(c.stateCode),
    })),
    locations: localidades.data,
    fallbackToState: true,
  })

  const porNome = new Map<string, ResolvedCity>()
  for (const r of resolvidas) porNome.set(r.city, r)

  return {
    status: "success",
    plan: {
      primaryKeyword: entrada.input.primaryKeyword,
      seeds: entrada.input.seeds,
      seedCount: entrada.input.seeds.length,
      cities: entrada.input.cities.map((c) => {
        const match = porNome.get(c.name)?.match ?? null
        return {
          name: c.name,
          stateCode: c.stateCode,
          isPrimary: c.isPrimary,
          locationCode: match?.locationCode ?? null,
          granularity: match?.granularity ?? null,
        }
      }),
      neighborhoodCount: entrada.input.neighborhoods.length,
      briefingFingerprint: entrada.input.briefingFingerprint,
      // Lotes de 20 no endpoint local, mais uma chamada nacional.
      expansionCalls:
        Math.ceil(entrada.input.seeds.length / KEYWORDS_FOR_KEYWORDS_MAX_SEEDS) + 1,
      warnings: entrada.warnings,
    },
  }
}

export type ResearchStartSummary = {
  runId: string
  candidatesFound: number
  discovered: number
  serpCalls: number
  expansionCostUsd: number
  failures: string[]
  unconfirmedSeeds: string[]
}

export type StartResearchState =
  | { status: "success"; summary: ResearchStartSummary }
  | { status: "refused"; refusals: Refusal[] }
  | { status: "error"; message: string }

/**
 * Expande, monta o pool, filtra e cria a fila de SERP.
 *
 * **Gasta a expansão** (ordem de US$ 0,30) e **não gasta a SERP**: as linhas
 * nascem em `pending`, e a coleta só começa quando alguém chamar
 * `postResearchSerpTasks`. A separação existe para o número de SERPs poder ser
 * visto e confirmado antes de virar dinheiro.
 */
export async function startResearch(
  input: unknown,
): Promise<StartResearchState> {
  const parsed = startSchema.safeParse(input)
  if (!parsed.success) return { status: "error", message: "Dados inválidos." }

  const { clientId, runId } = parsed.data

  const loaded = await loadStaffClient(clientId)
  if (loaded.status === "error") return loaded
  const denied = denyUnlessCanView(loaded.context)
  if (denied) return denied

  const supabase = loaded.context.supabase
  const briefing = await lerBriefing(clientId)
  if (!briefing) {
    return { status: "error", message: "Briefing não encontrado." }
  }

  const entrada = buildResearchInput({
    audience: briefing.audience,
    company: briefing.company,
    briefingFingerprint: briefing.fingerprint,
  })
  if (entrada.status === "refused") {
    return { status: "refused", refusals: entrada.refusals }
  }

  const localidades = await fetchBrazilLocations()
  if (localidades.status === "error") {
    return { status: "error", message: localidades.message }
  }

  const resolvidas = resolveCities({
    cities: entrada.input.cities.map((c) => ({
      name: c.name,
      stateCode: c.stateCode,
      stateName: nomeDoEstado(c.stateCode),
    })),
    locations: localidades.data,
    fallbackToState: true,
  })

  const principal = entrada.input.cities.find((c) => c.isPrimary)
  const codigoPrincipal =
    resolvidas.find((r) => r.city === principal?.name)?.match?.locationCode ??
    BRAZIL_LOCATION_CODE

  // A expansão local roda na cidade principal; a nacional só aceita país.
  const local = await expandLocalKeywords({
    seeds: entrada.input.seeds,
    locationCode: codigoPrincipal,
    languageCode: LANGUAGE,
  })
  const nacional = await expandNationalKeywords({
    seeds: entrada.input.seeds,
    languageCode: LANGUAGE,
  })

  const pool = buildCandidatePool({
    seeds: entrada.input.seeds,
    local: local.keywords,
    national: nacional.keywords,
  })

  const filtrado = filterCandidates({
    candidates: pool.candidates,
    seeds: entrada.input.seeds,
    limit: parsed.data.serpLimit ?? DEFAULT_SERP_LIMIT,
  })

  const linhas = filtrado.selected.map((c) => ({
    client_id: clientId,
    run_id: runId,
    keyword: c.keyword,
    location_code: codigoPrincipal,
    language_code: LANGUAGE,
    status: "pending" as const,
  }))

  if (linhas.length > 0) {
    const { error } = await supabase
      .from("client_research_serp_tasks")
      .upsert(linhas, { onConflict: "run_id,keyword", ignoreDuplicates: true })

    if (error) {
      // A mensagem do Postgres sobe junto. Sem ela, um alvo de conflito que
      // não casa com nenhum índice (`42P10`) vira "não pôde ser criada" — e o
      // defeito só é encontrado reproduzindo a consulta fora do app.
      return {
        status: "error",
        message: `A expansão foi cobrada mas a fila não pôde ser criada: ${error.message}${error.code ? ` (${error.code})` : ""}. Reveja antes de repetir.`,
      }
    }
  }

  return {
    status: "success",
    summary: {
      runId,
      candidatesFound: pool.stats.total,
      discovered: pool.stats.discovered,
      serpCalls: serpCallCount(filtrado),
      expansionCostUsd: local.costUsd + nacional.costUsd,
      failures: [...local.failures, ...nacional.failures],
      unconfirmedSeeds: pool.stats.unconfirmedSeeds,
    },
  }
}

/* -------------------------------------------------------------------------- */

function nomeDoEstado(code: string): string {
  return BR_STATES.find((s) => s.code === code)?.name ?? code
}

type BriefingLido = {
  audience: unknown
  company: unknown
  fingerprint: string
}

/**
 * Lê os dois passos que a pesquisa usa, mais o fingerprint da versão corrente.
 *
 * **Com `admin`, e não com a sessão.** `client_briefing_steps` é preenchido
 * pelo portal do cliente e tem RLS que o staff autenticado não atravessa: a
 * consulta com a sessão devolve zero linhas **sem erro**, e a tela conclui que
 * o briefing não foi preenchido. O padrão é o de
 * `load-staff-briefing-overview.ts` — autorizar por `loadStaffClient` e
 * `denyUnlessCanView`, e só então ler com admin.
 *
 * Sem o fingerprint não há como saber, depois, que o briefing mudou e a
 * pesquisa ficou defasada — e o briefing é editável por definição.
 */
async function lerBriefing(clientId: string): Promise<BriefingLido | null> {
  const supabase = createAdminClient()
  const [passos, exportado] = await Promise.all([
    supabase
      .from("client_briefing_steps")
      .select("step, payload")
      .eq("client_id", clientId)
      .in("step", ["audience", "company"]),
    supabase
      .from("client_briefing_exports")
      .select("content_fingerprint")
      .eq("client_id", clientId)
      .eq("is_current", true)
      .maybeSingle(),
  ])

  if (passos.error || !passos.data || passos.data.length === 0) return null

  const porPasso = new Map<string, unknown>()
  for (const linha of passos.data) {
    porPasso.set(linha.step as string, linha.payload)
  }

  return {
    audience: porPasso.get("audience") ?? null,
    company: porPasso.get("company") ?? null,
    fingerprint:
      (exportado.data?.content_fingerprint as string | undefined) ?? "",
  }
}
