import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createClient } from "@supabase/supabase-js"

const ROOT = process.cwd()
const env = readFileSync(join(ROOT, ".env.local"), "utf8")
const ler = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim() ?? ""
const db = createClient(ler("NEXT_PUBLIC_SUPABASE_URL"), ler("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
})

const linhas = [{
  client_id: "3decad22-09b2-42d8-ab30-53d62f71f81c",
  run_id: "00000000-0000-4000-8000-000000000001",
  keyword: "teste de diagnostico",
  location_code: 2076,
  language_code: "pt",
  status: "pending",
}]

console.log("=== A. upsert com onConflict 'run_id,keyword' (o que a action faz) ===")
const a = await db.from("client_research_serp_tasks")
  .upsert(linhas, { onConflict: "run_id,keyword", ignoreDuplicates: true })
console.log("erro:", a.error ? `${a.error.code} — ${a.error.message}` : "(nenhum)")
if (a.error?.details) console.log("detalhe:", a.error.details)

console.log("\n=== B. insert simples ===")
const b = await db.from("client_research_serp_tasks").insert(linhas)
console.log("erro:", b.error ? `${b.error.code} — ${b.error.message}` : "(nenhum)")

const check = await db.from("client_research_serp_tasks").select("id, keyword")
  .eq("run_id", "00000000-0000-4000-8000-000000000001")
console.log("gravou:", check.data?.length ?? 0, "linha(s)")

await db.from("client_research_serp_tasks").delete()
  .eq("run_id", "00000000-0000-4000-8000-000000000001")
console.log("limpo.")
