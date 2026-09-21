"use server"

/**
 * Coleta de SERP da Fase 3 — o passo pago em escala.
 *
 * Toda a decisão mora em `lib/research/serp-queue.ts`, que é puro e testado.
 * Aqui há só transporte e persistência, e a ordem das escritas, que é o que
 * mais importa.
 *
 * **A ordem existe por causa do incidente da malha**, em que 121 tarefas foram
 * criadas, pagas, e os identificadores descartados — cada passada seguinte do
 * poll recomprava a grade inteira, cobrando cerca de treze vezes o mesmo
 * trabalho. Daí a regra que rege `enqueue`: o `task_id` é gravado **antes** de
 * qualquer outra escrita, e nada mais acontece se essa gravação falhar.
 */

import { z } from "zod"
import { requireCommercialMember } from "@/lib/auth/session"
import {
  getDataForSeoTask,
  postDataForSeoTasks,
} from "@/lib/dataforseo/client"
import {
  SERP_ORGANIC_TASK_GET_PATH,
  SERP_ORGANIC_TASK_POST_PATH,
  mapSerpOrganic,
  serpOrganicTask,
} from "@/lib/dataforseo/serp-organic"
import {
  correlateCreatedTasks,
  selectForPoll,
  selectForPost,
  serpQueueProgress,
  serpTaskTag,
  type SerpQueueRow,
} from "@/lib/research/serp-queue"
import { createClient } from "@/lib/supabase/server"

const TABELA = "client_research_serp_tasks"

const enqueueSchema = z.object({
  clientId: z.string().uuid(),
  runId: z.string().uuid(),
  items: z
    .array(
      z.object({
        keyword: z.string().trim().min(1),
        locationCode: z.number().int().positive(),
        languageCode: z.string().trim().min(2).default("pt"),
      }),
    )
    .min(1),
})

export type ResearchSerpState =
  | { status: "success"; progress: ReturnType<typeof serpQueueProgress> }
  | { status: "error"; message: string }

/**
 * Cria as linhas da execução, em `pending`. Não gasta nada.
 *
 * O índice único por `(run_id, lower(keyword))` é quem garante que uma keyword
 * não entre duas vezes; o `upsert` com `ignoreDuplicates` deixa a chamada ser
 * repetida sem criar SERP paga em duplicata.
 */
export async function createResearchSerpRun(
  input: unknown,
): Promise<ResearchSerpState> {
  const parsed = enqueueSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: "Dados da coleta inválidos." }
  }

  await requireCommercialMember()

  const supabase = await createClient()
  const { clientId, runId, items } = parsed.data

  const { error } = await supabase.from(TABELA).upsert(
    items.map((item) => ({
      client_id: clientId,
      run_id: runId,
      keyword: item.keyword,
      location_code: item.locationCode,
      language_code: item.languageCode,
      status: "pending" as const,
    })),
    { onConflict: "run_id,keyword", ignoreDuplicates: true },
  )

  if (error) {
    return { status: "error", message: "Não foi possível preparar a coleta." }
  }

  return progressoDaExecucao(supabase, runId)
}

/**
 * Enfileira o que ainda não tem tarefa.
 *
 * **Gasta.** Uma chamada de `task_post` por lote de até 100 keywords.
 */
