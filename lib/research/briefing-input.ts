/**
 * Briefing → entrada validada da pesquisa. Puro.
 *
 * O briefing é a **fonte de verdade** da Fase 3, e é editável: o profissional
 * corrige depois da reunião. Este módulo é o portão — ele decide se o briefing
 * está em condição de virar pesquisa, e **recusa dizendo o motivo** quando não
 * está.
 *
 * O portão existe por um valor medido: `targetCities: ["Todas"]` e
 * `targetNeighborhoods: ["Todos"]` são aceitos pelo cadastro hoje e **não
 * geram combo nenhum**. Uma pesquisa disparada sobre isso gastaria a fase
 * inteira para descobrir no fim que não havia localidade para cruzar.
 *
 * **Bairro ausente não é erro.** Cidade é a essência do SEO local e quase
 * sempre existe; bairro é raro. O eixo existe sempre no modelo, e o custo só
 * aparece quando há dado.
 *
 * O que este módulo **não** faz: resolver `serpLocationCode`. Isso exige
 * consultar a tabela de localidades da SERP, que é chamada de rede — as
 * cidades saem daqui com `null` e a resolução acontece na camada que coleta.
 */

import type {
  ResearchCity,
  ResearchInput,
  ResearchNeighborhood,
} from "./types.ts"

/** Teto imposto no cadastro. São **seeds**, não o conjunto final. */
export const MAX_SEEDS = 50

export type RefusalCode =
  | "sem_fingerprint"
  | "sem_keyword_principal"
  | "sem_keywords"
  | "excesso_de_keywords"
  | "sem_cidade"
  | "cidades_nao_enumeradas"
  | "bairros_nao_enumerados"

export type WarningCode =
  | "keyword_principal_ausente_da_lista"
  | "bairro_sem_cidade_declarada"

export type Refusal = {
  code: RefusalCode
  message: string
  /** Os valores que causaram a recusa, para a tela poder apontar. */
  values?: string[]
}

export type Warning = {
  code: WarningCode
  message: string
  values?: string[]
}

export type BriefingInputResult =
  | { status: "ok"; input: ResearchInput; warnings: Warning[] }
  | { status: "refused"; refusals: Refusal[] }

/* -------------------------------------------------------------------------- */
/*  Leitura defensiva — o payload vem de jsonb e pode ter qualquer coisa      */
/* -------------------------------------------------------------------------- */

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(asText).filter(Boolean)
}

/** Minúsculas, sem acento, espaços colapsados. Só para comparar. */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

/**
 * Valores que o cadastro aceita mas que não são localidade enumerada.
 *
 * `brasil` está aqui de propósito: para SEO local, "Brasil" não produz o combo
 * `{serviço} em {cidade}` que a fase existe para medir. Cliente de alcance
 * nacional não é caso desta fase.
 */
const NAO_ENUMERADO = new Set([
  "todas",
  "todos",
  "toda",
  "todo",
  "todas as cidades",
  "todas as regioes",
  "todas as areas",
  "todos os bairros",
  "qualquer",
  "qualquer cidade",
  "qualquer bairro",
  "geral",
  "o mundo",
  "mundo",
  "brasil",
  "todo o brasil",
  "nacional",
  "nenhum",
  "nenhuma",
  "n/a",
  "na",
  "-",
  "--",
])

function isNaoEnumerado(value: string): boolean {
  return NAO_ENUMERADO.has(fold(value))
}

/** Dedup preservando a primeira grafia vista. */
function dedupe(values: string[]): string[] {
  const vistos = new Set<string>()
  const saida: string[] = []
  for (const value of values) {
    const chave = fold(value)
    if (!chave || vistos.has(chave)) continue
    vistos.add(chave)
    saida.push(value)
  }
  return saida
}

/**
 * `Bairro (Cidade)` e `Bairro, Cidade` são as duas formas que aparecem quando
 * alguém precisa desambiguar à mão. O briefing não modela a associação
 * bairro→cidade, então ou ela vem embutida no texto, ou não vem.
 */
function splitNeighborhood(value: string): { name: string; city: string | null } {
  const parenteses = value.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  if (parenteses) {
    return { name: parenteses[1].trim(), city: parenteses[2].trim() }
  }
  const virgula = value.match(/^(.+?)\s*[,–-]\s*(.+)$/)
  if (virgula) {
    return { name: virgula[1].trim(), city: virgula[2].trim() }
  }
  return { name: value, city: null }
}

/* -------------------------------------------------------------------------- */
/*  O portão                                                                  */
/* -------------------------------------------------------------------------- */

