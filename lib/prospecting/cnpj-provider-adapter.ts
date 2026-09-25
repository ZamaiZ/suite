import "server-only"

import { BigQuery } from "@google-cloud/bigquery"
import { isValidCnpj, normalizeCnpj } from "./cnpj"
import type {
  CnpjProviderCandidate,
  CnpjProviderMatch,
} from "./cnpj-provider"

const BATCH_BYTES_DEFAULT = 10 * 1024 * 1024 * 1024
const BATCH_BYTES_HARD_MAX = 100 * 1024 * 1024 * 1024
const SOURCE_URL = "https://opencnpj.org/docs#consultas-analiticas"
const TABLE = "`opencnpj-bigquery.public.receita`"

export type CnpjProviderConfigResult =
  | { status: "configured"; client: BigQuery; maxBytesBilled: string }
  | { status: "not_configured" }

export type CnpjJobState =
  | { status: "processing"; jobId: string }
  | {
      status: "completed"
      bytesProcessed: string
      sourceUpdatedAt: string | null
      matches: CnpjProviderMatch[]
    }
  | { status: "source_limited" }
  | { status: "source_unavailable" }

function maxBytesPerBatch(): string | null {
  const raw = process.env.PROSPECTING_CNPJ_MAX_BYTES_PER_BATCH
  if (!raw) return String(BATCH_BYTES_DEFAULT)
  if (!/^\d+$/.test(raw)) return null
  const value = Number(raw)
  if (
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > BATCH_BYTES_HARD_MAX
  ) {
    return null
  }
  return String(value)
}

export function getCnpjProviderConfig(): CnpjProviderConfigResult {
  const projectId = process.env.PROSPECTING_CNPJ_BIGQUERY_PROJECT_ID?.trim()
  const credentialsJson =
    process.env.PROSPECTING_CNPJ_GOOGLE_CREDENTIALS_JSON?.trim()
  const maxBytesBilled = maxBytesPerBatch()
  if (!projectId || !credentialsJson || !maxBytesBilled) {
    return { status: "not_configured" }
  }

  try {
    const credentials = JSON.parse(credentialsJson) as {
      client_email?: unknown
      private_key?: unknown
      type?: unknown
    }
    if (
      credentials.type !== "service_account" ||
      typeof credentials.client_email !== "string" ||
      typeof credentials.private_key !== "string"
    ) {
      return { status: "not_configured" }
    }
    return {
      status: "configured",
      client: new BigQuery({ projectId, credentials }),
      maxBytesBilled,
    }
  } catch {
    return { status: "not_configured" }
  }
}

function normalizedName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR")
    .replace(/[^A-Z0-9]/g, "")
}

function safeText(value: unknown, maxLength = 300): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : null
}

function field(row: Record<string, unknown>, name: string): unknown {
  return row[name] ?? row[name.toLowerCase()]
}

function sourceUpdatedAt(value: unknown): string | null {
  if (typeof value !== "string") return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function isLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const row = error as { code?: unknown; errors?: unknown; message?: unknown }
  if (row.code === 429 || row.code === 403) {
    const message = typeof row.message === "string" ? row.message : ""
    if (/quota|rate|billing|bytes billed|limit/i.test(message)) return true
  }
  if (Array.isArray(row.errors)) {
    return row.errors.some((entry) => {
      if (!entry || typeof entry !== "object") return false
      const reason = (entry as { reason?: unknown }).reason
      return (
        reason === "quotaExceeded" ||
        reason === "rateLimitExceeded" ||
        reason === "billingNotEnabled"
      )
    })
  }
  return false
}

function jobIdForBatch(batchId: string): string {
  return `suite_cnpj_${batchId.replaceAll("-", "")}`
}

function queryForCandidates() {
  return `
    WITH inputs AS (
      SELECT
        JSON_VALUE(item, '$.candidateId') AS candidate_id,
        JSON_VALUE(item, '$.companyName') AS company_name,
        REGEXP_REPLACE(
          NORMALIZE_AND_CASEFOLD(JSON_VALUE(item, '$.companyName'), NFD),
          r'[^a-z0-9]', ''
        ) AS company_key
      FROM UNNEST(JSON_QUERY_ARRAY(PARSE_JSON(@candidate_payload))) AS item
    ),
    businesses AS (
      SELECT
        cnpj,
        razao_social,
        nome_fantasia,
        situacao_cadastral,
        uf,
        municipio,
        cnae_principal,
        REGEXP_REPLACE(
          NORMALIZE_AND_CASEFOLD(COALESCE(razao_social, ''), NFD),
          r'[^a-z0-9]', ''
        ) AS legal_key,
        REGEXP_REPLACE(
          NORMALIZE_AND_CASEFOLD(COALESCE(nome_fantasia, ''), NFD),
          r'[^a-z0-9]', ''
        ) AS trade_key,
        REGEXP_REPLACE(
          NORMALIZE_AND_CASEFOLD(COALESCE(municipio, ''), NFD),
          r'[^a-z0-9]', ''
        ) AS city_key
      FROM ${TABLE}
      WHERE UPPER(uf) = @state_code
    ),
    ranked AS (
      SELECT
        inputs.candidate_id,
        businesses.cnpj,
        businesses.razao_social,
        businesses.nome_fantasia,
        businesses.situacao_cadastral,
        businesses.uf,
        businesses.municipio,
        businesses.cnae_principal,
        CASE
          WHEN businesses.legal_key = inputs.company_key
            OR businesses.trade_key = inputs.company_key THEN 0
          WHEN STRPOS(businesses.trade_key, inputs.company_key) > 0
            OR STRPOS(businesses.legal_key, inputs.company_key) > 0 THEN 1
          ELSE 2
        END AS name_rank,
        CASE
          WHEN businesses.city_key = @city_key THEN 0
          ELSE 1
        END AS city_rank
      FROM inputs
      JOIN businesses
        ON LENGTH(inputs.company_key) >= 4
        AND (
          businesses.legal_key = inputs.company_key
          OR businesses.trade_key = inputs.company_key
          OR STRPOS(businesses.trade_key, inputs.company_key) > 0
          OR STRPOS(businesses.legal_key, inputs.company_key) > 0
        )
    )
    SELECT
      candidate_id,
      cnpj,
      razao_social,
      nome_fantasia,
      situacao_cadastral,
      uf,
      municipio,
      cnae_principal
    FROM ranked
    QUALIFY ROW_NUMBER() OVER (
      PARTITION BY candidate_id
      ORDER BY name_rank, city_rank, cnpj
    ) <= 10
  `
}

