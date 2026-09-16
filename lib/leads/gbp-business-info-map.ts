/**
 * `google_business_info` do DataForSEO → `GbpSnapshot`.
 *
 * Puro e sem alias, para rodar no `node --test`. De `gbp.ts` só entra o tipo,
 * com `import type`, que a remoção de tipos do Node apaga — `gbp.ts` importa por
 * alias e não é carregável fora do bundler.
 *
 * **A tradução do status é deliberada.** Se o vocabulário do DataForSEO vazasse
 * para o snapshot, perfis antigos e novos passariam a significar coisas
 * diferentes na mesma coluna, e `startsWith("CLOSED")` em `gbp.ts` mudaria de
 * sentido sem que ninguém tocasse na regra.
 */

import type { GbpSnapshot } from "./gbp.ts"
import { normalizeWebsiteDomain } from "./website.ts"

/**
 * Ordem e rótulos da semana. Segunda primeiro, como o Google publica em pt-BR,
 * e não domingo — a linha é copiada para o briefing do cliente.
 */
const WEEKDAYS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "monday", label: "segunda-feira" },
  { key: "tuesday", label: "terça-feira" },
  { key: "wednesday", label: "quarta-feira" },
  { key: "thursday", label: "quinta-feira" },
  { key: "friday", label: "sexta-feira" },
  { key: "saturday", label: "sábado" },
  { key: "sunday", label: "domingo" },
]

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const text = asString(item)
    return text ? [text] : []
  })
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/**
 * O bloco de horário, nos dois formatos que o fornecedor usa.
 *
 * `my_business_info` aninha em `work_time.work_hours`; o item do Maps põe
 * `work_hours` na raiz. Medido em 2026-09-15. Um leitor só, para o mapeador não
 * precisar saber de qual endpoint o item veio.
 */
function workHours(
  item: Record<string, unknown>,
): Record<string, unknown> | null {
  return record(record(item.work_time)?.work_hours) ?? record(item.work_hours)
}

/**
 * `current_status` do DataForSEO → vocabulário do Places que o produto grava.
 *
 * `open` e `close` são estado **do momento**, não do negócio: um perfil
 * consultado às 22h volta `close` e continua operando. Mapear isso para
 * `CLOSED_*` faria toda coleta noturna acusar encerramento de atividade.
 *
 * Valor desconhecido vira `null`, nunca um `CLOSED` de chute: ausência é
 * diferente de fechado, e só o segundo é achado.
 */
export function gbpBusinessStatusFromDataForSeo(
  currentStatus: unknown,
): string | null {
  const value = asString(currentStatus)?.toUpperCase()
  if (!value) return null
  if (value === "OPEN" || value === "CLOSE" || value === "OPEN_24") {
    return "OPERATIONAL"
  }
  if (value === "TEMPORARILY_CLOSED") return "CLOSED_TEMPORARILY"
  if (value === "PERMANENTLY_CLOSED" || value === "CLOSED") {
    return "CLOSED_PERMANENTLY"
  }
  return null
}

function clock(value: unknown): { hour: number; text: string } | null {
  const slot = record(value)
  const hour = asNumber(slot?.hour)
  const minute = asNumber(slot?.minute)
  if (hour === null) return null
  const mm = String(minute ?? 0).padStart(2, "0")
  return { hour, text: `${String(hour).padStart(2, "0")}:${mm}` }
}

/**
 * `work_hours.timetable` → as mesmas linhas que o Places entregava prontas.
 *
 * Sem `timetable` devolve `[]`, e não sete linhas de "Fechado": o gap
 * `missing_hours` existe para perfil que não publicou horário, e sete linhas
 * inventadas o esconderiam.
 */
export function gbpWeekdayDescriptions(hours: unknown): string[] {
  const timetable = record(record(hours)?.timetable)
  if (!timetable) return []

  return WEEKDAYS.map(({ key, label }) => {
    const slots = timetable[key]
    if (!Array.isArray(slots) || slots.length === 0) {
      return `${label}: Fechado`
    }

    const ranges = slots.flatMap((slot) => {
      const entry = record(slot)
      const open = clock(entry?.open)
      const close = clock(entry?.close)
      if (!open || !close) return []
      // 00:00 a 24:00 é como o fornecedor escreve "abre o dia inteiro". Medido
      // na Funerária Benttus. Imprimir o intervalo cru seria tecnicamente certo
      // e ilegível para quem lê a ficha.
      if (open.hour === 0 && close.hour === 24) return ["Aberto 24 horas"]
      return [`${open.text} – ${close.text}`]
    })

    return ranges.length > 0
      ? `${label}: ${ranges.join(", ")}`
      : `${label}: Fechado`
  })
}

export function snapshotFromBusinessInfo(
  item: Record<string, unknown>,
): GbpSnapshot | null {
  const placeId = asString(item.place_id)
  if (!placeId) return null

  const websiteUri = asString(item.url)
  const cid = asString(item.cid)
  const rating = record(item.rating)
  const categoryIds = asStringList(item.category_ids)
  const hours = workHours(item)

  return {
    placeId,
    displayName: asString(item.title),
    formattedAddress: asString(item.address),
    primaryType: categoryIds[0] ?? null,
    primaryTypeDisplayName: asString(item.category),
    types: categoryIds,
    businessStatus: gbpBusinessStatusFromDataForSeo(hours?.current_status),
    googleMapsUri:
      asString(item.check_url) ??
      (cid ? `https://www.google.com/maps?cid=${cid}` : null),
    nationalPhoneNumber: asString(item.phone),
    websiteUri,
    websiteDomain: websiteUri ? normalizeWebsiteDomain(websiteUri) : null,
    weekdayDescriptions: gbpWeekdayDescriptions(hours),
    rating: asNumber(rating?.value),
    userRatingCount: asNumber(rating?.votes_count),
    // `total_photos` é o total do perfil, não a amostra de dez que o Places
    // devolvia. O contador melhorou; a galeria perdeu a fonte, e isso está
    // registrado na spec como perda aceita.
    photoCount: asNumber(item.total_photos) ?? 0,
    photoNames: [],
    latitude: asNumber(item.latitude),
    longitude: asNumber(item.longitude),
  }
}
