/**
 * As buscas dirigidas das etapas pagas — puras.
 *
 * Cada função aqui gasta dinheiro quando executada, e é por isso que o texto
 * da busca é decidido num módulo testável em vez de montado com template
 * string dentro da action: busca mal formada não falha, ela devolve resultado
 * errado pelo mesmo preço.
 */

import { foldText } from "./normalize.ts"
import type { ProspectPartner } from "./types.ts"

/** Guarulhos e São Paulo viram nomes idênticos sem isto. */
function limpo(value: string): string {
  return value.replace(/["\n\r]+/g, " ").trim()
}

/**
 * Onde procurar o CNPJ de uma empresa que não o publica no site.
 *
 * Aspas no nome e na cidade: sem elas o buscador relaxa os termos e devolve a
 * franquia de outro município, que é o erro mais comum desta fonte — e o que
 * o matcher depois gasta pontos para derrubar.
 *
 * Telefone quando existe, porque é a chave que os agregadores indexam e a
 * única que não tem homônimo.
 */
export function taxIdQuery(input: {
  title: string
  city: string | null
  phoneE164: string | null
}): string {
  const partes = [`"${limpo(input.title)}"`]
  if (input.city) partes.push(`"${limpo(input.city)}"`)
  if (input.phoneE164) {
    // Sem o DDI: nenhum agregador brasileiro publica telefone com 55 na frente.
    const nacional = input.phoneE164.replace(/^55/, "")
    partes.push(`"${nacional}"`)
  }
  partes.push("CNPJ")
  return partes.join(" ")
}

/**
 * O perfil da empresa nas redes.
 *
 * Uma busca só para Instagram e outra para LinkedIn seria dobrar o custo de
 * uma etapa que roda em lote. O `site:` com alternativa cobre as duas.
 */
export function socialQuery(input: {
  title: string
  city: string | null
}): string {
  const cidade = input.city ? ` "${limpo(input.city)}"` : ""
  return `"${limpo(input.title)}"${cidade} (site:instagram.com OR site:linkedin.com/company)`
}

/**
 * O perfil público do sócio.
 *
 * Roda **só** quando o SDR pede, e só sobre nome que veio do QSA — dado que a
 * Receita publica. Sempre amarrada ao nome da empresa: sem isso, "João Silva"
 * devolve dez mil pessoas e o SDR abordaria um estranho.
 */
export function personQuery(input: {
  partnerName: string
  companyName: string
  city: string | null
}): string {
  const cidade = input.city ? ` "${limpo(input.city)}"` : ""
  return `"${limpo(input.partnerName)}" "${limpo(input.companyName)}"${cidade} (site:linkedin.com/in OR site:instagram.com)`
}

/**
 * Qual sócio procurar quando há mais de um.
 *
 * Quem administra, e não quem tem mais quota: é o administrador que decide
 * contratar agência. Empate resolve pelo mais antigo, que costuma ser o
 * fundador.
 */
export function primaryPartner(
  partners: ProspectPartner[],
): ProspectPartner | null {
  const pessoas = partners.filter((p) => !p.isCompany)
  if (pessoas.length === 0) return null

  const peso = (p: ProspectPartner) => {
    const q = foldText(p.qualification ?? "")
    if (q.includes("administrador")) return 3
    if (q.includes("presidente") || q.includes("diretor")) return 2
    if (q.includes("socio")) return 1
    return 0
  }

  return [...pessoas].sort((a, b) => {
    const d = peso(b) - peso(a)
    if (d !== 0) return d
    const da = a.since ? Date.parse(a.since) : Number.MAX_SAFE_INTEGER
    const db = b.since ? Date.parse(b.since) : Number.MAX_SAFE_INTEGER
    return da - db
  })[0]
}

/**
 * Os CNPJs que aparecem num resultado de busca.
 *
 * Os agregadores põem o CNPJ no título ou no trecho — `"Empresa X - CNPJ
 * 11.222.333/0001-81"`. Validar o dígito verificador é o que separa isso de
 * um telefone com DDI colado num CEP.
 */
export function taxIdsFromSerpText(
  text: string,
  isValid: (value: string) => boolean,
): string[] {
  const achados: string[] = []
  const vistos = new Set<string>()
  const re = /\b\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2}\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const digits = m[0].replace(/\D/g, "")
    if (digits.length !== 14 || !isValid(digits)) continue
    if (vistos.has(digits)) continue
    vistos.add(digits)
    achados.push(digits)
  }
  return achados
}

/** Perfis sociais que aparecem num resultado de busca. */
export function socialFromSerpUrl(
  url: string,
): { kind: "instagram" | "linkedin"; key: string } | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const partes = parsed.pathname.split("/").filter(Boolean)
  if (/(^|\.)instagram\.com$/i.test(parsed.hostname)) {
    const slug = partes[0]
    if (!slug || ["p", "reel", "reels", "explore", "tv"].includes(slug)) {
      return null
    }
    return { kind: "instagram", key: slug.toLowerCase() }
  }
  if (/(^|\.)linkedin\.com$/i.test(parsed.hostname)) {
    if (partes[0] !== "company" && partes[0] !== "in") return null
    const slug = partes[1]
    if (!slug) return null
    return { kind: "linkedin", key: slug.toLowerCase() }
  }
  return null
}
