"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { fetchLlmResponseLive } from "@/lib/dataforseo/ai-optimization"
import {
  GEO_PROMPT_MODELS,
  GEO_PROMPT_PLATFORMS,
} from "@/lib/dataforseo/limits"
import {
  readLeadGeoAuditRow,
  type GeoPromptRun,
  type GeoSnapshot,
  type LeadGeoAudit,
} from "@/lib/leads/geo-audit"
import {
  buildGeoPromptRun,
  buildGeoPromptVisibility,
} from "@/lib/leads/geo-prompt-visibility"
import { brandVariants, deriveGeoPromptSet } from "@/lib/leads/geo-prompts"
import {
  readLeadGeoReviewRow,
  type GeoPromptSet,
  type LeadGeoReview,
} from "@/lib/leads/geo-review"
import { analyzeGeoSchema, readAnalyzeGeoFields } from "@/lib/validations/lead-geo"
import {
  denyGeoEdit,
  GEO_REVIEW_SELECT,
  GEO_SELECT,
  loadGeoAuditByLead,
} from "./geo-access"

export type ProbeGeoPromptsState =
  | { status: "success"; audit: LeadGeoAudit; review: LeadGeoReview }
  | { status: "error"; message: string }

const FAILED = "Não foi possível sondar as IAs. Tente novamente."
const NO_BASE =
  "Rode a análise de Presença em IA antes: a sondagem entra no snapshot dela."

/** O país da sondagem. `GEO_QUERY` usa o nome; aqui a API quer o ISO. */
const COUNTRY_ISO = "BR"

const PLATFORM_LABELS: Record<string, string> = {
  chat_gpt: "O ChatGPT",
  claude: "O Claude",
  gemini: "O Gemini",
  perplexity: "A Perplexity",
}

/**
 * A sondagem em LLM — a coleta mais cara da etapa, ≈ US$ 0,65.
 *
 * Pergunta a ChatGPT, Claude, Gemini e Perplexity o que o mercado do lead
 * pergunta, e mede se a marca aparece. **A LLM é objeto de medição, nunca
 * instrumento de análise:** nada aqui pede opinião a um modelo sobre o lead.
 *
 * **O conjunto de prompts é fixado na primeira sondagem** e reusado depois.
 * Prompt que muda entre coletas transforma taxa de menção em número sem
 * significado.
 *
 * **Execução que falhou não é execução que mediu ausência.** `50301` (o
 * provedor fora do ar) e `40501` (campo recusado) chegam com `cost: 0`, e
 * gravá-los como `mentioned: false` inventaria ausência de graça — sem nada no
 * custo para denunciar.
 */
