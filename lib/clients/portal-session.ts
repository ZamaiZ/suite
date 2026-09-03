import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies, headers } from "next/headers"
import { parseClientRow } from "@/lib/clients/parse"
import { CLIENT_PORTAL_SELECT, type ClientRecord } from "@/lib/clients/types"
import { createAdminClient } from "@/lib/supabase/admin"

const COOKIE_NAME = "client_portal"
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7

type PortalSessionPayload = {
  clientId: string
  version: number
}

function signingKey(): string | null {
  const pepper = process.env.CLIENT_PORTAL_PEPPER
  if (!pepper || pepper.trim().length === 0) return null
  return pepper
}

function sign(value: string, key: string): string {
  return createHmac("sha256", key).update(value).digest("base64url")
}

function encodeSession(payload: PortalSessionPayload, key: string): string {
  const body = `${payload.clientId}.${payload.version}`
  return `${body}.${sign(body, key)}`
}

function decodeSession(token: string, key: string): PortalSessionPayload | null {
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [clientId, versionRaw, mac] = parts
  if (!clientId || !versionRaw || !mac) return null
  const version = Number.parseInt(versionRaw, 10)
  if (!Number.isInteger(version) || version < 0) return null

  const body = `${clientId}.${version}`
  const expected = sign(body, key)
  const actualBuf = Buffer.from(mac)
  const expectedBuf = Buffer.from(expected)
  if (actualBuf.length !== expectedBuf.length) return null
  if (!timingSafeEqual(actualBuf, expectedBuf)) return null

  return { clientId, version }
}

export async function readPortalSession(): Promise<PortalSessionPayload | null> {
  const key = signingKey()
  if (!key) return null
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null
  return decodeSession(token, key)
}

export async function writePortalSession(
  payload: PortalSessionPayload,
): Promise<void> {
  const key = signingKey()
  if (!key) {
    throw new Error("CLIENT_PORTAL_PEPPER is not set.")
  }
  const store = await cookies()
  store.set(COOKIE_NAME, encodeSession(payload, key), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function clearPortalSession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

export type PortalClientContext = {
  client: ClientRecord
  admin: ReturnType<typeof createAdminClient>
}

export async function requirePortalClient(): Promise<
  | { status: "ok"; context: PortalClientContext }
  | { status: "unauthenticated" }
> {
  const session = await readPortalSession()
  if (!session) return { status: "unauthenticated" }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("clients")
    .select(CLIENT_PORTAL_SELECT)
    .eq("id", session.clientId)
    .maybeSingle()

  if (error || !data) return { status: "unauthenticated" }

  const client = parseClientRow(data)
  if (!client?.portal_code_hash) return { status: "unauthenticated" }
  if (client.portal_session_version !== session.version) {
    return { status: "unauthenticated" }
  }

  return { status: "ok", context: { client, admin } }
}

export async function buildPortalUrl(slug: string): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) {
    return new URL(`/b/${slug}`, configured).toString()
  }

  const headerStore = await headers()
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? null
  const proto = headerStore.get("x-forwarded-proto") ?? "http"
  if (!host) return `/b/${slug}`
  return `${proto}://${host}/b/${slug}`
}
