import { z } from "zod"
import {
  ASSET_KIND_IDS,
  COLOR_POLICY_IDS,
  INVENTORY_ANSWER_IDS,
  LOGO_STATUS_IDS,
  sanitizeWebsitePayload,
  WEBSITE_ASSET_LINK_MAX,
  WEBSITE_ASSET_LINKS_MAX,
  WEBSITE_ICONS_MAX,
  WEBSITE_LOGOS_MAX,
  WEBSITE_PDF_MAX_BYTES,
  WEBSITE_SITES_MAX,
  WEBSITE_TEXTAREA_MAX,
  type BriefingWebsitePayload,
} from "@/lib/briefing/website"

const assetRefSchema = z.object({
  id: z.string().trim().min(1).max(120),
  kind: z.enum(ASSET_KIND_IDS),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().nonnegative().max(WEBSITE_PDF_MAX_BYTES),
  storagePath: z.string().trim().min(1).max(500),
})

const inventorySchema = z.object({
  brandBook: z.union([z.enum(INVENTORY_ANSWER_IDS), z.null()]),
  icons: z.union([z.enum(INVENTORY_ANSWER_IDS), z.null()]),
  documentedPalette: z.union([z.enum(INVENTORY_ANSWER_IDS), z.null()]),
  otherGuidelines: z.union([z.enum(INVENTORY_ANSWER_IDS), z.null()]),
})

export const briefingWebsitePayloadSchema = z.object({
  logoStatus: z.union([z.enum(LOGO_STATUS_IDS), z.null()]),
  logos: z.array(assetRefSchema).max(WEBSITE_LOGOS_MAX),
  brandBook: z.union([assetRefSchema, z.null()]),
  iconKit: z.array(assetRefSchema).max(WEBSITE_ICONS_MAX),
  assetInventory: inventorySchema,
  assetLinks: z
    .array(z.string().trim().max(WEBSITE_ASSET_LINK_MAX))
    .max(WEBSITE_ASSET_LINKS_MAX),
  colorPolicy: z.union([z.enum(COLOR_POLICY_IDS), z.null()]),
  likedSites: z.array(z.string()).max(WEBSITE_SITES_MAX),
  dislikedSites: z.array(z.string()).max(WEBSITE_SITES_MAX),
  notes: z.string().trim().max(WEBSITE_TEXTAREA_MAX),
})

export type BriefingWebsiteInput = z.infer<typeof briefingWebsitePayloadSchema>

export function toWebsitePayload(
  data: BriefingWebsiteInput,
): BriefingWebsitePayload {
  return sanitizeWebsitePayload({
    logoStatus: data.logoStatus,
    logos: data.logos.filter((item) => item.kind === "logo"),
    brandBook:
      data.brandBook && data.brandBook.kind === "brand_book"
        ? data.brandBook
        : null,
    iconKit: data.iconKit.filter((item) => item.kind === "icon"),
    assetInventory: data.assetInventory,
    assetLinks: data.assetLinks,
    colorPolicy: data.colorPolicy,
    likedSites: data.likedSites,
    dislikedSites: data.dislikedSites,
    notes: data.notes,
  })
}
