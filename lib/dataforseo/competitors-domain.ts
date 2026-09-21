/**
 * Leitor de `competitors_domain`. **Puro.**
 *
 * Este endpoint é **segunda fonte**, não a primária, e a razão está medida:
 * para `leotintas.com.br` ele devolveu `instagram.com`, `facebook.com`,
 * `youtube.com`, `cnpj.biz`, `serasaexperian.com.br` — e **o próprio
 * `leotintas.com.br`** — entre os dez "concorrentes", sem nenhuma loja de tinta.
 *
 * A causa é estrutural, não deste cliente: ele parte do perfil orgânico do
 * alvo, e alvo que rankeia quase só para termo de marca tem por vizinhos rede
 * social, diretório e base de CNPJ. A filtragem mora em
 * `lib/research/competitor-sources.ts`; aqui só se lê o que veio.
 *
 * **Só país.** O Labs tem 94 localidades no mundo e uma para o Brasil; pedir
 * cidade devolve `40501 Invalid Field: 'location_code'`.
 */

export type CompetitorDomainMetric = {
  domain: string
  /** Posição média nas keywords em que os dois aparecem. */
  avgPosition: number | null
  /** Quantas keywords os dois disputam. É o sinal de proximidade real. */
  intersections: number | null
  etv: number | null
  pos1: number | null
  pos2to3: number | null
  pos4to10: number | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asTextOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null
  const texto = value.trim()
  return texto ? texto : null
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export function mapCompetitorsDomain(
  envelope: unknown,
): CompetitorDomainMetric[] {
  const raiz = asRecord(envelope)
  const tasks = Array.isArray(raiz?.tasks) ? raiz.tasks : []

  const saida: CompetitorDomainMetric[] = []
  const vistos = new Set<string>()

  for (const brutaTarefa of tasks) {
    const tarefa = asRecord(brutaTarefa)
    if (!tarefa) continue
    const statusCode = asNumberOrNull(tarefa.status_code)
    if (statusCode !== null && statusCode >= 40000) continue

    for (const brutoResultado of Array.isArray(tarefa.result)
      ? tarefa.result
      : []) {
      const resultado = asRecord(brutoResultado)
      const itens = Array.isArray(resultado?.items) ? resultado.items : []

      for (const bruto of itens) {
        const item = asRecord(bruto)
        if (!item) continue
        const domain = asTextOrNull(item.domain)
        if (!domain) continue

        const chave = domain.toLowerCase()
        if (vistos.has(chave)) continue
        vistos.add(chave)

        const organico = asRecord(asRecord(item.metrics)?.organic)

        saida.push({
          domain,
          avgPosition: asNumberOrNull(item.avg_position),
          intersections: asNumberOrNull(item.intersections),
          etv: asNumberOrNull(organico?.etv),
          pos1: asNumberOrNull(organico?.pos_1),
          pos2to3: asNumberOrNull(organico?.pos_2_3),
          pos4to10: asNumberOrNull(organico?.pos_4_10),
        })
      }
    }
  }

  return saida
}
