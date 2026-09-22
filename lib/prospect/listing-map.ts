/**
 * Do payload do `business_listings` para a linha de `prospects`.
 *
 * Puro e defensivo, como todo mapeador deste repositório: o provedor é banco de
 * dados de terceiro, e campo que some não pode derrubar a campanha inteira.
 * Item que não tem sequer nome é descartado; todo o resto vira `null`.
 *
 * A forma foi medida em 2026-09-21 contra a conta real, não lida na
 * documentação — ver `docs/auditoria/evidencias/2026-09-21-prospeccao/`. Dois
 * detalhes que a documentação não diria:
 *
 *   - `category_ids` vem em snake_case e casa com o `category_name` do
 *     catálogo; `category` é o rótulo legível, e não serve de chave.
 *   - `last_updated_time` veio em 100% da amostra, com mediana de 88 dias.
 */

import {
  domainKey,
  phoneKey,
  streetNumberFromAddress,
  zipKey,
} from "./normalize.ts"
import type { ProspectListing } from "./types.ts"

function texto(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function numero(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function inteiro(value: unknown): number | null {
  const n = numero(value)
  return n === null ? null : Math.trunc(n)
}

function objeto(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function listaDeTexto(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const t = texto(item)
    return t ? [t] : []
  })
}

/**
 * Data em ISO, ou `null`.
 *
 * O provedor devolve `last_updated_time` em formatos que variaram na amostra.
 * Data que não faz sentido vira ausência: melhor a tela dizer "sem data" do
 * que mostrar 1970.
 */
function dataIso(value: unknown): string | null {
  const t = texto(value)
  if (!t) return null
  const ms = Date.parse(t)
  if (Number.isNaN(ms)) return null
  const ano = new Date(ms).getUTCFullYear()
  if (ano < 2000 || ano > 2100) return null
  return new Date(ms).toISOString()
}

export function mapBusinessListing(raw: unknown): ProspectListing | null {
  const item = objeto(raw)
  if (!item) return null

  const title = texto(item.title) ?? texto(item.original_title)
  if (!title) return null

  const addressInfo = objeto(item.address_info) ?? {}
  const rating = objeto(item.rating) ?? {}
  const address = texto(item.address)

  return {
    placeId: texto(item.place_id),
    cid: texto(item.cid),
    title,
    category: texto(item.category),
    categoryIds: listaDeTexto(item.category_ids),
    phoneRaw: texto(item.phone),
    phoneE164: phoneKey(texto(item.phone)),
    // `domain` vem com `www.`; a chave não. Sem isso, o mesmo site cadastrado
    // pelo lead e descoberto pela campanha não se reconheceriam.
    domain: domainKey(texto(item.domain) ?? texto(item.url)),
    url: texto(item.url),
    address,
    zip: zipKey(texto(addressInfo.zip)),
    streetNumber:
      streetNumberFromAddress(texto(addressInfo.address)) ??
      streetNumberFromAddress(address),
    city: texto(addressInfo.city),
    region: texto(addressInfo.region),
    latitude: numero(item.latitude),
    longitude: numero(item.longitude),
    rating: numero(rating.value),
    votesCount: inteiro(rating.votes_count),
    isClaimed: typeof item.is_claimed === "boolean" ? item.is_claimed : null,
    workTime: item.work_time ?? null,
    attributes: item.attributes ?? null,
    listingUpdatedAt: dataIso(item.last_updated_time),
    listing: item,
  }
}

export type BusinessListingsPage = {
  items: ProspectListing[]
  /** Quantas empresas existem no universo, segundo o provedor. */
  totalCount: number | null
  /** Quantas vieram nesta página. */
  count: number
  offset: number | null
  offsetToken: string | null
  /** Itens que o mapeador descartou por não terem sequer nome. */
  skipped: number
}

/**
 * Lê o `result[0]` do `search/live`.
 *
 * `offset_token` é o que permite passar de 1.000 itens sem recomeçar, e é por
 * isso que ele sobe até a coluna da campanha: sem guardá-lo, retomar uma
 * descoberta interrompida significaria recomprar tudo.
 */
export function readBusinessListingsPage(
  raw: unknown,
): BusinessListingsPage | null {
  const result = objeto(raw)
  if (!result) return null

  const brutos = Array.isArray(result.items) ? result.items : []
  const items: ProspectListing[] = []
  let skipped = 0
  for (const bruto of brutos) {
    const mapeado = mapBusinessListing(bruto)
    if (mapeado) items.push(mapeado)
    else skipped += 1
  }

  return {
    items,
    totalCount: inteiro(result.total_count),
    count: items.length,
    offset: inteiro(result.offset),
    offsetToken: texto(result.offset_token),
    skipped,
  }
}

/**
 * Dedupe dentro da página.
 *
 * O provedor devolveu a mesma empresa duas vezes em nenhuma das amostras, mas
 * a paginação por offset sobrepõe quando o banco muda entre duas chamadas — e
 * a constraint do banco rejeitaria o lote inteiro, não a linha repetida.
 */
export function dedupeListings(items: ProspectListing[]): ProspectListing[] {
  const vistos = new Set<string>()
  const saida: ProspectListing[] = []
  for (const item of items) {
    const chave =
      item.placeId ?? `${item.title.toLowerCase()}|${item.zip ?? ""}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    saida.push(item)
  }
  return saida
}
