import type { WebsiteGapId } from "./website-audit.ts"

export const PSI_SCREENSHOT_MAX_CHARS = 200_000
export const PSI_PERFORMANCE_POOR = 50
export const PSI_PERFORMANCE_NEEDS = 90
export const PSI_LCP_NEEDS_MS = 2500
export const PSI_INP_NEEDS_MS = 200
export const PSI_CLS_NEEDS = 0.1

/**
 * Teto da faixa "a melhorar": acima disso o Core Web Vital e ruim. As tres
 * faixas do Google — bom, a melhorar, ruim — sao o que a regua da aba PageSpeed
 * desenha; sem o segundo limiar ela so saberia dizer "passou" ou "nao passou".
 */
export const PSI_LCP_POOR_MS = 4000
export const PSI_INP_POOR_MS = 500
export const PSI_CLS_POOR = 0.25
export const PSI_A11Y_POOR = 50
export const PSI_STALE_RUNNING_MS = 90_000
export const PSI_FETCH_TIMEOUT_MS = 55_000

export const WEBSITE_PSI_JOB_KINDS = [
  "pagespeed_mobile",
  "pagespeed_desktop",
] as const

export type WebsitePsiJobKind = (typeof WEBSITE_PSI_JOB_KINDS)[number]
export type WebsitePsiJobStatus = "queued" | "running" | "ready" | "failed"
export type WebsitePsiStrategyId = "mobile" | "desktop"

export type WebsitePsiJob = {
  kind: WebsitePsiJobKind
  status: WebsitePsiJobStatus
  error_message: string | null
}

export type WebsitePsiStrategy = {
  performance: number
  accessibility: number
  lcpMs: number | null
  inpMs: number | null
  cls: number | null
  fieldLcpMs: number | null
  fieldInpMs: number | null
  fieldCls: number | null
  viewportOk: boolean
  contrastFails: number
  httpsOk: boolean
  indexable: boolean
  screenshot: string | null
}

export type WebsitePagespeedSnapshot = {
  url: string
  mobile: WebsitePsiStrategy | null
  desktop: WebsitePsiStrategy | null
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function asFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asCount(value: unknown): number | null {
  const number = asFinite(value)
  if (number === null || number < 0) return null
  return Math.trunc(number)
}

function asBool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null
}

function asScore100(value: unknown): number | null {
  const number = asFinite(value)
  if (number === null || number < 0 || number > 100) return null
  return Math.round(number)
}

