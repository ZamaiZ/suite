import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

const API_BASE = "https://api.dataforseo.com/v3"
const OUTPUT_DIR = resolve(
  "docs/auditoria/evidencias/2026-09-22-prospeccao-business-listings",
)
const CATEGORY = "demolition_contractor"
const PAGE_LIMIT = 2
const SEARCH_PATH = "/business_data/business_listings/search/live"
const CATEGORIES_PATH = "/business_data/business_listings/categories"

async function loadLocalEnvironment() {
  if (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) return
  let source
  try {
    source = await readFile(resolve(".env.local"), "utf8")
  } catch {
    return
  }
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match || process.env[match[1]]) continue
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[match[1]] = value
  }
}

function credentials() {
  const login = process.env.DATAFORSEO_LOGIN?.trim()
  const password = process.env.DATAFORSEO_PASSWORD?.trim()
  if (!login || !password) {
    throw new Error("DATAFORSEO_LOGIN e DATAFORSEO_PASSWORD não configurados.")
  }
  return Buffer.from(`${login}:${password}`, "utf8").toString("base64")
}

async function request(path, init = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Basic ${credentials()}`,
        "Content-Type": "application/json; charset=utf-8",
        ...init.headers,
      },
      signal: controller.signal,
    })
    const body = await response.json()
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} em ${path}.`)
    }
    return body
  } finally {
    clearTimeout(timeout)
  }
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null
}

function firstResult(body) {
  const task = Array.isArray(body?.tasks) ? body.tasks[0] : null
  const result = Array.isArray(task?.result) ? task.result[0] : null
  return record(result)
}

function number(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function string(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function redactItem(value) {
  const item = record(value) ?? {}
  const addressInfo = record(item.address_info)
  const rating = record(item.rating)
  const workTime = record(item.work_time)
  return {
    type: string(item.type),
    place_id: string(item.place_id),
    cid: string(item.cid),
    feature_id: string(item.feature_id),
    title: string(item.title),
    category: string(item.category),
    category_ids: Array.isArray(item.category_ids) ? item.category_ids : [],
    additional_categories: Array.isArray(item.additional_categories)
      ? item.additional_categories
      : [],
    address: string(item.address),
    address_info: addressInfo,
    phone: string(item.phone),
    url: string(item.url),
    latitude: number(item.latitude),
    longitude: number(item.longitude),
    rating: rating
      ? { value: number(rating.value), votes_count: number(rating.votes_count) }
      : null,
    current_status: string(workTime?.current_status),
    check_url: string(item.check_url),
    last_updated_time: string(item.last_updated_time),
  }
}

function redactEnvelope(body) {
  const task = Array.isArray(body?.tasks) ? body.tasks[0] : null
  const page = firstResult(body) ?? {}
  const items = Array.isArray(page.items) ? page.items : []
  return {
    captured_at: new Date().toISOString(),
    envelope: {
      version: string(body?.version),
      status_code: number(body?.status_code),
      status_message: string(body?.status_message),
      cost: number(body?.cost),
      tasks_count: number(body?.tasks_count),
      tasks_error: number(body?.tasks_error),
    },
    task: task
      ? {
          id: string(task.id),
          status_code: number(task.status_code),
          status_message: string(task.status_message),
          cost: number(task.cost),
          path: Array.isArray(task.path) ? task.path : [],
        }
      : null,
    page: {
      total_count: number(page.total_count),
      count: number(page.count),
      items_count: number(page.items_count),
      offset: number(page.offset),
      offset_token: string(page.offset_token),
      items: items.map(redactItem),
    },
  }
}

function collectCategoryMatches(value, path = "$", matches = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectCategoryMatches(item, `${path}[${index}]`, matches),
    )
    return matches
  }
  const row = record(value)
  if (!row) return matches
  const identity = [row.name, row.category, row.category_name, row.id]
    .filter((item) => typeof item === "string")
    .join(" ")
    .toLowerCase()
  if (identity.includes(CATEGORY)) matches.push({ path, value: row })
  for (const [key, item] of Object.entries(row)) {
    if (key.toLowerCase().includes(CATEGORY)) {
      matches.push({ path: `${path}.${key}`, value: item })
    } else {
      collectCategoryMatches(item, `${path}.${key}`, matches)
    }
  }
  return matches
}

function redactCategories(body) {
  const task = Array.isArray(body?.tasks) ? body.tasks[0] : null
  return {
    captured_at: new Date().toISOString(),
    envelope: {
      version: string(body?.version),
      status_code: number(body?.status_code),
      status_message: string(body?.status_message),
      cost: number(body?.cost),
      tasks_count: number(body?.tasks_count),
      tasks_error: number(body?.tasks_error),
    },
    task: task
      ? {
          status_code: number(task.status_code),
          status_message: string(task.status_message),
          cost: number(task.cost),
        }
      : null,
    matches: collectCategoryMatches(body),
  }
}

async function save(name, value) {
  await writeFile(resolve(OUTPUT_DIR, name), `${JSON.stringify(value, null, 2)}\n`)
}

await loadLocalEnvironment()
credentials()

const categories = await request(CATEGORIES_PATH)
await save("01-categories.redacted.json", redactCategories(categories))

const baseTask = {
  categories: [CATEGORY],
  language_code: "pt",
  location_coordinate: "-23.55052,-46.633308,45",
  limit: PAGE_LIMIT,
}
const firstBody = await request(SEARCH_PATH, {
  method: "POST",
  body: JSON.stringify([baseTask]),
})
const first = redactEnvelope(firstBody)
await save("02-demolition-sp-first-page.redacted.json", first)

const firstPage = first.page
const firstCount = firstPage.count ?? firstPage.items_count ?? firstPage.items.length
const secondTask = firstPage.offset_token
  ? { ...baseTask, offset_token: firstPage.offset_token }
  : { ...baseTask, offset: (firstPage.offset ?? 0) + firstCount }
const secondBody = await request(SEARCH_PATH, {
  method: "POST",
  body: JSON.stringify([secondTask]),
})
const second = redactEnvelope(secondBody)
await save("03-demolition-sp-next-page.redacted.json", second)

const firstIds = new Set(first.page.items.map((item) => item.place_id).filter(Boolean))
const repeated = second.page.items
  .map((item) => item.place_id)
  .filter((id) => id && firstIds.has(id))
if (repeated.length > 0) {
  throw new Error(`A segunda página repetiu place_id: ${repeated.join(", ")}`)
}
if (first.page.items.some((item) => !item.place_id)) {
  throw new Error("A primeira amostra contém item sem place_id.")
}

console.log(
  JSON.stringify({
    categoriesMatched: redactCategories(categories).matches.length,
    firstPage: {
      totalCount: firstPage.total_count,
      count: firstCount,
      offset: firstPage.offset,
      hasOffsetToken: Boolean(firstPage.offset_token),
      cost: first.task?.cost ?? first.envelope.cost,
    },
    secondPage: {
      count: second.page.count ?? second.page.items_count ?? second.page.items.length,
      offset: second.page.offset,
      hasOffsetToken: Boolean(second.page.offset_token),
      cost: second.task?.cost ?? second.envelope.cost,
    },
  }),
)