export async function postResearchSerpTasks(
  runId: string,
): Promise<ResearchSerpState> {
  await requireCommercialMember()

  const supabase = await createClient()
  const linhas = await lerLinhas(supabase, runId)
  if (!linhas) return { status: "error", message: "Coleta não encontrada." }

  const aEnviar = selectForPost(linhas)
  if (aEnviar.length === 0) return progressoDaExecucao(supabase, runId)

  const tarefas = aEnviar.map((linha) =>
    serpOrganicTask({
      keyword: linha.keyword,
      locationCode: linha.locationCode,
      languageCode: linha.languageCode,
      tag: serpTaskTag(runId, linha.id),
    }),
  )

  const resposta = await postDataForSeoTasks(
    SERP_ORGANIC_TASK_POST_PATH,
    tarefas,
  )
  if (resposta.status === "error") {
    return { status: "error", message: resposta.message }
  }

  const correlacao = correlateCreatedTasks(
    runId,
    aEnviar.map((l) => l.id),
    resposta.created,
  )

  // A PRIMEIRA escrita é o identificador. Se o processo morrer logo depois, a
  // tarefa paga continua recuperável; na ordem inversa, ela vira órfã e o
  // próximo poll compra tudo de novo.
  for (const [rowId, taskId] of Object.entries(correlacao.taskIds)) {
    const { error } = await supabase
      .from(TABELA)
      .update({
        task_id: taskId,
        status: "queued",
        attempts: (linhas.find((l) => l.id === rowId)?.attempts ?? 0) + 1,
        polling_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rowId)

    if (error) {
      // Não seguir adiante: perder o registro de uma tarefa já paga é
      // exatamente o defeito que esta ordem existe para impedir.
      return {
        status: "error",
        message:
          "A coleta foi enfileirada mas não pôde ser registrada. Não repita agora — as tarefas já foram cobradas.",
      }
    }
  }

  // Quem não correlacionou volta a `pending` com a tentativa contada, para o
  // teto valer. Some em silêncio é o que não pode acontecer.
  for (const rowId of correlacao.unmapped) {
    const atual = linhas.find((l) => l.id === rowId)
    await supabase
      .from(TABELA)
      .update({
        attempts: (atual?.attempts ?? 0) + 1,
        error_message: "Tarefa criada sem identificador utilizável.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", rowId)
  }

  return progressoDaExecucao(supabase, runId)
}

/**
 * Coleta o que já está pronto. O `task_get` é gratuito.
 *
 * O lease é um `UPDATE ... WHERE` atômico: dois polls simultâneos, só um passa.
 * Comparar o status contra ele mesmo não trava nada — foi assim que a malha
 * enfileirou em dobro e perdeu escrita.
 */
export async function pollResearchSerpTasks(
  runId: string,
): Promise<ResearchSerpState> {
  await requireCommercialMember()

  const supabase = await createClient()
  const linhas = await lerLinhas(supabase, runId)
  if (!linhas) return { status: "error", message: "Coleta não encontrada." }

  const agora = Date.now()
  const candidatas = selectForPoll(linhas, agora)

  for (const linha of candidatas) {
    const marca = new Date(agora).toISOString()
    const limite = new Date(agora - 120_000).toISOString()

    const { data: travada } = await supabase
      .from(TABELA)
      .update({ polling_at: marca })
      .eq("id", linha.id)
      .eq("status", "queued")
      .or(`polling_at.is.null,polling_at.lt.${limite}`)
      .select("id")
      .maybeSingle()

    // Outro poll pegou esta linha primeiro.
    if (!travada) continue

    const resultado = await getDataForSeoTask<unknown>(
      SERP_ORGANIC_TASK_GET_PATH,
      linha.taskId as string,
    )

    if (resultado.status === "pending") {
      await supabase
        .from(TABELA)
        .update({ polling_at: null })
        .eq("id", linha.id)
      continue
    }

    if (resultado.status === "error") {
      await supabase
        .from(TABELA)
        .update({
          status: "failed",
          polling_at: null,
          error_message: resultado.message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", linha.id)
      continue
    }

    // `data` nulo aqui é tarefa concluída sem resultado — `done`, não `failed`.
    // São coisas diferentes, e confundi-las faria o clustering tratar a
    // keyword como órfã.
    const snapshot = resultado.data
      ? mapSerpOrganic({ tasks: [{ status_code: 20000, result: [resultado.data] }] })
      : null

    await supabase
      .from(TABELA)
      .update({
        status: "done",
        snapshot,
        cost_usd: resultado.cost ?? null,
        polling_at: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", linha.id)
  }

  return progressoDaExecucao(supabase, runId)
}

/* -------------------------------------------------------------------------- */

type LinhaBanco = SerpQueueRow & {
  locationCode: number
  languageCode: string
}

async function lerLinhas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  runId: string,
): Promise<LinhaBanco[] | null> {
  const { data, error } = await supabase
    .from(TABELA)
    .select("id, keyword, status, task_id, attempts, polling_at, location_code, language_code")
    .eq("run_id", runId)

  if (error || !data) return null

  return data.map((row) => ({
    id: row.id as string,
    keyword: row.keyword as string,
    status: row.status as SerpQueueRow["status"],
    taskId: (row.task_id as string | null) ?? null,
    attempts: (row.attempts as number) ?? 0,
    pollingAt: (row.polling_at as string | null) ?? null,
    locationCode: row.location_code as number,
    languageCode: (row.language_code as string) ?? "pt",
  }))
}

async function progressoDaExecucao(
  supabase: Awaited<ReturnType<typeof createClient>>,
  runId: string,
): Promise<ResearchSerpState> {
  const linhas = await lerLinhas(supabase, runId)
  if (!linhas) return { status: "error", message: "Coleta não encontrada." }
  return { status: "success", progress: serpQueueProgress(linhas) }
}

