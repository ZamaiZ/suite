/**
 * A cascata do CNPJ — puro, sem rede.
 *
 * Achar o CNPJ de uma empresa a partir de um registro de mapa é inferência, e
 * inferência apresentada como fato é o único jeito de este recurso destruir
 * confiança. Todo resultado aqui carrega **método**, **motivo em português** e
 * **confiança**, e nada acima do limiar é gravado sem passar por aqui.
 *
 * Duas fontes hoje, e três reservadas:
 *
 *   cnpj_site        rodapé do site. Exato, grátis, auto-declarado.  Alcance
 *                    pequeno: só 21% a 40% das empresas têm site.
 *   serp_aggregator  busca dirigida. Alcance maior, precisão menor — e por
 *                    isso SEMPRE corroborado contra a ficha da Receita.
 *   receita_*        espelho da base pública, por telefone, CEP+número ou
 *                    nome. É o caminho de maior alcance, porque telefone vem
 *                    em 71% a 85% e CEP em 95% a 99%. Ainda não carregado.
 *
 * A corroboração é o coração do módulo: um CNPJ vindo de busca não vale nada
 * sozinho. O que o torna crível é a ficha dele bater com o que o mapa já dizia
 * — mesmo telefone, mesmo CEP, mesmo nome, mesma cidade.
 */

import {
  foldText,
  nameKey,
  phoneKey,
  phoneVariants,
  zipKey,
} from "./normalize.ts"
import type {
  ProspectIdentity,
  ProspectListing,
  TaxIdCandidate,
  TaxIdMethod,
} from "./types.ts"

/* -------------------------------------------------------------------------- */
/*  Similaridade                                                              */
/* -------------------------------------------------------------------------- */

function bigrams(value: string): Set<string> {
  const limpo = value.replace(/\s+/g, " ")
  const saida = new Set<string>()
  for (let i = 0; i < limpo.length - 1; i += 1) saida.add(limpo.slice(i, i + 2))
  return saida
}

/**
 * Dice sobre bigramas. Zero a um.
 *
 * Aproxima o `similarity` do `pg_trgm`, que é o que o espelho da Receita vai
 * usar do lado do banco. Não são idênticos — o Postgres usa trigramas com
 * padding —, e por isso o limiar daqui é conferido contra pares reais nos
 * testes, não copiado do outro lado.
 */
export function nameSimilarity(a: string, b: string): number {
  const x = nameKey(a)
  const y = nameKey(b)
  if (!x || !y) return 0
  if (x === y) return 1
  const bx = bigrams(x)
  const by = bigrams(y)
  if (bx.size === 0 || by.size === 0) return 0
  let comuns = 0
  for (const g of bx) if (by.has(g)) comuns += 1
  return (2 * comuns) / (bx.size + by.size)
}

/** Abaixo disso, dois nomes não são a mesma empresa. */
export const NAME_SIMILARITY_FLOOR = 0.45

/* -------------------------------------------------------------------------- */
/*  Pontuação                                                                 */
/* -------------------------------------------------------------------------- */

const BASE_BY_METHOD: Record<TaxIdMethod, number> = {
  // A própria empresa publicou. Não há inferência nenhuma.
  cnpj_site: 95,
  // Busca dirigida sozinha não prova nada; tudo vem da corroboração.
  serp_aggregator: 40,
  receita_phone: 70,
  receita_address: 65,
  receita_name: 30,
  manual: 100,
}

export type MatchSignal = { points: number; reason: string }

export type ScoredCandidate = TaxIdCandidate & {
  signals: MatchSignal[]
  /** Sinal que contradiz o match. Presente, a tela mostra junto. */
  conflicts: string[]
}

function sameStatus(identity: ProspectIdentity): boolean {
  const s = foldText(identity.registrationStatus ?? "")
  return s.length === 0 || s.includes("ativa")
}

/**
 * Quanto se acredita neste CNPJ para esta empresa.
 *
 * `identity` é a ficha que a consulta do CNPJ devolveu. Ela é o árbitro: sem
 * ela, um CNPJ vindo de busca é só um número que apareceu perto do nome certo
 * numa página de terceiro.
 */