export function buildResearchInput(params: {
  /** Payload do passo `audience` de `client_briefing_steps`. */
  audience: unknown
  /** Payload do passo `company`. */
  company: unknown
  /** De `client_briefing_exports.content_fingerprint`. */
  briefingFingerprint: string
}): BriefingInputResult {
  const audience = asRecord(params.audience)
  const company = asRecord(params.company)
  const refusals: Refusal[] = []
  const warnings: Warning[] = []

  const fingerprint = asText(params.briefingFingerprint)
  if (!fingerprint) {
    refusals.push({
      code: "sem_fingerprint",
      message:
        "A pesquisa precisa do fingerprint do briefing para saber, depois, se ficou defasada.",
    })
  }

  // --- keywords ---------------------------------------------------------------

  const principal = asText(audience.primaryKeyword)
  if (!principal) {
    refusals.push({
      code: "sem_keyword_principal",
      message:
        "Defina a palavra-chave principal no briefing. É ela que ancora a localidade do agrupamento.",
    })
  }

  let seeds = dedupe(asTextList(audience.keywords))

  // A principal fora da lista não é erro: entra na frente. O cadastro permite
  // as duas coisas, e exigir coerência aqui recusaria briefing preenchido.
  if (principal && !seeds.some((k) => fold(k) === fold(principal))) {
    seeds = [principal, ...seeds]
    warnings.push({
      code: "keyword_principal_ausente_da_lista",
      message:
        "A palavra-chave principal não estava na lista de palavras-chave e foi incluída.",
      values: [principal],
    })
  }

  if (seeds.length === 0) {
    refusals.push({
      code: "sem_keywords",
      message: "O briefing não tem palavras-chave. Elas são a semente da pesquisa.",
    })
  }

  if (seeds.length > MAX_SEEDS) {
    refusals.push({
      code: "excesso_de_keywords",
      message: `O briefing tem ${seeds.length} palavras-chave e o teto é ${MAX_SEEDS}.`,
    })
  }

  // --- cidades ----------------------------------------------------------------

  // Cascata, não união: `targetCities` manda sozinha quando tem cidade de
  // verdade. `servedAreas` e `city` são **resgate** para briefing antigo,
  // preenchido antes de a etapa de audiência existir.
  //
  // Unir as três estava errado e o teste pegou: a empresa pode ser sediada
  // numa cidade e atender outras — somar a sede à lista inventaria um alvo que
  // o profissional não pediu, e ainda o promoveria a principal.
  const alvo = dedupe(asTextList(audience.targetCities))
  const alvoEnumeradas = alvo.filter((c) => !isNaoEnumerado(c))

  let cidadesNomes: string[]
  let sentinelas: string[]

  if (alvoEnumeradas.length > 0) {
    cidadesNomes = alvoEnumeradas
    sentinelas = alvo.filter(isNaoEnumerado)
  } else {
    const resgate = dedupe(
      [...asTextList(company.servedAreas), asText(company.city)].filter(Boolean),
    )
    cidadesNomes = resgate.filter((c) => !isNaoEnumerado(c))
    sentinelas = dedupe([...alvo, ...resgate].filter(isNaoEnumerado))
  }

  if (cidadesNomes.length === 0) {
    if (sentinelas.length > 0) {
      refusals.push({
        code: "cidades_nao_enumeradas",
        message:
          "As cidades estão preenchidas com um valor genérico. Liste as cidades uma a uma — sem elas não há combo de localidade para pesquisar.",
        values: sentinelas,
      })
    } else {
      refusals.push({
        code: "sem_cidade",
        message:
          "O briefing não tem cidade. Cidade é a essência do SEO local e a pesquisa não roda sem ela.",
      })
    }
  }

  // --- bairros ----------------------------------------------------------------

  const bairrosBrutos = asTextList(audience.targetNeighborhoods)
  const bairrosSentinela = dedupe(bairrosBrutos.filter(isNaoEnumerado))
  const bairrosNomes = dedupe(bairrosBrutos.filter((b) => !isNaoEnumerado(b)))

  // Bairro ausente é o caso normal. Bairro preenchido com "Todos" é erro:
  // alguém quis dizer alguma coisa e o valor não diz nada.
  if (bairrosSentinela.length > 0 && bairrosNomes.length === 0) {
    refusals.push({
      code: "bairros_nao_enumerados",
      message:
        "Os bairros estão preenchidos com um valor genérico. Liste os bairros um a um, ou deixe o campo vazio — bairro é opcional.",
      values: bairrosSentinela,
    })
  }

  if (refusals.length > 0) return { status: "refused", refusals }

  // --- montagem ---------------------------------------------------------------

  const stateCode = asText(company.stateCode).toUpperCase()
  const cidadeDaEmpresa = asText(company.city)

  // A principal é a cidade da empresa quando ela está entre as alvo; senão, a
  // primeira da lista. É ela que dá a localidade do agrupamento temático.
  const indicePrincipal = cidadesNomes.findIndex(
    (c) => fold(c) === fold(cidadeDaEmpresa),
  )
  const posicaoPrincipal = indicePrincipal >= 0 ? indicePrincipal : 0

  const cities: ResearchCity[] = cidadesNomes.map((name, i) => ({
    name,
    stateCode,
    serpLocationCode: null,
    isPrimary: i === posicaoPrincipal,
  }))

  const cidadePrincipal = cities[posicaoPrincipal].name
  const semCidadeDeclarada: string[] = []

  const neighborhoods: ResearchNeighborhood[] = bairrosNomes.map((bruto) => {
    const { name, city } = splitNeighborhood(bruto)
    const casada = city
      ? cidadesNomes.find((c) => fold(c) === fold(city))
      : undefined
    if (!casada) semCidadeDeclarada.push(bruto)
    return { name, city: casada ?? cidadePrincipal }
  })

  // Só avisa quando havia mais de uma cidade para escolher: com uma cidade só,
  // a associação é óbvia e o aviso seria ruído.
  if (semCidadeDeclarada.length > 0 && cities.length > 1) {
    warnings.push({
      code: "bairro_sem_cidade_declarada",
      message: `O briefing não diz a que cidade estes bairros pertencem; foram associados a ${cidadePrincipal}. Use "Bairro (Cidade)" para desambiguar.`,
      values: semCidadeDeclarada,
    })
  }

  return {
    status: "ok",
    warnings,
    input: {
      primaryKeyword: principal,
      seeds,
      cities,
      neighborhoods,
      briefingFingerprint: fingerprint,
    },
  }
}
