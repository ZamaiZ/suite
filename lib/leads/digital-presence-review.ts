import { isCivilDate } from "../civil-date.ts"

export const DIGITAL_PRESENCE_REVIEW_NOTE_MAX = 400
export const DIGITAL_PRESENCE_FOLLOWERS_MAX = 1_000_000_000

export type DigitalPresenceIdentityVerdict = "ok" | "issue"

export type DigitalPresenceIdentityAnswer = {
  verdict: DigitalPresenceIdentityVerdict | null
  note: string
  updatedAt: string | null
  updatedBy: string | null
}

export type DigitalPresenceNetworkAnswer = {
  followers: number | null
  lastPostedOn: string | null
  unavailable: boolean
  updatedAt: string | null
  updatedBy: string | null
}

export type DigitalPresenceReview = {
  identity: DigitalPresenceIdentityAnswer
  networks: Record<string, DigitalPresenceNetworkAnswer>
}

export const DIGITAL_PRESENCE_IDENTITY_VERDICT_LABEL: Record<
  DigitalPresenceIdentityVerdict,
  string
> = {
  ok: "Ok",
  issue: "Problema",
}

export const DIGITAL_PRESENCE_IDENTITY = {
  label: "Identidade visual",
  title: "Alinhar a identidade visual nas redes",
  placeholder:
    "Logo, foto e cores das redes estão consistentes com a marca?",
  impact: "high" as const,
}

function emptyIdentity(): DigitalPresenceIdentityAnswer {
  return {
    verdict: null,
    note: "",
    updatedAt: null,
    updatedBy: null,
  }
}

export function emptyNetworkAnswer(): DigitalPresenceNetworkAnswer {
  return {
    followers: null,
    lastPostedOn: null,
    unavailable: false,
    updatedAt: null,
    updatedBy: null,
  }
}

export function emptyDigitalPresenceReview(): DigitalPresenceReview {
  return {
    identity: emptyIdentity(),
    networks: {},
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readNote(value: unknown): string {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  if (trimmed.length <= DIGITAL_PRESENCE_REVIEW_NOTE_MAX) return trimmed
  return trimmed.slice(0, DIGITAL_PRESENCE_REVIEW_NOTE_MAX)
}

function readIdentityVerdict(
  value: unknown,
): DigitalPresenceIdentityVerdict | null {
  if (value === "ok" || value === "issue") return value
  return null
}

function readFollowers(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "number" || !Number.isInteger(value)) return null
  if (value < 0 || value > DIGITAL_PRESENCE_FOLLOWERS_MAX) return null
  return value
}

function readLastPostedOn(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!isCivilDate(trimmed)) return null
  return trimmed
}

function readNetwork(
  value: unknown,
): DigitalPresenceNetworkAnswer | null {
  const row = objectRecord(value)
  if (!row) return null
  const unavailable = row.unavailable === true
  if (unavailable) {
    return {
      followers: null,
      lastPostedOn: null,
      unavailable: true,
      updatedAt: asString(row.updatedAt),
      updatedBy: asString(row.updatedBy),
    }
  }

  let followers: number | null = null
  if (row.followers !== undefined && row.followers !== null) {
    followers = readFollowers(row.followers)
    if (followers === null) return null
  }

  let lastPostedOn: string | null = null
  if (
    row.lastPostedOn !== undefined &&
    row.lastPostedOn !== null &&
    row.lastPostedOn !== ""
  ) {
    lastPostedOn = readLastPostedOn(row.lastPostedOn)
    if (lastPostedOn === null) return null
  }

  return {
    followers,
    lastPostedOn,
    unavailable: false,
    updatedAt: asString(row.updatedAt),
    updatedBy: asString(row.updatedBy),
  }
}

export function isNetworkAnswerFilled(
  answer: DigitalPresenceNetworkAnswer,
): boolean {
  if (answer.unavailable) return true
  return answer.followers !== null && answer.lastPostedOn !== null
}

export function readDigitalPresenceReview(
  value: unknown,
): DigitalPresenceReview {
  const review = emptyDigitalPresenceReview()
  const row = objectRecord(value)
  if (!row) return review

  const identity = objectRecord(row.identity)
  if (identity) {
    review.identity = {
      verdict: readIdentityVerdict(identity.verdict),
      note: readNote(identity.note),
      updatedAt: asString(identity.updatedAt),
      updatedBy: asString(identity.updatedBy),
    }
  }

  const networks = objectRecord(row.networks)
  if (networks) {
    for (const [channelId, item] of Object.entries(networks)) {
      if (!channelId.trim()) continue
      const parsed = readNetwork(item)
      if (!parsed) continue
      review.networks[channelId] = parsed
    }
  }

  return review
}

export function digitalPresenceReviewDraft(
  review: DigitalPresenceReview,
): DigitalPresenceReview {
  const networks: Record<string, DigitalPresenceNetworkAnswer> = {}
  for (const [channelId, answer] of Object.entries(review.networks)) {
    networks[channelId] = {
      followers: answer.followers,
      lastPostedOn: answer.lastPostedOn,
      unavailable: answer.unavailable,
      updatedAt: null,
      updatedBy: null,
    }
  }
  return {
    identity: {
      verdict: review.identity.verdict,
      note: review.identity.note,
      updatedAt: null,
      updatedBy: null,
    },
    networks,
  }
}

export function serializeDigitalPresenceReviewDraft(
  review: DigitalPresenceReview,
): string {
  const networks: Record<
    string,
    {
      followers: number | null
      lastPostedOn: string | null
      unavailable: boolean
    }
  > = {}
  for (const [channelId, answer] of Object.entries(review.networks)) {
    networks[channelId] = {
      followers: answer.followers,
      lastPostedOn: answer.lastPostedOn,
      unavailable: answer.unavailable,
    }
  }
  return JSON.stringify({
    identity: {
      verdict: review.identity.verdict,
      note: review.identity.note,
    },
    networks,
  })
}

export function stampDigitalPresenceReview(
  review: DigitalPresenceReview,
  userId: string,
  updatedAt: string,
): DigitalPresenceReview {
  const networks: Record<string, DigitalPresenceNetworkAnswer> = {}
  for (const [channelId, answer] of Object.entries(review.networks)) {
    networks[channelId] = {
      followers: answer.followers,
      lastPostedOn: answer.lastPostedOn,
      unavailable: answer.unavailable,
      updatedAt,
      updatedBy: userId,
    }
  }
  return {
    identity: {
      verdict: review.identity.verdict,
      note: review.identity.note,
      updatedAt,
      updatedBy: userId,
    },
    networks,
  }
}

export function pruneDigitalPresenceNetworks(
  review: DigitalPresenceReview,
  channelIds: ReadonlyArray<string>,
): DigitalPresenceReview {
  const allowed = new Set(channelIds)
  const networks: Record<string, DigitalPresenceNetworkAnswer> = {}
  for (const [channelId, answer] of Object.entries(review.networks)) {
    if (!allowed.has(channelId)) continue
    networks[channelId] = answer
  }
  return { identity: review.identity, networks }
}

export function digitalPresenceIdentityOpportunityId(): string {
  return "review:identity"
}
