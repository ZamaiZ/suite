/**
 * Formas da prospecção. Puro, sem `server-only`, sem alias.
 *
 * Os tipos do banco são descritos à mão aqui, como em todo o resto do
 * repositório: não há `supabase gen types`, e a migration é a fonte de
 * verdade.
 */

export const PROSPECT_STAGES = [
  "site",
  "identity",
  "social",
  "person",
] as const

export type ProspectStage = (typeof PROSPECT_STAGES)[number]

export const PROSPECT_LIFECYCLE = [
  "discovered",
  "enriching",
  "enriched",
  "promoted",
  "dismissed",
] as const

export type ProspectLifecycle = (typeof PROSPECT_LIFECYCLE)[number]

export type CampaignStatus =
  | "draft"
  | "discovering"
  | "discovered"
  | "failed"

/** O que o provedor devolve por empresa, depois de mapeado. */
export type ProspectListing = {
  placeId: string | null
  cid: string | null
  title: string
  category: string | null
  categoryIds: string[]
  phoneRaw: string | null
  /** `55` + DDD + local, pela mesma função que o lead usa. */
  phoneE164: string | null
  domain: string | null
  url: string | null
  address: string | null
  /** Oito dígitos, sem máscara. Medido em 95% a 99% das amostras. */
  zip: string | null
  streetNumber: string | null
  city: string | null
  region: string | null
  latitude: number | null
  longitude: number | null
  rating: number | null
  votesCount: number | null
  isClaimed: boolean | null
  workTime: unknown
  attributes: unknown
  /**
   * Quando o provedor viu esta empresa pela última vez.
   *
   * Medido em 100% da amostra, com mediana de 88 dias e máximo de 925. É banco
   * de dados, não coleta ao vivo — e telefone de dois anos atrás apresentado
   * sem data é uma afirmação falsa sobre hoje.
   */
  listingUpdatedAt: string | null
  /** O payload cru, para remapear sem recomprar quando o mapeador mudar. */
  listing: Record<string, unknown>
}

/** Um contato achado, sempre com de onde veio e quanto se confia. */
export type ProspectContact = {
  kind: "email" | "phone" | "whatsapp" | "instagram" | "linkedin" | "facebook"
  value: string
  /** Chave normalizada, para dedupe e para o registro de descadastro. */
  key: string
  source: "listing" | "site" | "public_cnpj_api" | "serp" | "receita"
  /** 0 a 100. Nunca apresentar contato inferido como confirmado. */
  confidence: number
  /** Página ou consulta que trouxe o dado, quando há uma. */
  evidence?: string | null
}

/** Um sócio do quadro societário. CPF fica mascarado, sempre. */
export type ProspectPartner = {
  name: string
  /** `***XXXXXX**`, exatamente como a Receita publica. Nunca desmascarado. */
  maskedTaxId: string | null
  qualification: string | null
  since: string | null
  isCompany: boolean
}

/** O que a consulta de CNPJ traz. */
export type ProspectIdentity = {
  taxId: string
  legalName: string | null
  tradeName: string | null
  /** Em reais. É a pergunta "esse negócio tem dinheiro?". */
  shareCapital: number | null
  size: string | null
  legalNature: string | null
  mainActivity: { code: string; text: string } | null
  secondaryActivities: Array<{ code: string; text: string }>
  registrationStatus: string | null
  openedAt: string | null
  simples: boolean | null
  mei: boolean | null
  /**
   * Endereço do cadastro. É a segunda chave de corroboração depois do
   * telefone — e a de maior alcance, porque o CEP veio em 95% a 99% dos
   * registros do mapa.
   */
  zip: string | null
  streetNumber: string | null
  city: string | null
  state: string | null
  phones: string[]
  emails: string[]
  partners: ProspectPartner[]
  /** Data da fonte, para a tela nunca afirmar dado velho como de hoje. */
  sourceUpdatedAt: string | null
}

/** Como o CNPJ foi encontrado. A ordem é a da cascata. */
export const TAX_ID_METHODS = [
  "cnpj_site",
  "serp_aggregator",
  "receita_phone",
  "receita_address",
  "receita_name",
  "manual",
] as const

export type TaxIdMethod = (typeof TAX_ID_METHODS)[number]

export type TaxIdCandidate = {
  taxId: string
  method: TaxIdMethod
  /** 0 a 100. */
  confidence: number
  /**
   * Por que se acredita nisso, em português, para a tela mostrar.
   *
   * O badge carrega o motivo, nunca a porcentagem: "telefone confere" é
   * auditável por quem lê, "78%" não é.
   */
  reason: string
  legalName?: string | null
}
