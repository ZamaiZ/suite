/**
 * Chaves de junção da prospecção — puro, testável, sem rede.
 *
 * Todas as funções aqui existem porque **os dois lados de um match precisam ser
 * produzidos pelo mesmo código**. É o mesmo motivo de `lib/dataforseo/limits.ts`
 * não ter imports: chave normalizada de um lado só nunca casa, e a falha é
 * silenciosa — o match simplesmente não acontece, e ninguém descobre que a
 * culpa era do acento.
 */

import { digitsOnly, toStoredPhone } from "../br-documents.ts"

/* -------------------------------------------------------------------------- */
/*  Texto                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Mesma forma do `fold` de `lib/leads/segment-categories.ts`: NFD, remove as
 * marcas de acento, minúsculas, e colapsa tudo que não é letra ou número num
 * espaço só.
 */
export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

/**
 * Sufixos societários que não ajudam a distinguir empresa nenhuma.
 *
 * "OTICA DINIZ LTDA ME" e "Ótica Diniz" são a mesma coisa para um match por
 * nome, e manter o sufixo derruba a similaridade de trigram justamente nos
 * casos em que ela deveria subir.
 */
const CORPORATE_SUFFIXES = new Set([
  "ltda",
  "me",
  "epp",
  "eireli",
  "sa",
  "s a",
  "mei",
  "cia",
  "ei",
  "ss",
  "sociedade",
  "simples",
  "empresarial",
  "unipessoal",
])

export function stripCorporateSuffix(value: string): string {
  const words = foldText(value).split(" ").filter(Boolean)
  let mudou = true
  while (mudou && words.length > 1) {
    mudou = false
    // Dois em dois primeiro: `S/A` dobra para `s a`, e tirar só o `a` deixaria
    // um `s` solto grudado no nome.
    if (words.length > 2) {
      const par = `${words[words.length - 2]} ${words[words.length - 1]}`
      if (CORPORATE_SUFFIXES.has(par)) {
        words.splice(-2, 2)
        mudou = true
        continue
      }
    }
    if (CORPORATE_SUFFIXES.has(words[words.length - 1])) {
      words.pop()
      mudou = true
    }
  }
  return words.join(" ")
}

/** A chave que vai ao trigram. Nunca comparar nomes crus. */
export function nameKey(value: string): string {
  return stripCorporateSuffix(value)
}

/* -------------------------------------------------------------------------- */
/*  Telefone                                                                  */
/* -------------------------------------------------------------------------- */

export function phoneKey(value: string | null | undefined): string | null {
  if (!value) return null
  return toStoredPhone(value)
}

/**
 * As formas pelas quais o mesmo telefone pode estar gravado.
 *
 * A Receita guarda celular antigo **sem o nono dígito**: a portaria que o
 * tornou obrigatório é de 2016, e cadastro que não foi atualizado desde então
 * tem oito dígitos no local. Comparar só a forma canônica perderia exatamente
 * os cadastros velhos — que são a maioria dos que ainda não foram atualizados.
 *
 * Devolve sempre a forma recebida primeiro, e a variante depois.
 */
export function phoneVariants(e164: string | null): string[] {
  if (!e164) return []
  const digits = digitsOnly(e164)
  if (!digits.startsWith("55")) return [digits]
  const national = digits.slice(2)
  const ddd = national.slice(0, 2)
  const local = national.slice(2)
  const variants = new Set<string>([digits])

  // Onze dígitos começando em 9: existe a forma antiga, sem o nono.
  if (local.length === 9 && local.startsWith("9")) {
    variants.add(`55${ddd}${local.slice(1)}`)
  }
  // Oito dígitos começando em 6 a 9: é celular antigo, existe a forma nova.
  if (local.length === 8 && /^[6-9]/.test(local)) {
    variants.add(`55${ddd}9${local}`)
  }
  return [...variants]
}

/* -------------------------------------------------------------------------- */
/*  Endereço                                                                  */
/* -------------------------------------------------------------------------- */

export function zipKey(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = digitsOnly(value)
  return digits.length === 8 ? digits : null
}

/**
 * O número do logradouro, extraído do endereço de uma linha.
 *
 * O provedor devolve `"Av. Bartolomeu de Carlos, 230 PISO G1 - Jardim Flor da
 * Montanha, Guarulhos - SP, 07097-420"`. O que interessa é o `230`.
 *
 * Só o primeiro grupo de dígitos depois da primeira vírgula: pegar o último
 * traria o CEP, e pegar o maior traria o CEP também. `S/N` e ausência viram
 * `null` — comparar "sem número" com "sem número" casaria dois vizinhos
 * quaisquer.
 */
export function streetNumberFromAddress(
  address: string | null | undefined,
): string | null {
  if (!address) return null
  const afterComma = address.split(",").slice(1).join(",")
  const alvo = afterComma.length > 0 ? afterComma : address
  const match = alvo.match(/\b(\d{1,6})\b/)
  if (!match) return null
  const numero = match[1].replace(/^0+/, "")
  return numero.length > 0 ? numero : null
}

/* -------------------------------------------------------------------------- */
/*  Domínio e e-mail                                                          */
/* -------------------------------------------------------------------------- */

/**
 * O domínio sem `www.`, minúsculo, sem porta nem caminho.
 *
 * Existe separado de `normalizeWebsiteDomain` de `lib/leads/website.ts` porque
 * aquele é a chave de unicidade do lead e recusa o que não parece site de
 * empresa; aqui a entrada vem de HTML de terceiro e precisa aceitar mais.
 */
export function domainKey(value: string | null | undefined): string | null {
  if (!value) return null
  let host = value.trim().toLowerCase()
  if (!host) return null
  host = host.replace(/^[a-z]+:\/\//, "")
  host = host.split("/")[0] ?? ""
  host = host.split("?")[0] ?? ""
  host = host.split("@").pop() ?? ""
  host = host.split(":")[0] ?? ""
  host = host.replace(/^www\./, "")
  host = host.replace(/\.$/, "")
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null
  return host
}

export function emailKey(value: string | null | undefined): string | null {
  if (!value) return null
  const email = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(email)) return null
  return email
}

/**
 * Endereços que aparecem em HTML de terceiro e não são contato de ninguém.
 *
 * Sem esta lista, o primeiro e-mail achado em metade dos sites brasileiros
 * seria de um serviço de monitoramento ou do construtor de sites — e o SDR
 * mandaria proposta para o Sentry.
 */
const EMAIL_NOISE_DOMAINS = new Set([
  "sentry.io",
  "sentry-next.wixpress.com",
  "wixpress.com",
  "example.com",
  "example.org",
  "domain.com",
  "email.com",
  "sentry.wixpress.com",
  "godaddy.com",
  "squarespace.com",
  "wordpress.com",
  "elementor.com",
  "schema.org",
  "w3.org",
])

const EMAIL_NOISE_LOCAL = new Set([
  "noreply",
  "no-reply",
  "nao-responda",
  "naoresponda",
  "postmaster",
  "abuse",
  "webmaster@localhost",
])

export function isNoiseEmail(email: string): boolean {
  const key = emailKey(email)
  if (!key) return true
  const [local, host] = key.split("@")
  if (!local || !host) return true
  if (EMAIL_NOISE_DOMAINS.has(host)) return true
  if (EMAIL_NOISE_LOCAL.has(local)) return true
  // Endereço gerado por bundler: `abc123@2x.png`, `u003e@…`.
  if (/\.(png|jpe?g|gif|svg|webp|css|js)$/.test(host)) return true
  if (/^[0-9a-f]{16,}$/.test(local)) return true
  return false
}