export function scoreCandidate(
  listing: Pick<
    ProspectListing,
    "title" | "phoneE164" | "zip" | "streetNumber" | "city" | "domain"
  >,
  identity: ProspectIdentity,
  method: TaxIdMethod,
): ScoredCandidate {
  const signals: MatchSignal[] = []
  const conflicts: string[] = []
  let score = BASE_BY_METHOD[method]

  if (method === "cnpj_site") {
    signals.push({ points: 0, reason: "CNPJ publicado no site da empresa" })
  }

  /* Telefone — o sinal mais forte que existe depois do auto-declarado. */
  const doMapa = phoneVariants(listing.phoneE164)
  const daReceita = new Set(
    identity.phones.flatMap((p) => phoneVariants(phoneKey(p))),
  )
  if (doMapa.length > 0 && daReceita.size > 0) {
    if (doMapa.some((v) => daReceita.has(v))) {
      score += 30
      signals.push({ points: 30, reason: "telefone confere" })
    } else {
      // Não é contradição forte: o telefone da Receita é cadastro, não é
      // comercial, e envelhece. Mas também não ajuda.
      conflicts.push("telefone diferente do cadastro")
    }
  }

  /* Endereço. */
  const cepMapa = zipKey(listing.zip)
  const cepFicha = zipKey(identity.zip)
  if (cepMapa && cepFicha) {
    if (cepMapa === cepFicha) {
      score += 15
      signals.push({ points: 15, reason: "CEP confere" })
      // O número só é comparado quando os dois lados são numéricos: a Receita
      // guarda `S/N`, e casar "sem número" com "sem número" aproximaria dois
      // vizinhos quaisquer.
      if (
        listing.streetNumber &&
        identity.streetNumber &&
        listing.streetNumber === identity.streetNumber
      ) {
        score += 10
        signals.push({ points: 10, reason: "número confere" })
      }
    } else {
      conflicts.push("CEP diferente do cadastro")
    }
  }

  /* Nome. */
  const nomes = [identity.legalName, identity.tradeName].filter(
    (n): n is string => typeof n === "string" && n.length > 0,
  )
  const melhor = nomes.reduce(
    (max, n) => Math.max(max, nameSimilarity(listing.title, n)),
    0,
  )
  if (melhor >= 0.9) {
    score += 20
    signals.push({ points: 20, reason: "razão social confere" })
  } else if (melhor >= NAME_SIMILARITY_FLOOR) {
    const pts = Math.round(melhor * 15)
    score += pts
    signals.push({
      points: pts,
      reason: `nome parecido (${melhor.toFixed(2)})`,
    })
  } else if (nomes.length > 0 && method !== "cnpj_site") {
    // No CNPJ do rodapé o nome divergir é normal: MEI tem o nome civil da
    // pessoa na razão social, e a placa da loja é outra coisa. Em match vindo
    // de busca é o contrário — nome que não bate é o principal sinal de que a
    // página do agregador falava de outra empresa, e por isso pesa contra.
    score -= 20
    conflicts.push("nome não se parece com a razão social")
  }

  /* Cidade — rede de segurança. */
  if (listing.city && identity.city) {
    if (foldText(identity.city) === foldText(listing.city)) {
      score += 5
      signals.push({ points: 5, reason: "mesma cidade" })
    } else {
      // Peso alto e negativo de propósito. Empresa de outra cidade não é a
      // empresa da campanha, por mais que o nome se pareça — e nome parecido
      // em cidade diferente é o erro mais comum de busca por agregador.
      score -= 40
      conflicts.push("cadastro é de outra cidade")
    }
  }

  /* Domínio do e-mail da Receita. */
  if (listing.domain && identity.emails.length > 0) {
    const bate = identity.emails.some((e) =>
      e.toLowerCase().endsWith(`@${listing.domain}`),
    )
    if (bate) {
      score += 15
      signals.push({ points: 15, reason: "e-mail do cadastro usa o domínio do site" })
    }
  }

  /* Situação cadastral. */
  if (!sameStatus(identity)) {
    score -= 25
    conflicts.push(`situação cadastral: ${identity.registrationStatus}`)
  }

  /*
   * Nome sozinho nunca confirma.
   *
   * No Brasil a mesma placa existe em toda cidade: franquia, homônimo e rede
   * dividem razão social parecida. Um CNPJ vindo de busca que casa só pelo
   * nome, sem telefone, sem CEP e sem cidade, é exatamente o caso em que o
   * agregador devolveu a unidade de outro município — e é o erro mais comum
   * desta fonte.
   *
   * O teto de 55 mantém o candidato visível na gaveta da ficha e fora do
   * card, onde o SDR decide.
   */
  const CORROBORACAO_DE_LUGAR = new Set([
    "telefone confere",
    "CEP confere",
    "mesma cidade",
    "e-mail do cadastro usa o domínio do site",
  ])
  const temCorroboracao = signals.some((s) =>
    CORROBORACAO_DE_LUGAR.has(s.reason),
  )
  if (method === "serp_aggregator" && !temCorroboracao) {
    score = Math.min(score, 55)
  }

  const confidence = Math.max(0, Math.min(100, Math.round(score)))
  const reason =
    signals
      .filter((s) => s.points > 0)
      .map((s) => s.reason)
      .join(" · ") ||
    signals[0]?.reason ||
    "sem corroboração"

  return {
    taxId: identity.taxId,
    method,
    confidence,
    reason,
    legalName: identity.legalName,
    signals,
    conflicts,
  }
}

