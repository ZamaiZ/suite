// DESCARTAVEL - diagnostico de `startResearch`.
//
// Reproduz o caminho da action ate ANTES das chamadas pagas, para achar onde
// ela desiste. Nao gasta nada: para logo depois do filtro.
//
// Uso: node docs/auditoria/evidencias/2026-09-18-fase3-pesquisa/diagnostico-start.mjs <clientId>

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createClient } from "@supabase/supabase-js"

import { buildResearchInput } from "../../../../lib/research/briefing-input.ts"

const ROOT = process.cwd()
const CLIENT_ID = process.argv[2] ?? "3decad22-09b2-42d8-ab30-53d62f71f81c"

const env = readFileSync(join(ROOT, ".env.local"), "utf8")
const ler = (chave) =>
  env.match(new RegExp(`^${chave}=(.*)$`, "m"))?.[1]?.trim() ?? ""

const url = ler("NEXT_PUBLIC_SUPABASE_URL")
const key = ler("SUPABASE_SERVICE_ROLE_KEY")
console.log("url:", url ? "presente" : "AUSENTE")
console.log("service role:", key ? `presente (${key.length} chars)` : "AUSENTE")
if (!url || !key) process.exit(1)

const db = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

console.log("\n=== 1. cliente existe? ===")
const cliente = await db
  .from("clients")
  .select("id, company_name, lead_id")
  .eq("id", CLIENT_ID)
  .maybeSingle()
console.log("erro:", cliente.error?.message ?? "(nenhum)")
console.log("achou:", cliente.data ? cliente.data.company_name : "NAO")

console.log("\n=== 2. passos do briefing (como lerBriefing faz) ===")
const passos = await db
  .from("client_briefing_steps")
  .select("step, payload")
  .eq("client_id", CLIENT_ID)
  .in("step", ["audience", "company"])
console.log("erro:", passos.error?.message ?? "(nenhum)")
console.log("linhas:", passos.data?.length ?? 0)
for (const p of passos.data ?? []) console.log("  -", p.step)

console.log("\n=== 3. fingerprint corrente ===")
const exp = await db
  .from("client_briefing_exports")
  .select("content_fingerprint")
  .eq("client_id", CLIENT_ID)
  .eq("is_current", true)
  .maybeSingle()
console.log("erro:", exp.error?.message ?? "(nenhum)")
console.log("fingerprint:", exp.data?.content_fingerprint ?? "AUSENTE")

const porPasso = new Map()
for (const linha of passos.data ?? []) porPasso.set(linha.step, linha.payload)

console.log("\n=== 4. buildResearchInput ===")
const entrada = buildResearchInput({
  audience: porPasso.get("audience") ?? null,
  company: porPasso.get("company") ?? null,
  briefingFingerprint: exp.data?.content_fingerprint ?? "",
})
console.log("status:", entrada.status)
if (entrada.status === "refused") {
  for (const r of entrada.refusals) {
    console.log(`  RECUSA [${r.code}] ${r.message}`, r.values ?? "")
  }
} else {
  console.log("  principal:", entrada.input.primaryKeyword)
  console.log("  seeds:", entrada.input.seeds.length, entrada.input.seeds)
  console.log("  cidades:", entrada.input.cities.map((c) => `${c.name}/${c.stateCode}${c.isPrimary ? " (principal)" : ""}`))
  console.log("  bairros:", entrada.input.neighborhoods.length)
  for (const w of entrada.warnings) console.log(`  AVISO [${w.code}] ${w.message}`)
}

console.log("\n=== 5. tabelas de research existem? ===")
for (const tabela of [
  "client_research_audits",
  "client_research_reviews",
  "client_research_serp_tasks",
]) {
  const r = await db.from(tabela).select("id").limit(1)
  console.log(`  ${tabela}:`, r.error ? `ERRO ${r.error.message}` : `ok (${r.data.length} linha de amostra)`)
}

console.log("\n=== 6. a fila da ultima execucao ===")
const fila = await db
  .from("client_research_serp_tasks")
  .select("run_id, status")
  .eq("client_id", CLIENT_ID)
console.log("erro:", fila.error?.message ?? "(nenhum)")
console.log("linhas:", fila.data?.length ?? 0)
