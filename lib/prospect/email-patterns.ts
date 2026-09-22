/**
 * Padrões de e-mail do sócio no domínio da empresa — puro.
 *
 * Só roda quando o SDR pede a busca do dono, e só quando já existe (a) um
 * domínio da própria empresa e (b) um nome vindo do QSA, que é dado público da
 * Receita. Não há inferência sobre pessoa que não seja sócia, e nada é gerado
 * em domínio de terceiro — `joao@gmail.com` seria chute sobre um particular,
 * não endereço de trabalho.
 *
 * Os padrões estão na ordem em que aparecem em empresa brasileira pequena. A
 * ordem importa porque a verificação é paga por endereço: gerar dez e verificar
 * dez custa cinco vezes mais que gerar dez e verificar os dois primeiros que
 * existirem.
 */

import { foldText } from "./normalize.ts"

/** Quanto se acredita num endereço só gerado, antes de qualquer verificação. */
export const UNVERIFIED_EMAIL_CONFIDENCE = 25

/** Depois de a verificação dizer que a caixa existe. */
export const VERIFIED_EMAIL_CONFIDENCE = 70

export type EmailGuess = {
  email: string
  pattern: string
  /** Posição na ordem de probabilidade. Zero é o mais provável. */
  rank: number
}

function partesDoNome(nome: string): { first: string; last: string } | null {
  const palavras = foldText(nome)
    .split(" ")
    .filter((p) => p.length > 1)
    // Preposições não entram em e-mail corporativo brasileiro.
    .filter((p) => !["da", "de", "do", "das", "dos", "e"].includes(p))
  if (palavras.length === 0) return null
  const first = palavras[0]
  const last = palavras.length > 1 ? palavras[palavras.length - 1] : ""
  return { first, last }
}

/**
 * Os endereços plausíveis para esta pessoa neste domínio.
 *
 * Sem sobrenome, só as formas que dependem do primeiro nome — inventar um
 * sobrenome geraria endereço de outra pessoa.
 */
export function emailGuesses(
  fullName: string,
  domain: string,
  limit = 6,
): EmailGuess[] {
  const partes = partesDoNome(fullName)
  if (!partes) return []
  const d = domain.trim().toLowerCase().replace(/^www\./, "")
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) return []

  const { first, last } = partes
  const formas: Array<{ local: string; pattern: string }> = [
    { local: first, pattern: "primeiro" },
  ]
  if (last) {
    formas.push(
      { local: `${first}.${last}`, pattern: "primeiro.ultimo" },
      { local: `${first[0]}${last}`, pattern: "inicial+ultimo" },
      { local: `${first}${last}`, pattern: "primeiroultimo" },
      { local: `${first}_${last}`, pattern: "primeiro_ultimo" },
      { local: last, pattern: "ultimo" },
    )
  }

  const vistos = new Set<string>()
  const saida: EmailGuess[] = []
  for (const forma of formas) {
    if (saida.length >= limit) break
    const email = `${forma.local}@${d}`
    if (vistos.has(email)) continue
    vistos.add(email)
    saida.push({ email, pattern: forma.pattern, rank: saida.length })
  }
  return saida
}

/**
 * Caixas genéricas da empresa.
 *
 * Não são de ninguém em particular, e por isso valem menos como "contato do
 * dono" — mas numa empresa de dois funcionários é o dono que lê. Ficam
 * separadas das inferências sobre a pessoa justamente para que a tela não as
 * apresente como tal.
 */
export const GENERIC_MAILBOXES = [
  "contato",
  "comercial",
  "atendimento",
  "vendas",
  "financeiro",
] as const

export function genericGuesses(domain: string): EmailGuess[] {
  const d = domain.trim().toLowerCase().replace(/^www\./, "")
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) return []
  return GENERIC_MAILBOXES.map((local, rank) => ({
    email: `${local}@${d}`,
    pattern: `genérico:${local}`,
    rank,
  }))
}
