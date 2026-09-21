/**
 * Cidade do briefing → `location_code` da SERP. Puro.
 *
 * Existe porque a SERP aceita cidade e o Labs não, e porque a pesquisa inteira
 * depende de consultar a localidade certa: medido, a mesma busca com
 * `location_code` de Itu devolve local pack de 3 itens, e com o código do país
 * não devolve nenhum.
 *
 * Não importa `lib/br-locations` de propósito — aquele módulo usa alias, que
 * quebra o teste `.mjs`. Quem chama resolve a UF para o nome do estado e passa
 * pronto.
 *
 * **O estado é obrigatório.** A lista tem homônimos entre UFs, e casar só por
 * nome consultaria a SERP da cidade errada sem nada acusar.
 */

export type DataForSeoLocation = {
  location_code: number
  location_name: string
  location_type: string
  country_iso_code?: string
}

export type LocationMatch = {
  locationCode: number
  locationName: string
  /** `city` é o alvo; `state` é queda, e quem lê precisa saber a diferença. */
  granularity: "city" | "state"
}

function fold(value: string): string {
  return String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

/**
 * Parte o `location_name` em nome e estado.
 *
 * O formato tem três **ou quatro** segmentos: `Itu,State of Sao Paulo,Brazil`,
 * mas também `Manaus,Manaus,State of Amazonas,Brazil`, com a cidade repetida
 * dentro do próprio município. Por isso o estado é lido do **penúltimo**
 * segmento e nunca do índice 1.
 */
export function parseLocationName(
  locationName: string,
): { name: string; state: string } | null {
  const partes = String(locationName)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
  if (partes.length < 2) return null

  const estadoBruto = partes[partes.length - 2]
  const estado = estadoBruto.replace(/^state of\s+/i, "").trim()
  return { name: partes[0], state: estado }
}

/**
 * Acha o `location_code` de uma cidade.
 *
 * Prefere a entrada mais curta entre as candidatas: `Itu,State of Sao
 * Paulo,Brazil` ganha de uma variação com segmento a mais, porque a forma
 * canônica é a que o provedor usa como padrão.
 *
 * Devolve `null` quando não acha — e **não** o código do país. Cair para o país
 * em silêncio é o defeito que a auditoria já tem: a consulta funciona, não
 * acusa nada, e mede outro mercado.
 */
export function matchCityLocation(params: {
  city: string
  /** Nome do estado por extenso, ex. "São Paulo". Acento é indiferente. */
  stateName: string
  locations: DataForSeoLocation[]
}): LocationMatch | null {
  const alvoCidade = fold(params.city)
  const alvoEstado = fold(params.stateName)
  if (!alvoCidade || !alvoEstado) return null

  const candidatas: { loc: DataForSeoLocation; segmentos: number }[] = []

  for (const loc of params.locations) {
    if (loc.location_type !== "City") continue
    const partido = parseLocationName(loc.location_name)
    if (!partido) continue
    if (fold(partido.name) !== alvoCidade) continue
    if (fold(partido.state) !== alvoEstado) continue
    candidatas.push({
      loc,
      segmentos: loc.location_name.split(",").length,
    })
  }

  if (candidatas.length === 0) return null

  candidatas.sort((a, b) => a.segmentos - b.segmentos)
  const escolhida = candidatas[0].loc
  return {
    locationCode: escolhida.location_code,
    locationName: escolhida.location_name,
    granularity: "city",
  }
}

/**
 * Queda para o estado, quando a cidade não está na lista.
 *
 * É uma queda **explícita**, com `granularity: "state"`, para a tela poder
 * dizer que aquela cidade foi medida num raio maior. Silenciar isso faria o
 * relatório afirmar precisão que não existe.
 */
export function matchStateLocation(params: {
  stateName: string
  locations: DataForSeoLocation[]
}): LocationMatch | null {
  const alvo = fold(params.stateName)
  if (!alvo) return null

  for (const loc of params.locations) {
    if (loc.location_type !== "State") continue
    const partido = parseLocationName(loc.location_name)
    if (!partido) continue
    // Num `State`, o próprio nome é o estado: `State of Sao Paulo,Brazil`.
    const nome = partido.name.replace(/^state of\s+/i, "").trim()
    if (fold(nome) !== alvo) continue
    return {
      locationCode: loc.location_code,
      locationName: loc.location_name,
      granularity: "state",
    }
  }

  return null
}

export type ResolvedCity = {
  city: string
  stateCode: string
  match: LocationMatch | null
}

/**
 * Resolve todas as cidades de uma vez, preservando as que não casaram.
 *
 * Cidade sem código não vira erro da execução inteira: ela sai do plano de
 * coleta e aparece no relatório como não medida. Derrubar a pesquisa por uma
 * cidade de grafia incomum seria pior que entregar as outras.
 */
export function resolveCities(params: {
  cities: { name: string; stateCode: string; stateName: string }[]
  locations: DataForSeoLocation[]
  /** Aceita o estado quando a cidade não existe na lista do provedor. */
  fallbackToState?: boolean
}): ResolvedCity[] {
  return params.cities.map((cidade) => {
    const porCidade = matchCityLocation({
      city: cidade.name,
      stateName: cidade.stateName,
      locations: params.locations,
    })
    const match =
      porCidade ??
      (params.fallbackToState
        ? matchStateLocation({
            stateName: cidade.stateName,
            locations: params.locations,
          })
        : null)

    return { city: cidade.name, stateCode: cidade.stateCode, match }
  })
}