export async function probeLeadGeoPrompts(
  formData: FormData,
): Promise<ProbeGeoPromptsState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = analyzeGeoSchema.safeParse(readAnalyzeGeoFields(formData))
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? FAILED,
    }
  }

  const supabase = await createClient()
  const loaded = await loadGeoAuditByLead(supabase, parsed.data.lead_id)
  if (loaded.status === "error") return { status: "error", message: FAILED }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Lead não encontrado." }
  }

  const denied = denyGeoEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  const base = loaded.audit
  if (!base) return { status: "error", message: NO_BASE }

  const { data: reviewRow } = await supabase
    .from("lead_geo_reviews")
    .select(GEO_REVIEW_SELECT)
    .eq("lead_id", parsed.data.lead_id)
    .maybeSingle()

  const storedReview = readLeadGeoReviewRow(
    (reviewRow as Record<string, unknown>) ?? null,
  )

  const collectedAt = new Date().toISOString()
  // Fixado uma vez. Se já existe, é reusado sem discussão — é isso que mantém
  // a série temporal comparável.
  const promptSet: GeoPromptSet =
    storedReview.promptSet ??
    deriveGeoPromptSet({
      company: loaded.lead.company_name,
      segment: loaded.lead.segment?.name ?? null,
      city: loaded.lead.city,
      fixedAt: collectedAt,
    })

  if (promptSet.items.length === 0) {
    return { status: "error", message: FAILED }
  }

  const leadBrands = brandVariants(loaded.lead.company_name)

  // Concorrentes vêm das checagens de posição no Maps — a única lista já paga
  // que tem **nome** de empresa. A de backlinks tem domínio sem nome, e
  // derivar nome de domínio erra em casos comuns.
  //
  // **Marca fora desta lista fica não detectada, e a tela declara isso** — em
  // vez de afirmar dominância sobre um universo que ninguém mediu.
  const { data: rankRows } = await supabase
    .from("lead_gbp_rank_checks")
    .select("competitors")
    .eq("lead_id", parsed.data.lead_id)
    .order("checked_at", { ascending: false })
    .limit(20)

  const competitorBrands = [
    ...new Set(
      (rankRows ?? []).flatMap((row) => {
        const lista = (row as Record<string, unknown>).competitors
        if (!Array.isArray(lista)) return []
        return lista.flatMap((entry) => {
          if (!entry || typeof entry !== "object") return []
          const title = (entry as Record<string, unknown>).title
          return typeof title === "string" && title.trim().length >= 3
            ? [title.trim()]
            : []
        })
      }),
    ),
  ].slice(0, 30)

  const runs: GeoPromptRun[] = []
  let costUsd = 0

  // Sequencial: a API limita 30 execuções simultâneas por plataforma, e cada
  // resposta pode levar até 120s. Disparar tudo de uma vez trocaria uma espera
  // previsível por `50301` em massa.
  for (const prompt of promptSet.items) {
    for (const platform of GEO_PROMPT_PLATFORMS) {
      const response = await fetchLlmResponseLive({
        platform,
        prompt: prompt.text,
        countryIso: COUNTRY_ISO,
        city: loaded.lead.city,
      })

      const at = new Date().toISOString()
      const modelName = GEO_PROMPT_MODELS[platform]

      if (response.status === "ok") {
        costUsd += response.cost ?? 0
        runs.push(
          buildGeoPromptRun({
            promptId: prompt.id,
            provider: platform,
            status: "ok",
            statusMessage: null,
            modelName,
            at,
            result: response.result,
            leadBrands,
            competitorBrands,
            domain: base.domain,
            costUsd: response.cost ?? null,
          }),
        )
        continue
      }

      // A mensagem genérica da casa fala de "perfil" e não diz nada dentro
      // desta etapa. Quando o provedor não manda a dele, a nossa ao menos
      // nomeia a plataforma — que é o que o analista precisa para saber se o
      // buraco é de uma plataforma ou de uma pergunta.
      //
      // E ela diz **tente de novo** quando a recusa é do provedor: medido em
      // três sondagens do mesmo lead, as recusas caíram de 2 para 1 para 0 sem
      // nenhuma mudança no corpo.
      const generica = response.message.startsWith("Não foi possível")
      const motivo = generica
        ? response.status === "provider_unavailable"
          ? `${PLATFORM_LABELS[platform]} não respondeu desta vez. Sondar de novo costuma resolver.`
          : `${PLATFORM_LABELS[platform]} recusou este prompt.`
        : response.message

      runs.push(
        buildGeoPromptRun({
          promptId: prompt.id,
          provider: platform,
          status:
            response.status === "provider_unavailable"
              ? "provider_unavailable"
              : "rejected",
          statusMessage: motivo,
          modelName,
          at,
          result: null,
          leadBrands,
          competitorBrands,
          domain: base.domain,
          costUsd: null,
        }),
      )
    }
  }

  const promptVisibility = buildGeoPromptVisibility({
    promptSetVersion: promptSet.version,
    runs,
    hasCompetitorBrands: competitorBrands.length > 0,
  })

  const snapshot: GeoSnapshot = {
    ...base.snapshot,
    collectedAt,
    costUsd: (base.snapshot.costUsd ?? 0) + costUsd,
    promptVisibility,
  }

  const { data, error } = await supabase
    .from("lead_geo_audits")
    .insert({
      lead_id: parsed.data.lead_id,
      domain: base.domain,
      snapshot,
      fetched_at: collectedAt,
      fetched_by: user.id,
    })
    .select(GEO_SELECT)
    .single()

  if (error || !data) return { status: "error", message: FAILED }
  const audit = readLeadGeoAuditRow(data as Record<string, unknown>)
  if (!audit) return { status: "error", message: FAILED }

  // O conjunto é gravado **depois** da sondagem, e só quando ainda não existia.
  // Gravar antes deixaria um conjunto fixado para uma sondagem que falhou.
  let review = storedReview
  if (!storedReview.promptSet) {
    const { data: saved } = await supabase
      .from("lead_geo_reviews")
      .upsert(
        {
          lead_id: parsed.data.lead_id,
          prompt_set: promptSet,
          updated_at: collectedAt,
          updated_by: user.id,
        },
        { onConflict: "lead_id" },
      )
      .select(GEO_REVIEW_SELECT)
      .maybeSingle()
    if (saved) {
      review = readLeadGeoReviewRow(saved as Record<string, unknown>)
    }
  }

  return { status: "success", audit, review }
}