/* -------------------------------------------------------------------------- */
/*  Ambiguidade                                                               */
/* -------------------------------------------------------------------------- */

/** Dois candidatos a menos disto um do outro: não dá para escolher. */
export const AMBIGUITY_MARGIN = 10

/** Teto da confiança quando o match é ambíguo. */
export const AMBIGUOUS_CONFIDENCE = 49

export type MatchOutcome = {
  /** O escolhido, ou `null` quando é ambíguo ou fraco demais. */
  best: ScoredCandidate | null
  /** Todos, ordenados. A tela mostra numa gaveta quando não há vencedor. */
  candidates: ScoredCandidate[]
  ambiguous: boolean
  /** Alimenta o `found` da fila: assentou e achou? */
  found: boolean
}

/**
 * Escolhe entre candidatos — ou recusa escolher.
 *
 * **Ambiguidade é resultado de primeira classe.** Dois candidatos empatados
 * não viram "o de maior pontuação": viram uma pergunta para o SDR, com a
 * confiança travada abaixo do limiar de exibição. O contrário produziria uma
 * ficha de empresa com sócios e capital social de outra companhia — e ninguém
 * confere o que a tela afirma com segurança.
 */
export function rankCandidates(candidates: ScoredCandidate[]): MatchOutcome {
  if (candidates.length === 0) {
    return { best: null, candidates: [], ambiguous: false, found: false }
  }

  const ordenados = [...candidates].sort((a, b) => b.confidence - a.confidence)
  const primeiro = ordenados[0]
  const segundo = ordenados[1]

  const ambiguous =
    segundo !== undefined &&
    primeiro.taxId !== segundo.taxId &&
    primeiro.confidence - segundo.confidence < AMBIGUITY_MARGIN

  if (ambiguous) {
    const travados = ordenados.map((c) => ({
      ...c,
      confidence: Math.min(c.confidence, AMBIGUOUS_CONFIDENCE),
    }))
    return { best: null, candidates: travados, ambiguous: true, found: false }
  }

  return {
    best: primeiro,
    candidates: ordenados,
    ambiguous: false,
    found: true,
  }
}

/* -------------------------------------------------------------------------- */
/*  Como a confiança vira tela                                                */
/* -------------------------------------------------------------------------- */

export type ConfidenceBand = "confirmed" | "likely" | "uncertain" | "none"

/**
 * A faixa manda em onde o CNPJ pode aparecer.
 *
 *   confirmed  ≥ 80  badge de sucesso, CNPJ no card
 *   likely     60-79 badge de atenção, com a palavra "provável"
 *   uncertain  40-59 só dentro da ficha, na gaveta de candidatos
 *   none       < 40  a tela diz "CNPJ não localizado"
 */
export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 80) return "confirmed"
  if (confidence >= 60) return "likely"
  if (confidence >= 40) return "uncertain"
  return "none"
}

export const CONFIDENCE_BAND_LABEL: Record<ConfidenceBand, string> = {
  confirmed: "CNPJ confirmado",
  likely: "CNPJ provável",
  uncertain: "CNPJ incerto",
  none: "CNPJ não localizado",
}

/**
 * A máquina pode gravar isto como verdade?
 *
 * Só o CNPJ que a própria empresa publicou no site. Todo o resto espera o
 * veredito humano em `prospect_reviews` — inclusive um match de 85 pontos por
 * busca corroborada, porque 85 pontos continuam sendo uma inferência nossa.
 */
export function canAutoConfirm(candidate: ScoredCandidate | null): boolean {
  if (!candidate) return false
  return candidate.method === "cnpj_site" && candidate.confidence >= 90
}
