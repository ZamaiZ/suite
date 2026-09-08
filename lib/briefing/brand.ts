import {
  isMarketingToolId,
  type MarketingToolId,
} from "@/lib/briefing/marketing-tools"

export const PRODUCT_SERVICE_KINDS = ["product", "service"] as const
export type ProductOrServiceKind = (typeof PRODUCT_SERVICE_KINDS)[number]

export const TEAM_HAS_ANSWERS = ["yes", "no"] as const
export type TeamHasAnswer = (typeof TEAM_HAS_ANSWERS)[number]

export const PRODUCTS_AND_SERVICES_MAX = 50
export const OTHER_MARKETING_TOOLS_MAX = 20
export const COMPETITORS_MAX = 20
export const COMPETITOR_NAME_MAX = 80
export const BRAND_TEXTAREA_MAX = 8000
export const PRODUCT_SERVICE_NAME_MAX = 120

export type ProductOrService = {
  id: string
  kind: ProductOrServiceKind
  name: string
  description: string
}

export type TeamRoleAnswer = {
  hasTeam: TeamHasAnswer | null
  notes: string
}

export type BriefingBrandPayload = {
  salesProcess: string
  companyStory: string
  productsAndServices: ProductOrService[]
  customerAttraction: string
  challenges: string
  commercialTeam: TeamRoleAnswer
  websiteDeveloper: TeamRoleAnswer
  contentProduction: TeamRoleAnswer
  marketingTools: MarketingToolId[]
  noneMarketingTools: boolean
  otherMarketingTools: string[]
  competitiveAdvantages: string
  competitiveWeaknesses: string
  competitors: string[]
}

export function emptyTeamRoleAnswer(): TeamRoleAnswer {
  return { hasTeam: null, notes: "" }
}

export function emptyBrandPayload(): BriefingBrandPayload {
  return {
    salesProcess: "",
    companyStory: "",
    productsAndServices: [],
    customerAttraction: "",
    challenges: "",
    commercialTeam: emptyTeamRoleAnswer(),
    websiteDeveloper: emptyTeamRoleAnswer(),
    contentProduction: emptyTeamRoleAnswer(),
    marketingTools: [],
    noneMarketingTools: false,
    otherMarketingTools: [],
    competitiveAdvantages: "",
    competitiveWeaknesses: "",
    competitors: [],
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

function isProductOrServiceKind(value: unknown): value is ProductOrServiceKind {
  return (
    typeof value === "string" &&
    (PRODUCT_SERVICE_KINDS as readonly string[]).includes(value)
  )
}

function isTeamHasAnswer(value: unknown): value is TeamHasAnswer {
  return (
    typeof value === "string" &&
    (TEAM_HAS_ANSWERS as readonly string[]).includes(value)
  )
}

function parseTeamRole(value: unknown): TeamRoleAnswer {
  if (!value || typeof value !== "object") return emptyTeamRoleAnswer()
  const row = value as Record<string, unknown>
  return {
    hasTeam: isTeamHasAnswer(row.hasTeam) ? row.hasTeam : null,
    notes: asString(row.notes),
  }
}

function parseProductOrService(value: unknown): ProductOrService | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const id = asString(row.id).trim()
  if (!id) return null
  const kind = isProductOrServiceKind(row.kind) ? row.kind : "product"
  return {
    id,
    kind,
    name: asString(row.name),
    description: asString(row.description),
  }
}

export function parseBrandPayload(value: unknown): BriefingBrandPayload {
  const base = emptyBrandPayload()
  if (!value || typeof value !== "object") return base
  const row = value as Record<string, unknown>

  const productsAndServices = Array.isArray(row.productsAndServices)
    ? row.productsAndServices
        .map(parseProductOrService)
        .filter((item): item is ProductOrService => item !== null)
        .slice(0, PRODUCTS_AND_SERVICES_MAX)
    : []

  const marketingTools = asStringList(row.marketingTools)
    .filter(isMarketingToolId)
    .filter(
      (id, index, list) => list.findIndex((item) => item === id) === index,
    )

  return {
    salesProcess: asString(row.salesProcess),
    companyStory: asString(row.companyStory),
    productsAndServices,
    customerAttraction: asString(row.customerAttraction),
    challenges: asString(row.challenges),
    commercialTeam: parseTeamRole(row.commercialTeam),
    websiteDeveloper: parseTeamRole(row.websiteDeveloper),
    contentProduction: parseTeamRole(row.contentProduction),
    marketingTools,
    noneMarketingTools: row.noneMarketingTools === true,
    otherMarketingTools: asStringList(row.otherMarketingTools)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, OTHER_MARKETING_TOOLS_MAX),
    competitiveAdvantages: asString(row.competitiveAdvantages),
    competitiveWeaknesses: asString(row.competitiveWeaknesses),
    competitors: asStringList(row.competitors)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, COMPETITORS_MAX),
  }
}

