import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto"

export const FIXED_SECRET_KINDS = [
  "wordpress",
  "hosting_domain",
  "domain",
] as const

export type FixedSecretKind = (typeof FIXED_SECRET_KINDS)[number]

export type BriefingSecretKind = FixedSecretKind | `other:${string}`

export type EncryptedSecret = {
  ciphertext: string
  iv: string
}

function resolveSecretsKey(): Buffer {
  const raw = process.env.BRIEFING_SECRETS_KEY?.trim()
  if (!raw) {
    throw new Error("BRIEFING_SECRETS_KEY is not set")
  }
  const asBase64 = Buffer.from(raw, "base64")
  if (asBase64.length === 32) return asBase64
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex")
  return createHash("sha256").update(raw, "utf8").digest()
}

export function isSecretsKeyConfigured(): boolean {
  return Boolean(process.env.BRIEFING_SECRETS_KEY?.trim())
}

export function otherSecretKind(itemId: string): BriefingSecretKind {
  return `other:${itemId}`
}

export function isBriefingSecretKind(
  value: unknown,
): value is BriefingSecretKind {
  if (typeof value !== "string" || value.length === 0 || value.length > 120) {
    return false
  }
  if ((FIXED_SECRET_KINDS as readonly string[]).includes(value)) return true
  if (!value.startsWith("other:")) return false
  const itemId = value.slice("other:".length)
  return itemId.length > 0 && itemId.length <= 80
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  const key = resolveSecretsKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return {
    ciphertext: Buffer.concat([encrypted, tag]).toString("base64"),
    iv: iv.toString("base64"),
  }
}

export function decryptSecret(ciphertext: string, iv: string): string {
  const key = resolveSecretsKey()
  const packed = Buffer.from(ciphertext, "base64")
  if (packed.length <= 16) {
    throw new Error("Invalid ciphertext")
  }
  const data = packed.subarray(0, packed.length - 16)
  const tag = packed.subarray(packed.length - 16)
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64"),
  )
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  )
}