function asNullableMetric(value: unknown): number | null {
  if (value === null) return null
  const number = asFinite(value)
  if (number === null || number < 0) return null
  return number
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function psiKindToStrategy(
  kind: WebsitePsiJobKind,
): WebsitePsiStrategyId {
  return kind === "pagespeed_mobile" ? "mobile" : "desktop"
}

export function websitePsiJobsActive(jobs: readonly WebsitePsiJob[]): boolean {
  return jobs.some((job) => job.status === "queued" || job.status === "running")
}

export function websitePsiJobsFailedWithoutReady(
  jobs: readonly WebsitePsiJob[],
): boolean {
  return (
    jobs.some((job) => job.status === "failed") &&
    !jobs.some((job) => job.status === "ready")
  )
}

function readJobKind(value: unknown): WebsitePsiJobKind | null {
  return value === "pagespeed_mobile" || value === "pagespeed_desktop"
    ? value
    : null
}

function readJobStatus(value: unknown): WebsitePsiJobStatus | null {
  return value === "queued" ||
    value === "running" ||
    value === "ready" ||
    value === "failed"
    ? value
    : null
}

export function readWebsitePsiJobs(value: unknown): WebsitePsiJob[] {
  if (!Array.isArray(value)) return []
  const jobs: WebsitePsiJob[] = []
  const seen = new Set<WebsitePsiJobKind>()
  for (const item of value) {
    const row = objectRecord(item)
    if (!row) continue
    const kind = readJobKind(row.kind)
    const status = readJobStatus(row.status)
    if (!kind || !status || seen.has(kind)) continue
    seen.add(kind)
    jobs.push({
      kind,
      status,
      error_message: asString(row.error_message),
    })
  }
  return jobs
}

function readStrategy(value: unknown): WebsitePsiStrategy | null {
  if (value === null) return null
  const row = objectRecord(value)
  if (!row) return null
  const performance = asScore100(row.performance)
  const accessibility = asScore100(row.accessibility)
  const contrastFails = asCount(row.contrastFails)
  const viewportOk = asBool(row.viewportOk)
  const httpsOk = asBool(row.httpsOk)
  if (
    performance === null ||
    accessibility === null ||
    contrastFails === null ||
    viewportOk === null ||
    httpsOk === null
  ) {
    return null
  }
  let indexable = true
  if (row.indexable !== undefined && row.indexable !== null) {
    const parsed = asBool(row.indexable)
    if (parsed === null) return null
    indexable = parsed
  }
  if (row.screenshot != null && typeof row.screenshot !== "string") return null
  const screenshot = asString(row.screenshot)
  return {
    performance,
    accessibility,
    lcpMs: asNullableMetric(row.lcpMs),
    inpMs: asNullableMetric(row.inpMs),
    cls: asNullableMetric(row.cls),
    fieldLcpMs: asNullableMetric(row.fieldLcpMs),
    fieldInpMs: asNullableMetric(row.fieldInpMs),
    fieldCls: asNullableMetric(row.fieldCls),
    viewportOk,
    contrastFails,
    httpsOk,
    indexable,
    screenshot:
      screenshot && screenshot.length <= PSI_SCREENSHOT_MAX_CHARS
        ? screenshot
        : null,
  }
}

export function readWebsitePagespeed(
  value: unknown,
): WebsitePagespeedSnapshot | null {
  const row = objectRecord(value)
  if (!row) return null
  const url = asString(row.url)
  if (!url) return null
  if (row.mobile !== null && row.mobile !== undefined) {
    if (!readStrategy(row.mobile)) return null
  }
  if (row.desktop !== null && row.desktop !== undefined) {
    if (!readStrategy(row.desktop)) return null
  }
  return {
    url,
    mobile: row.mobile == null ? null : readStrategy(row.mobile),
    desktop: row.desktop == null ? null : readStrategy(row.desktop),
  }
}

export function mergeWebsitePagespeed(
  current: WebsitePagespeedSnapshot | null,
  url: string,
  strategy: WebsitePsiStrategyId,
  next: WebsitePsiStrategy,
): WebsitePagespeedSnapshot {
  return {
    url,
    mobile: strategy === "mobile" ? next : (current?.mobile ?? null),
    desktop: strategy === "desktop" ? next : (current?.desktop ?? null),
  }
}

function categoryScore(
  categories: Record<string, unknown> | null,
  id: string,
): number | null {
  if (!categories) return null
  const category = objectRecord(categories[id])
  if (!category) return null
  const score = asFinite(category.score)
  if (score === null || score < 0 || score > 1) return null
  return Math.round(score * 100)
}

function auditRecord(
  audits: Record<string, unknown> | null,
  id: string,
): Record<string, unknown> | null {
  if (!audits) return null
  return objectRecord(audits[id])
}

function auditNumeric(
  audits: Record<string, unknown> | null,
  id: string,
): number | null {
  const audit = auditRecord(audits, id)
  if (!audit) return null
  return asNullableMetric(audit.numericValue)
}

function auditScoreOne(
  audits: Record<string, unknown> | null,
  id: string,
): boolean {
  const audit = auditRecord(audits, id)
  if (!audit) return true
  const score = asFinite(audit.score)
  if (score === null) return true
  return score >= 1
}

function contrastFailCount(audits: Record<string, unknown> | null): number {
  const audit = auditRecord(audits, "color-contrast")
  if (!audit) return 0
  const score = asFinite(audit.score)
  if (score !== null && score >= 1) return 0
  const details = objectRecord(audit.details)
  const items = details?.items
  if (!Array.isArray(items)) return score !== null && score < 1 ? 1 : 0
  return items.length
}

function screenshotData(audits: Record<string, unknown> | null): string | null {
  const audit = auditRecord(audits, "final-screenshot")
  const details = objectRecord(audit?.details)
  const data = asString(details?.data)
  if (!data || data.length > PSI_SCREENSHOT_MAX_CHARS) return null
  if (data.startsWith("data:image/")) return data
  return `data:image/jpeg;base64,${data}`
}

/**
 * Resposta de Lighthouse → estratégia.
 *
 * Aceita as duas formas: o Lighthouse cru, que é o que o DataForSEO devolve, e
 * o `lighthouseResult` que o PSI envolvia — payload gravado antes da virada
 * ainda precisa abrir.
 *
 * **`loadingExperience` deixou de ser lido em 2026-09-15.** Era campo do Chrome
 * UX Report, e não há fonte para ele fora do Google. Os três campos continuam
 * no tipo, sempre nulos em coleta nova, porque linhas antigas os têm e apagar o
 * leitor apagaria dado gravado.
 */
export function extractWebsitePsiStrategy(
  payload: unknown,
): WebsitePsiStrategy | null {
  const root = objectRecord(payload)
  if (!root) return null
  const lighthouse = objectRecord(root.lighthouseResult) ?? root
  if (objectRecord(lighthouse.runtimeError)) return null
  const categories = objectRecord(lighthouse.categories)
  const audits = objectRecord(lighthouse.audits)
  const performance = categoryScore(categories, "performance")
  const accessibility = categoryScore(categories, "accessibility")
  if (performance === null || accessibility === null) return null
  return {
    performance,
    accessibility,
    lcpMs: auditNumeric(audits, "largest-contentful-paint"),
    // O Lighthouse padrão não emite INP: é métrica de campo por natureza.
    // Medido em 2026-09-15 — ausente nos dois nomes. Fica a tentativa, e `null`
    // quando não vier, porque zero passaria em qualquer limiar.
    inpMs:
      auditNumeric(audits, "interaction-to-next-paint") ??
      auditNumeric(audits, "experimental-interaction-to-next-paint"),
    cls: auditNumeric(audits, "cumulative-layout-shift"),
    fieldLcpMs: null,
    fieldInpMs: null,
    fieldCls: null,
    // `meta-viewport` primeiro: o audit foi renomeado, e no Lighthouse 13.4.0
    // que o DataForSEO roda o nome antigo não existe. Como `auditScoreOne`
    // devolve `true` para audit ausente, ler só o antigo faria `viewportOk`
    // passar sempre, sem medir nada.
    viewportOk:
      audits && "meta-viewport" in audits
        ? auditScoreOne(audits, "meta-viewport")
        : auditScoreOne(audits, "viewport"),
    contrastFails: contrastFailCount(audits),
    httpsOk: auditScoreOne(audits, "is-on-https"),
    indexable: auditScoreOne(audits, "is-crawlable"),
    screenshot: screenshotData(audits),
  }
}

function presentStrategies(
  pagespeed: WebsitePagespeedSnapshot,
): WebsitePsiStrategy[] {
  return [pagespeed.mobile, pagespeed.desktop].filter(
    (item): item is WebsitePsiStrategy => item !== null,
  )
}

export function websiteMinPerformance(
  pagespeed: WebsitePagespeedSnapshot | null,
): number | null {
  if (!pagespeed) return null
  const strategies = presentStrategies(pagespeed)
  if (strategies.length === 0) return null
  return Math.min(...strategies.map((item) => item.performance))
}

function metricNeedsImprovement(
  lab: number | null,
  field: number | null,
  threshold: number,
): boolean {
  if (lab !== null && lab > threshold) return true
  if (field !== null && field > threshold) return true
  return false
}

function strategyCwvNeedsImprovement(item: WebsitePsiStrategy): boolean {
  return (
    metricNeedsImprovement(item.lcpMs, item.fieldLcpMs, PSI_LCP_NEEDS_MS) ||
    metricNeedsImprovement(item.inpMs, item.fieldInpMs, PSI_INP_NEEDS_MS) ||
    metricNeedsImprovement(item.cls, item.fieldCls, PSI_CLS_NEEDS)
  )
}

export function websitePagespeedGaps(
  crawlHttps: boolean,
  pagespeed: WebsitePagespeedSnapshot | null,
): WebsiteGapId[] {
  if (!pagespeed) return []
  const strategies = presentStrategies(pagespeed)
  if (strategies.length === 0) return []
  const gaps: WebsiteGapId[] = []
  const minPerformance = Math.min(...strategies.map((item) => item.performance))
  if (minPerformance < PSI_PERFORMANCE_NEEDS) gaps.push("slow_performance")
  if (strategies.some((item) => strategyCwvNeedsImprovement(item))) {
    gaps.push("poor_cwv")
  }
  if (strategies.some((item) => !item.viewportOk)) gaps.push("not_responsive")
  if (
    strategies.some(
      (item) => item.accessibility < PSI_A11Y_POOR || item.contrastFails > 0,
    )
  ) {
    gaps.push("a11y_issues")
  }
  if (crawlHttps && strategies.some((item) => !item.httpsOk)) {
    gaps.push("mixed_content")
  }
  if (strategies.some((item) => item.indexable === false)) gaps.push("noindex")
  return gaps
}
