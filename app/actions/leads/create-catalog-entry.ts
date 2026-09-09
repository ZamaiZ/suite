"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { normalizeSegmentName, type LeadSegment } from "@/lib/leads/segments"
import { normalizeTagName, type LeadTag } from "@/lib/leads/tags"
import { createClient } from "@/lib/supabase/server"
import { ensureSegment } from "./sync-lead-segment"
import { ensureTags } from "./sync-lead-tags"

/**
 * Criação de catálogo pelo combobox, antes do save do lead.
 *
 * Antes, escolher "Criar «X»" só guardava o texto no formulário: o registro
 * acontecia no save, junto com o lead. Quem criava não via nada acontecer, o
 * item não entrava na lista, e se o formulário falhasse em outro campo a
 * criação se perdia.
 *
 * Nenhuma lógica de escrita nova: as duas ações embrulham `ensureSegment` e
 * `ensureTags`, que são as mesmas funções que o save usa.
 *
 * Devolvem `null` em falha, e o chamador mantém o que a pessoa digitou — o
 * caminho do save continua sendo a rede de segurança.
 */

export async function createLeadSegment(
  rawName: string,
): Promise<LeadSegment | null> {
  await requireCommercialMember()
  const name = normalizeSegmentName(rawName)
  if (!name) return null
  const supabase = await createClient()
  return ensureSegment(supabase, name)
}

export async function createLeadTag(rawName: string): Promise<LeadTag | null> {
  await requireCommercialMember()
  const name = normalizeTagName(rawName)
  if (!name) return null
  const supabase = await createClient()
  const tags = await ensureTags(supabase, [name])
  return tags?.[0] ?? null
}
