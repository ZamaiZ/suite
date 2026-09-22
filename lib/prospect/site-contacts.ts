/**
 * O que o site da empresa entrega de graça — puro, sem rede.
 *
 * Recebe HTML já baixado e devolve contatos e CNPJ. A separação é a mesma de
 * `lib/dataforseo/envelope.ts`: o transporte é `server-only` e não se testa, o
 * parsing é puro e se testa contra HTML real.
 *
 * O CNPJ do rodapé é o achado mais valioso desta etapa: é **exato, gratuito e
 * auto-declarado pela própria empresa**, e por isso curto-circuita a cascata
 * inteira do matcher. O contrapeso, medido em 2026-09-21: só 21% a 40% das
 * empresas de um segmento local têm site, então esta etapa tem a maior
 * precisão e o menor alcance do funil.
 *
 * Trabalha sobre o HTML cru, e não sobre uma árvore. Página de empresa local é
 * frequentemente malformada, e o parser que engasga perde o rodapé — que é
 * justamente onde o CNPJ mora.
 */

import { isValidCnpj, digitsOnly } from "../br-documents.ts"
import {
  domainKey,
  emailKey,
  isNoiseEmail,
  phoneKey,
} from "./normalize.ts"
import type { ProspectContact } from "./types.ts"

export type SiteFindings = {
  /** CNPJs válidos achados na página, em ordem de aparição. */
  taxIds: string[]
  contacts: ProspectContact[]
  /** A página tinha algum sinal de contato? Alimenta o `found` da fila. */
  found: boolean
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
}

/** Texto visível, aproximado: some script, style e as tags. */
function visibleText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\s+/g, " ")
}

