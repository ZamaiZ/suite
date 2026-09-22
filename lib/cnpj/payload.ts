/**
 * Leitura do payload da consulta pública de CNPJ — puro, testável.
 *
 * Separado do transporte pelo mesmo motivo de `lib/dataforseo/envelope.ts`:
 * aquele importa `server-only`, que lança fora do servidor, e isso torna o
 * parsing impossível de testar. Este módulo é o que decide o que a suite
 * afirma sobre uma empresa — e afirmar capital social errado é pior que não
 * afirmar nada.
 *
 * Forma medida em 2026-09-21 contra dois CNPJs reais. Três detalhes que a
 * documentação não diria e que quebram o parsing ingênuo:
 *
 *   - `capital_social` é **string em formato brasileiro**: `"120000000000,00"`.
 *     `Number()` nela devolve `NaN`, e `parseFloat` devolve 120000000000 —
 *     certo por acidente, errado em `"1.234,56"`.
 *   - `telefones` é `[{ ddd, numero, is_fax }]`, e o fax está misturado.
 *   - `QSA[].identificador_socio` é texto (`"Pessoa Física"`), não código.
 */

import { digitsOnly, isValidCnpj, toStoredPhone } from "../br-documents.ts"
import { emailKey, zipKey } from "../prospect/normalize.ts"
import type { ProspectIdentity, ProspectPartner } from "../prospect/types.ts"

function objeto(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function texto(value: unknown): string | null {
  if (typeof value !== "string") return null
  const t = value.trim()
  return t.length > 0 ? t : null
}

/**
 * Número em formato brasileiro: vírgula decimal, ponto de milhar.
 *
 * `"120000000000,00"` vale cento e vinte bilhões; `"1.234,56"` vale mil
 * duzentos e trinta e quatro. Ler com `Number()` devolve `NaN` no primeiro e
 * `1.234` no segundo — e o segundo erro é o perigoso, porque é um número
 * plausível que vai para a tela como capital social.
 */
export function parseBrNumber(value: unknown): number | null {
  const t = texto(value)
  if (t === null) {
    return typeof value === "number" && Number.isFinite(value) ? value : null
  }
  const normalizado = t.replace(/\./g, "").replace(",", ".")
  const n = Number(normalizado)
  return Number.isFinite(n) ? n : null
}

function dataIso(value: unknown): string | null {
  const t = texto(value)
  if (!t) return null
  const ms = Date.parse(t)
  if (Number.isNaN(ms)) return null
  const ano = new Date(ms).getUTCFullYear()
  if (ano < 1900 || ano > 2100) return null
  return new Date(ms).toISOString().slice(0, 10)
}

/** `"S"` / `"N"` / vazio. Vazio é "não informado", que não é "não". */
function simNao(value: unknown): boolean | null {
  const t = texto(value)?.toUpperCase()
  if (t === "S") return true
  if (t === "N") return false
  return null
}

function lerTelefones(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const saida: string[] = []
  for (const bruto of value) {
    const item = objeto(bruto)
    if (!item) continue
    // Fax não é canal de contato desde antes de este produto existir, e
    // discar para um faz o SDR ouvir o apito e desqualificar o lead.
    if (item.is_fax === true) continue
    const ddd = digitsOnly(texto(item.ddd) ?? "")
    const numero = digitsOnly(texto(item.numero) ?? "")
    if (!ddd || !numero) continue
    const e164 = toStoredPhone(`${ddd}${numero}`)
    if (e164 && !saida.includes(e164)) saida.push(e164)
  }
  return saida
}

function lerQsa(value: unknown): ProspectPartner[] {
  if (!Array.isArray(value)) return []
  const saida: ProspectPartner[] = []
  for (const bruto of value) {
    const item = objeto(bruto)
    if (!item) continue
    const name = texto(item.nome_socio)
    if (!name) continue
    const identificador = texto(item.identificador_socio) ?? ""
    saida.push({
      name,
      // O CPF vem mascarado da Receita e fica mascarado aqui. Não há caminho
      // de desmascaramento neste código, e não deve haver.
      maskedTaxId: texto(item.cnpj_cpf_socio),
      qualification: texto(item.qualificacao_socio),
      since: dataIso(item.data_entrada_sociedade),
      isCompany: /jur/i.test(identificador),
    })
    // `faixa_etaria` existe no payload e NÃO é carregada: é atributo pessoal
    // sem valor de prospecção, e guardar dado que não se usa só aumenta a
    // exposição.
  }
  return saida
}

function lerCnaes(value: unknown): Array<{ code: string; text: string }> {
  if (!Array.isArray(value)) return []
  const saida: Array<{ code: string; text: string }> = []
  for (const bruto of value) {
    const item = objeto(bruto)
    if (!item) continue
    if (item.is_principal === true) continue
    const code = texto(item.codigo)
    const text = texto(item.descricao)
    if (!code) continue
    saida.push({ code, text: text ?? "" })
  }
  return saida
}

function lerCnaePrincipal(
  cnaes: unknown,
  fallbackCode: unknown,
): { code: string; text: string } | null {
  if (Array.isArray(cnaes)) {
    for (const bruto of cnaes) {
      const item = objeto(bruto)
      if (item?.is_principal === true) {
        const code = texto(item.codigo)
        if (code) return { code, text: texto(item.descricao) ?? "" }
      }
    }
  }
  const code = texto(fallbackCode)
  return code ? { code, text: "" } : null
}

export function parseCnpjPayload(raw: unknown): ProspectIdentity | null {
  const body = objeto(raw)
  if (!body) return null

  const taxId = digitsOnly(texto(body.cnpj) ?? "")
  if (!isValidCnpj(taxId)) return null

  const email = emailKey(texto(body.email))

  return {
    taxId,
    legalName: texto(body.razao_social),
    tradeName: texto(body.nome_fantasia),
    shareCapital: parseBrNumber(body.capital_social),
    size: texto(body.porte_empresa),
    legalNature: texto(body.natureza_juridica),
    mainActivity: lerCnaePrincipal(body.cnaes, body.cnae_principal),
    secondaryActivities: lerCnaes(body.cnaes),
    registrationStatus: texto(body.situacao_cadastral),
    openedAt: dataIso(body.data_inicio_atividade),
    simples: simNao(body.opcao_simples),
    mei: simNao(body.opcao_mei),
    zip: zipKey(texto(body.cep)),
    // `"SN"` é ausência de número, e casar "sem número" com "sem número"
    // aproximaria dois vizinhos quaisquer.
    streetNumber: (() => {
      const n = texto(body.numero)
      if (!n) return null
      const digitos = digitsOnly(n).replace(/^0+/, "")
      return digitos.length > 0 ? digitos : null
    })(),
    city: texto(body.municipio),
    state: texto(body.uf),
    phones: lerTelefones(body.telefones),
    emails: email ? [email] : [],
    partners: lerQsa(body.QSA),
    sourceUpdatedAt: dataIso(body.data_situacao_cadastral),
  }
}