export async function startCnpjBigQueryJob(input: {
  batchId: string
  candidates: CnpjProviderCandidate[]
  city: string
  stateCode: string
}): Promise<
  | { status: "processing"; jobId: string; bytesToScan: string }
  | { status: "source_not_configured" | "source_limited" | "source_unavailable" }
> {
  const config = getCnpjProviderConfig()
  if (config.status !== "configured") return { status: "source_not_configured" }
  const payload = input.candidates.map((candidate) => ({
    candidateId: candidate.id,
    companyName: candidate.companyName,
  }))
  const options = {
    query: queryForCandidates(),
    params: {
      candidate_payload: JSON.stringify(payload),
      state_code: input.stateCode,
      city_key: normalizedName(input.city).toLowerCase(),
    },
    useLegacySql: false,
    maximumBytesBilled: config.maxBytesBilled,
    location: "US",
  }

  try {
    const [dryRun] = await config.client.createQueryJob({
      ...options,
      dryRun: true,
    })
    const processed = String(
      dryRun.metadata.statistics?.totalBytesProcessed ?? "0",
    )
    if (BigInt(processed) > BigInt(config.maxBytesBilled)) {
      return { status: "source_limited" }
    }

    const jobId = jobIdForBatch(input.batchId)
    try {
      await config.client.createQueryJob({ ...options, jobId })
    } catch (error) {
      if (!/already exists|duplicate/i.test(String(error))) throw error
      await config.client.job(jobId).getMetadata()
    }
    return { status: "processing", jobId, bytesToScan: processed }
  } catch (error) {
    return {
      status: isLimitError(error) ? "source_limited" : "source_unavailable",
    }
  }
}

export async function readCnpjBigQueryJob(input: {
  batchId: string
  jobId: string
}): Promise<CnpjJobState> {
  const config = getCnpjProviderConfig()
  if (config.status !== "configured") return { status: "source_unavailable" }
  const expectedJobId = jobIdForBatch(input.batchId)
  if (input.jobId !== expectedJobId) return { status: "source_unavailable" }

  try {
    const job = config.client.job(input.jobId)
    const [metadata] = await job.getMetadata()
    if (metadata.status?.errorResult) {
      return {
        status: isLimitError(metadata.status.errorResult)
          ? "source_limited"
          : "source_unavailable",
      }
    }
    if (metadata.status?.state !== "DONE") {
      return { status: "processing", jobId: input.jobId }
    }

    const [rows] = await job.getQueryResults()
    const bytesProcessed = String(
      metadata.statistics?.query?.totalBytesProcessed ?? "0",
    )
    const sourceUpdated = await fetch("https://api.opencnpj.org/info", {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    })
      .then(async (response) => {
        if (!response.ok) return null
        const body = (await response.json()) as {
          datasets?: { receita?: { updated_at?: unknown } }
        }
        return sourceUpdatedAt(body.datasets?.receita?.updated_at)
      })
      .catch(() => null)

    const matches: CnpjProviderMatch[] = []
    for (const row of rows as Record<string, unknown>[]) {
      const candidateId = field(row, "candidate_id")
      const cnpj = normalizeCnpj(field(row, "cnpj"))
      if (typeof candidateId !== "string" || !cnpj) continue
      matches.push({
        id: crypto.randomUUID(),
        candidateId,
        cnpj,
        legalName: safeText(field(row, "razao_social")),
        tradeName: safeText(field(row, "nome_fantasia")),
        registrationStatus: safeText(field(row, "situacao_cadastral"), 80),
        city: safeText(field(row, "municipio"), 160),
        stateCode: safeText(field(row, "uf"), 2)?.toUpperCase() ?? null,
        primaryCnae: safeText(field(row, "cnae_principal"), 100),
        source: "opencnpj_bigquery",
        sourceUpdatedAt: sourceUpdated,
        sourceUrl: SOURCE_URL,
        structurallyValid: isValidCnpj(cnpj),
      })
    }
    return {
      status: "completed",
      bytesProcessed,
      sourceUpdatedAt: sourceUpdated,
      matches,
    }
  } catch (error) {
    return {
      status: isLimitError(error) ? "source_limited" : "source_unavailable",
    }
  }
}

export function isCnpjProviderConfigured(): boolean {
  return getCnpjProviderConfig().status === "configured"
}