function hrefs(html: string): string[] {
  const saida: string[] = []
  const re = /href\s*=\s*["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) saida.push(decodeEntities(m[1].trim()))
  return saida
}

/* -------------------------------------------------------------------------- */
/*  CNPJ                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Aceita mascarado e cru, e valida o dígito verificador.
 *
 * A validação não é luxo: `00.000.000/0000-00` aparece em modelo de site, e
 * uma sequência de 14 dígitos é um telefone com DDI colado num CEP. Sem o
 * dígito verificador, o rodapé viraria uma fábrica de CNPJ inventado — e ele é
 * justamente a fonte que a cascata trata como certa.
 */
export function extractTaxIds(html: string): string[] {
  const texto = visibleText(html)
  const achados: string[] = []
  const vistos = new Set<string>()

  const mascarado = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g
  const cru = /(?<![\d.\-/])\d{14}(?![\d.\-/])/g

  for (const re of [mascarado, cru]) {
    let m: RegExpExecArray | null
    while ((m = re.exec(texto)) !== null) {
      const digits = digitsOnly(m[0])
      if (!isValidCnpj(digits)) continue
      if (vistos.has(digits)) continue
      vistos.add(digits)
      achados.push(digits)
    }
  }
  return achados
}

/* -------------------------------------------------------------------------- */
/*  Redes sociais                                                             */
/* -------------------------------------------------------------------------- */

const SOCIAL_PATTERNS: Array<{
  kind: ProspectContact["kind"]
  host: RegExp
  reserved: Set<string>
}> = [
  {
    kind: "instagram",
    host: /(?:^|\.)instagram\.com$/i,
    reserved: new Set(["p", "reel", "reels", "stories", "explore", "tv"]),
  },
  {
    kind: "linkedin",
    host: /(?:^|\.)linkedin\.com$/i,
    reserved: new Set(["feed", "sharing", "shareArticle", "login"]),
  },
  {
    kind: "facebook",
    host: /(?:^|\.)facebook\.com$/i,
    reserved: new Set(["sharer", "share", "dialog", "plugins", "tr"]),
  },
]

function socialFromHref(href: string): ProspectContact | null {
  let url: URL
  try {
    url = new URL(href, "https://exemplo.invalid")
  } catch {
    return null
  }
  if (url.hostname === "exemplo.invalid") return null

  for (const { kind, host, reserved } of SOCIAL_PATTERNS) {
    if (!host.test(url.hostname)) continue
    const partes = url.pathname.split("/").filter(Boolean)
    let slug = partes[0]
    // LinkedIn de empresa e de pessoa são dois níveis: `/company/x`, `/in/x`.
    if (kind === "linkedin" && (slug === "company" || slug === "in")) {
      slug = partes[1]
    }
    if (!slug || reserved.has(slug)) return null
    const key = slug.toLowerCase().replace(/^@/, "")
    if (key.length === 0) return null
    return {
      kind,
      value: url.toString(),
      key,
      source: "site",
      // O link está na página da própria empresa: é ela declarando o perfil.
      confidence: 90,
      evidence: href,
    }
  }
  return null
}

/* -------------------------------------------------------------------------- */
/*  WhatsApp                                                                  */
/* -------------------------------------------------------------------------- */

function whatsappFromHref(href: string): ProspectContact | null {
  const m = href.match(
    /(?:wa\.me|api\.whatsapp\.com\/send|web\.whatsapp\.com\/send)[/?]?[^"'\s]*/i,
  )
  if (!m) return null
  const numeroDireto = href.match(/wa\.me\/(\+?\d{10,15})/i)?.[1]
  const numeroParam = href.match(/[?&]phone=(\+?\d{10,15})/i)?.[1]
  const bruto = numeroDireto ?? numeroParam
  if (!bruto) return null
  const key = phoneKey(bruto)
  if (!key) return null
  return {
    kind: "whatsapp",
    value: `https://wa.me/${key}`,
    key,
    // WhatsApp publicado pela própria empresa é o canal mais quente que existe
    // numa prospecção local — é onde ela já atende cliente.
    source: "site",
    confidence: 95,
    evidence: href,
  }
}

/* -------------------------------------------------------------------------- */
/*  Extração                                                                  */
/* -------------------------------------------------------------------------- */

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const PHONE_RE = /\(?\b\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g

export function extractSiteContacts(
  html: string,
  options: { siteDomain?: string | null } = {},
): SiteFindings {
  const texto = visibleText(html)
  const links = hrefs(html)
  const contacts: ProspectContact[] = []
  const vistos = new Set<string>()

  const push = (contato: ProspectContact | null) => {
    if (!contato) return
    const dedupe = `${contato.kind}:${contato.key}`
    if (vistos.has(dedupe)) return
    vistos.add(dedupe)
    contacts.push(contato)
  }

  // WhatsApp e redes vêm dos links: o texto visível de um botão é "Fale
  // conosco", que não serve de chave.
  for (const href of links) {
    push(whatsappFromHref(href))
    push(socialFromHref(href))

    const mailto = href.match(/^mailto:([^?]+)/i)?.[1]
    if (mailto) {
      const key = emailKey(decodeURIComponent(mailto))
      if (key && !isNoiseEmail(key)) {
        push({
          kind: "email",
          value: key,
          key,
          source: "site",
          // `mailto:` é declaração explícita, vale mais que e-mail solto no
          // meio do texto.
          confidence: 90,
          evidence: href,
        })
      }
    }

    const tel = href.match(/^tel:(.+)/i)?.[1]
    if (tel) {
      const key = phoneKey(decodeURIComponent(tel))
      if (key) {
        push({
          kind: "phone",
          value: key,
          key,
          source: "site",
          confidence: 85,
          evidence: href,
        })
      }
    }
  }

  const proprio = domainKey(options.siteDomain ?? null)
  for (const bruto of texto.match(EMAIL_RE) ?? []) {
    const key = emailKey(bruto)
    if (!key || isNoiseEmail(key)) continue
    const host = key.split("@")[1]
    push({
      kind: "email",
      value: key,
      key,
      source: "site",
      // E-mail no domínio da própria empresa é quase certamente dela; num
      // domínio de terceiro pode ser do contador, do fornecedor ou do
      // desenvolvedor do site.
      confidence: proprio && host === proprio ? 80 : 55,
      evidence: null,
    })
  }

  for (const bruto of texto.match(PHONE_RE) ?? []) {
    const key = phoneKey(bruto)
    if (!key) continue
    push({
      kind: "phone",
      value: key,
      key,
      source: "site",
      // Telefone solto no texto é o dado mais ruidoso da página: CEP, CNPJ
      // quebrado e data batem no mesmo formato.
      confidence: 50,
      evidence: null,
    })
  }

  const taxIds = extractTaxIds(html)

  return {
    taxIds,
    contacts,
    found: taxIds.length > 0 || contacts.length > 0,
  }
}

/**
 * Caminhos que valem uma segunda requisição quando a home não entregou nada.
 *
 * Em site de empresa local o CNPJ quase nunca está na home: ele mora no
 * rodapé da página de contato, na política de privacidade ou nos termos. Mas
 * são poucos e escolhidos a dedo — `crawlWebsite` de `lib/website-audit/`
 * faria quinze requisições por site, o que para mil sites seriam quinze mil.
 */
export const SITE_CONTACT_PATHS = [
  "/contato",
  "/contato/",
  "/fale-conosco",
  "/sobre",
  "/quem-somos",
  "/politica-de-privacidade",
  "/termos-de-uso",
] as const

/** Junta o achado de várias páginas do mesmo site, sem repetir contato. */
export function mergeSiteFindings(parts: SiteFindings[]): SiteFindings {
  const contacts: ProspectContact[] = []
  const taxIds: string[] = []
  const vistoContato = new Set<string>()
  const vistoCnpj = new Set<string>()

  for (const parte of parts) {
    for (const c of parte.contacts) {
      const chave = `${c.kind}:${c.key}`
      if (vistoContato.has(chave)) continue
      vistoContato.add(chave)
      contacts.push(c)
    }
    for (const t of parte.taxIds) {
      if (vistoCnpj.has(t)) continue
      vistoCnpj.add(t)
      taxIds.push(t)
    }
  }

  return { taxIds, contacts, found: taxIds.length > 0 || contacts.length > 0 }
}
