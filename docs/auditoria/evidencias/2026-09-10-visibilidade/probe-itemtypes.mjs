// DESCARTAVEL - confere a forma de metrics/items com item_types ampliado.
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = "C:/Users/Eduardo Zamai/Documents/suite"
const TARGET = process.argv[2] ?? "buscaorganica.com.br"

function env() {
  const raw = readFileSync(join(ROOT, ".env.local"), "utf8")
  const out = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if (v.length > 1 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0]) {
      v = v.slice(1, -1)
    }
    out[m[1]] = v
  }
  return out
}

const e = env()
const auth =
  "Basic " +
  Buffer.from(`${e.DATAFORSEO_LOGIN}:${e.DATAFORSEO_PASSWORD}`, "utf8").toString("base64")

const res = await fetch(
  "https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live",
  {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify([
      {
        target: TARGET,
        location_name: "Brazil",
        language_code: "pt",
        limit: 1000,
        item_types: ["organic", "local_pack", "ai_overview_reference"],
        order_by: ["ranked_serp_element.serp_item.etv,desc"],
      },
    ]),
  },
)
const json = await res.json()
writeFileSync("07-itemtypes.json", JSON.stringify(json, null, 2), "utf8")

const t = json.tasks?.[0]
const r = t?.result?.[0]
const items = r?.items ?? []
console.log("status:", t?.status_code, t?.status_message, "| custo:", t?.cost)
console.log("total_count:", r?.total_count, "items:", items.length)
console.log("chaves de metrics:", Object.keys(r?.metrics ?? {}))
for (const [k, v] of Object.entries(r?.metrics ?? {})) {
  console.log(`  metrics.${k}:`, JSON.stringify({ count: v?.count, etv: v?.etv, pos_1: v?.pos_1 }))
}

const byType = {}
for (const it of items) {
  const type = it?.ranked_serp_element?.serp_item?.type ?? "(sem type)"
  byType[type] = (byType[type] ?? 0) + 1
}
console.log("items por serp_item.type:", JSON.stringify(byType))

for (const type of Object.keys(byType)) {
  const found = items.find((it) => it?.ranked_serp_element?.serp_item?.type === type)
  const si = found?.ranked_serp_element?.serp_item ?? {}
  console.log(`\n--- serp_item type=${type} ---`)
  console.log("chaves:", Object.keys(si).join(", "))
  console.log(
    "valores-chave:",
    JSON.stringify(
      {
        rank_group: si.rank_group,
        rank_absolute: si.rank_absolute,
        url: si.url,
        relative_url: si.relative_url,
        domain: si.domain,
        main_domain: si.main_domain,
        etv: si.etv,
        title: si.title,
      },
      null,
      2,
    ),
  )
}
