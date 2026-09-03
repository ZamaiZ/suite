export const CLOSING_ANSWER_IDS = ["yes", "no"] as const

export type ClosingAnswerId = (typeof CLOSING_ANSWER_IDS)[number]

export const CLOSING_TEXTAREA_MAX = 8000

export type BriefingClosingPayload = {
  hasAdditionalInfo: ClosingAnswerId | null
  additionalInfo: string
}

export function emptyClosingPayload(): BriefingClosingPayload {
  return {
    hasAdditionalInfo: null,
    additionalInfo: "",
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function isClosingAnswerId(value: unknown): value is ClosingAnswerId {
  return (
    typeof value === "string" &&
    (CLOSING_ANSWER_IDS as readonly string[]).includes(value)
  )
}

export function sanitizeClosingPayload(
  payload: BriefingClosingPayload,
): BriefingClosingPayload {
  if (payload.hasAdditionalInfo !== "yes") {
    return {
      hasAdditionalInfo: payload.hasAdditionalInfo,
      additionalInfo: "",
    }
  }

  return {
    hasAdditionalInfo: "yes",
    additionalInfo: payload.additionalInfo,
  }
}

export function parseClosingPayload(value: unknown): BriefingClosingPayload {
  const base = emptyClosingPayload()
  if (!value || typeof value !== "object") return base
  const row = value as Record<string, unknown>

  return sanitizeClosingPayload({
    hasAdditionalInfo: isClosingAnswerId(row.hasAdditionalInfo)
      ? row.hasAdditionalInfo
      : null,
    additionalInfo: asString(row.additionalInfo).slice(0, CLOSING_TEXTAREA_MAX),
  })
}

export type ClosingMissingGroup = "hasAdditionalInfo" | "additionalInfo"

export const CLOSING_MISSING_LABELS: Record<ClosingMissingGroup, string> = {
  hasAdditionalInfo: "se há informação adicional",
  additionalInfo: "informação adicional",
}

export function getClosingMissingGroups(
  payload: BriefingClosingPayload,
): ClosingMissingGroup[] {
  const sanitized = sanitizeClosingPayload(payload)
  const missing: ClosingMissingGroup[] = []

  if (sanitized.hasAdditionalInfo === null) {
    missing.push("hasAdditionalInfo")
  } else if (
    sanitized.hasAdditionalInfo === "yes" &&
    sanitized.additionalInfo.trim().length === 0
  ) {
    missing.push("additionalInfo")
  }

  return missing
}

export function isClosingReadyToComplete(
  payload: BriefingClosingPayload,
): boolean {
  return getClosingMissingGroups(payload).length === 0
}
