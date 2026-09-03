import { z } from "zod"
import {
  BRAND_TEXTAREA_MAX,
  COMPETITOR_NAME_MAX,
  COMPETITORS_MAX,
  OTHER_MARKETING_TOOLS_MAX,
  PRODUCT_SERVICE_NAME_MAX,
  PRODUCTS_AND_SERVICES_MAX,
  type BriefingBrandPayload,
  type ProductOrServiceKind,
  type TeamHasAnswer,
  type TeamRoleAnswer,
} from "@/lib/briefing/brand"
import {
  isMarketingToolId,
  type MarketingToolId,
} from "@/lib/briefing/marketing-tools"

const brandText = z.string().trim().max(BRAND_TEXTAREA_MAX)

const teamRoleSchema = z.object({
  hasTeam: z.union([z.literal("yes"), z.literal("no"), z.null()]),
  notes: brandText,
})

const productOrServiceSchema = z.object({
  id: z.string().trim().min(1).max(80),
  kind: z.union([z.literal("product"), z.literal("service")]),
  name: z.string().trim().max(PRODUCT_SERVICE_NAME_MAX),
  description: brandText,
})

export const briefingBrandPayloadSchema = z.object({
  salesProcess: brandText,
  companyStory: brandText,
  productsAndServices: z
    .array(productOrServiceSchema)
    .max(PRODUCTS_AND_SERVICES_MAX),
  customerAttraction: brandText,
  challenges: brandText,
  commercialTeam: teamRoleSchema,
  websiteDeveloper: teamRoleSchema,
  contentProduction: teamRoleSchema,
  marketingTools: z.array(z.string()).max(20),
  noneMarketingTools: z.boolean(),
  otherMarketingTools: z
    .array(z.string().trim().max(80))
    .max(OTHER_MARKETING_TOOLS_MAX),
  competitiveAdvantages: brandText,
  competitiveWeaknesses: brandText,
  competitors: z
    .array(z.string().trim().max(COMPETITOR_NAME_MAX))
    .max(COMPETITORS_MAX),
})

export type BriefingBrandInput = z.infer<typeof briefingBrandPayloadSchema>

function toTeamRole(data: {
  hasTeam: "yes" | "no" | null
  notes: string
}): TeamRoleAnswer {
  return {
    hasTeam: data.hasTeam as TeamHasAnswer | null,
    notes: data.notes.trim(),
  }
}

export function toBrandPayload(data: BriefingBrandInput): BriefingBrandPayload {
  const marketingTools = data.marketingTools
    .filter(isMarketingToolId)
    .filter(
      (id, index, list) => list.findIndex((item) => item === id) === index,
    ) as MarketingToolId[]

  const noneMarketingTools = data.noneMarketingTools === true

  return {
    salesProcess: data.salesProcess,
    companyStory: data.companyStory,
    productsAndServices: data.productsAndServices.map((item) => ({
      id: item.id,
      kind: item.kind as ProductOrServiceKind,
      name: item.name.trim(),
      description: item.description.trim(),
    })),
    customerAttraction: data.customerAttraction,
    challenges: data.challenges,
    commercialTeam: toTeamRole(data.commercialTeam),
    websiteDeveloper: toTeamRole(data.websiteDeveloper),
    contentProduction: toTeamRole(data.contentProduction),
    marketingTools: noneMarketingTools ? [] : marketingTools,
    noneMarketingTools,
    otherMarketingTools: noneMarketingTools
      ? data.otherMarketingTools
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      : data.otherMarketingTools
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
    competitiveAdvantages: data.competitiveAdvantages,
    competitiveWeaknesses: data.competitiveWeaknesses,
    competitors: data.competitors
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  }
}
