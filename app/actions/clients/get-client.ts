"use server"

import { z } from "zod"
import { requireCommercialMember } from "@/lib/auth/session"
import { canManageClientPortal, canViewClient } from "@/lib/clients/access"
import { buildPortalUrl } from "@/lib/clients/portal-session"
import { CLIENT_PORTAL_SELECT } from "@/lib/clients/types"
import {
  resolveAuditBaseline,
  type AuditBaseline,
} from "@/lib/leads/audit-baseline"
import { createClient } from "@/lib/supabase/server"
import { parseClientRow } from "@/lib/clients/parse"

export type ClientDetail = {
  id: string
  lead_id: string
  company_name: string
  closer_id: string | null
  closer_name: string | null
  converted_at: string
  stage: "initial"
  hasPortalAccess: boolean
  portalUrl: string | null
  portalGeneratedAt: string | null
  portalRotatedAt: string | null
  canManagePortal: boolean
  canViewClient: boolean
  /**
   * Snapshots que servem de "antes". Um id nulo significa que aquela dimensão
   * não tinha coleta até a conversão — a interface diz isso em vez de exibir
   * um comparativo falso.
   */
  baselineAt: string | null
  baseline: AuditBaseline
}

export type GetClientState =
  | { status: "success"; client: ClientDetail }
  | { status: "error"; message: string }

export async function getClient(clientId: string): Promise<GetClientState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = z.uuid().safeParse(clientId)
  if (!parsed.success) {
    return { status: "error", message: "Cliente inválido." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_PORTAL_SELECT)
    .eq("id", parsed.data)
    .maybeSingle()

  if (error) {
    return {
      status: "error",
      message: "Não foi possível carregar o cliente.",
    }
  }
  if (!data) {
    return { status: "error", message: "Cliente não encontrado." }
  }

  const record = parseClientRow(data)
  if (!record) {
    return { status: "error", message: "Cliente inválido." }
  }

  let closerName: string | null = null
  if (record.closer_id) {
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id, name")
      .eq("id", record.closer_id)
      .maybeSingle()
    if (profileError) {
      return {
        status: "error",
        message: "Não foi possível carregar o cliente.",
      }
    }
    closerName = typeof profile?.name === "string" ? profile.name : null
  }

  const hasPortalAccess = Boolean(record.portal_slug && record.portal_code_hash)
  const canView = canViewClient(roles, user.id, record.closer_id)
  if (!canView) {
    return { status: "error", message: "Cliente não encontrado." }
  }
  const canManagePortal = canManageClientPortal(
    roles,
    user.id,
    record.closer_id,
  )

  return {
    status: "success",
    client: {
      id: record.id,
      lead_id: record.lead_id,
      company_name: record.company_name,
      closer_id: record.closer_id,
      closer_name: closerName,
      converted_at: record.converted_at,
      stage: record.stage,
      hasPortalAccess,
      portalUrl:
        canManagePortal && record.portal_slug
          ? await buildPortalUrl(record.portal_slug)
          : null,
      portalGeneratedAt: record.portal_code_generated_at,
      portalRotatedAt: record.portal_code_rotated_at,
      canManagePortal,
      canViewClient: canView,
      baselineAt: record.baseline_at,
      baseline: await resolveAuditBaseline(
        supabase,
        record.lead_id,
        record.baseline_at,
      ),
    },
  }
}