export function isTeamRoleComplete(answer: TeamRoleAnswer): boolean {
  return answer.hasTeam !== null && answer.notes.trim().length > 0
}

export function isProductOrServiceComplete(item: ProductOrService): boolean {
  return item.name.trim().length > 0 && item.description.trim().length > 0
}

export function isBrandReadyToComplete(payload: BriefingBrandPayload): boolean {
  if (payload.salesProcess.trim().length === 0) return false
  if (payload.companyStory.trim().length === 0) return false
  if (payload.customerAttraction.trim().length === 0) return false
  if (payload.challenges.trim().length === 0) return false

  const completeItems = payload.productsAndServices.filter(
    isProductOrServiceComplete,
  )
  if (completeItems.length === 0) return false

  if (!isTeamRoleComplete(payload.commercialTeam)) return false
  if (!isTeamRoleComplete(payload.websiteDeveloper)) return false
  if (!isTeamRoleComplete(payload.contentProduction)) return false

  if (payload.competitiveAdvantages.trim().length === 0) return false
  if (payload.competitiveWeaknesses.trim().length === 0) return false
  if (payload.competitors.length === 0) return false

  if (payload.noneMarketingTools) return true
  if (payload.marketingTools.length > 0) return true
  if (payload.otherMarketingTools.length > 0) return true
  return false
}

export type BrandMissingGroup =
  | "salesProcess"
  | "companyStory"
  | "productsAndServices"
  | "customerAttraction"
  | "challenges"
  | "team"
  | "marketingTools"
  | "competitors"

export const BRAND_MISSING_LABELS: Record<BrandMissingGroup, string> = {
  salesProcess: "processo de vendas",
  companyStory: "história e serviço",
  productsAndServices: "produtos ou serviços",
  customerAttraction: "atração de clientes",
  challenges: "desafios",
  team: "responsáveis do time",
  marketingTools: "ferramentas de marketing",
  competitors: "concorrentes",
}

export function getBrandMissingGroups(
  payload: BriefingBrandPayload,
): BrandMissingGroup[] {
  const missing: BrandMissingGroup[] = []
  if (payload.salesProcess.trim().length === 0) missing.push("salesProcess")
  if (payload.companyStory.trim().length === 0) missing.push("companyStory")
  if (
    payload.productsAndServices.filter(isProductOrServiceComplete).length === 0
  ) {
    missing.push("productsAndServices")
  }
  if (payload.customerAttraction.trim().length === 0) {
    missing.push("customerAttraction")
  }
  if (payload.challenges.trim().length === 0) missing.push("challenges")
  if (
    !isTeamRoleComplete(payload.commercialTeam) ||
    !isTeamRoleComplete(payload.websiteDeveloper) ||
    !isTeamRoleComplete(payload.contentProduction)
  ) {
    missing.push("team")
  }
  if (
    !payload.noneMarketingTools &&
    payload.marketingTools.length === 0 &&
    payload.otherMarketingTools.length === 0
  ) {
    missing.push("marketingTools")
  }
  if (
    payload.competitiveAdvantages.trim().length === 0 ||
    payload.competitiveWeaknesses.trim().length === 0 ||
    payload.competitors.length === 0
  ) {
    missing.push("competitors")
  }
  return missing
}

export function createEmptyProductOrService(
  kind: ProductOrServiceKind = "product",
): ProductOrService {
  return {
    id: crypto.randomUUID(),
    kind,
    name: "",
    description: "",
  }
}
