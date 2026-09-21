/**
 * Leitor de `domain_intersection` — o keyword gap. **Puro.**
 *
 * A chamada é **par a par** (`target1` / `target2`), medido: não aceita vários
 * domínios de uma vez. Custa US$ 0,0132 por par, então multiplica por N
 * concorrentes de referência.
 *
 * Cada item traz os dois lados da mesma keyword — `first_domain_serp_element`
 * para o cliente e `second_domain_serp_element` para o concorrente —, e é essa
 * simetria que permite separar três coisas que costumam virar uma só:
 *
 * - **gap**: o concorrente rankeia e o cliente não;
 * - **disputa**: os dois rankeiam, e a posição diz quem ganha;
 * - **vantagem**: o cliente rankeia e o concorrente não.
 *
 * **O gap é nacional.** O Labs só aceita país, então keyword que sai daqui
 * **não pode virar cluster antes de passar pela SERP local** da Task 8 —
 * disputa nacional não implica disputa na cidade do cliente.
 */

export type IntersectionRow = {
  keyword: string
  searchVolume: number | null
  competition: string | null
  cpc: number | null
  /** Posição do cliente. `null` = não rankeia para esta keyword. */
  selfRank: number | null
  selfUrl: string | null
  /** Posição do concorrente. */
  competitorRank: number | null
  competitorUrl: string | null
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

export function mapDomainIntersection(envelope: unknown): IntersectionRow[] {
  const raiz = asRecord(envelope)
  const tasks = Array.isArray(raiz?.tasks) ? raiz.tasks : []

  const saida: IntersectionRow[] = []
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

        const dados = asRecord(item.keyword_data)
        const keyword = asTextOrNull(dados?.keyword)
        if (!keyword) continue

        const chave = keyword.toLowerCase()
        if (vistos.has(chave)) continue
        vistos.add(chave)

        const info = asRecord(dados?.keyword_info)
        const primeiro = asRecord(item.first_domain_serp_element)
        const segundo = asRecord(item.second_domain_serp_element)

        saida.push({
          keyword,
          searchVolume: asNumberOrNull(info?.search_volume),
          competition: asTextOrNull(info?.competition_level),
          cpc: asNumberOrNull(info?.cpc),
          selfRank: asNumberOrNull(primeiro?.rank_absolute),
          selfUrl: asTextOrNull(primeiro?.url),
          competitorRank: asNumberOrNull(segundo?.rank_absolute),
          competitorUrl: asTextOrNull(segundo?.url),
        })
      }
    }
  }

  return saida
}

/** O concorrente rankeia e o cliente não. É daqui que saem candidatas novas. */
export function gapRows(rows: IntersectionRow[]): IntersectionRow[] {
  return rows.filter((r) => r.competitorRank !== null && r.selfRank === null)
}

/**
 * Os dois rankeiam. Ordenado da **menor distância para a maior**, porque é ali
 * que um empurrão muda posição sem precisar de página nova.
 *
 * Cliente em 5 contra concorrente em 4 é uma posição de diferença; cliente em
 * 50 contra concorrente em 2 é outro projeto. Ordenar ao contrário colocaria o
 * caso mais caro no topo da lista de ações.
 */
export function contestedRows(rows: IntersectionRow[]): IntersectionRow[] {
  const distancia = (r: IntersectionRow) =>
    (r.selfRank ?? 0) - (r.competitorRank ?? 0)
  return rows
    .filter((r) => r.competitorRank !== null && r.selfRank !== null)
    .sort((a, b) => distancia(a) - distancia(b))
}

/** O cliente rankeia e o concorrente não. Vantagem a defender. */
export function advantageRows(rows: IntersectionRow[]): IntersectionRow[] {
  return rows.filter((r) => r.selfRank !== null && r.competitorRank === null)
}
