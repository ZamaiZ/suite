import {
  canonicalWebsiteUrl,
  normalizeWebsiteDomain,
} from "@/lib/leads/website"

export const LOGO_STATUS_IDS = [
  "have_file",
  "use_current_site",
  "create_new",
  "none",
] as const

export type LogoStatusId = (typeof LOGO_STATUS_IDS)[number]

export const LOGO_STATUS_LABELS: Record<LogoStatusId, string> = {
  have_file: "Tenho arquivo de logo",
  use_current_site: "Usar o do site atual",
  create_new: "Quero que criem o logo",
  none: "Não tenho logo",
}

export const LOGO_STATUS_DESCRIPTIONS: Record<LogoStatusId, string> = {
  have_file: "Vou enviar SVG ou PNG do logo.",
  use_current_site:
    "Usem o logo que já aparece no site informado na etapa Empresa.",
  create_new: "Não tenho arquivo; precisam criar a marca visual.",
  none: "Seguimos sem logo por enquanto.",
}

export const COLOR_POLICY_IDS = [
  "keep_current",
  "follow_brand",
  "refresh_ok",
  "open",
] as const

export type ColorPolicyId = (typeof COLOR_POLICY_IDS)[number]

export const COLOR_POLICY_LABELS: Record<ColorPolicyId, string> = {
  keep_current: "Manter as cores do site atual",
  follow_brand: "Seguir a identidade oficial",
  refresh_ok: "Pode evoluir, preservando a cara da marca",
  open: "Aberto a uma proposta nova",
}

export const COLOR_POLICY_DESCRIPTIONS: Record<ColorPolicyId, string> = {
  keep_current: "Extraímos a paleta a partir do site atual.",
  follow_brand:
    "Priorizamos logo, manual e links do kit — mesmo que o site atual seja diferente.",
  refresh_ok: "Podemos ajustar tons e contraste, sem abandonar a identidade.",
  open: "Marca fraca ou inexistente; o time pode propor do zero.",
}

export const INVENTORY_ANSWER_IDS = ["yes", "no"] as const
export type InventoryAnswerId = (typeof INVENTORY_ANSWER_IDS)[number]

export const ASSET_KIND_IDS = ["logo", "brand_book", "icon"] as const
export type BriefingAssetKind = (typeof ASSET_KIND_IDS)[number]

export const WEBSITE_TEXTAREA_MAX = 8000
export const WEBSITE_ASSET_LINKS_MAX = 20
export const WEBSITE_ASSET_LINK_MAX = 500
export const WEBSITE_SITES_MAX = 10
export const WEBSITE_LOGOS_MAX = 3
export const WEBSITE_ICONS_MAX = 10
export const WEBSITE_IMAGE_MAX_BYTES = 2 * 1024 * 1024
export const WEBSITE_PDF_MAX_BYTES = 10 * 1024 * 1024
export const BRIEFING_ASSETS_BUCKET = "briefing-assets"

export const WEBSITE_IMAGE_MIME_TYPES = ["image/png", "image/svg+xml"] as const

export const WEBSITE_PDF_MIME_TYPES = ["application/pdf"] as const

export type BriefingAssetRef = {
  id: string
  kind: BriefingAssetKind
  fileName: string
  mimeType: string
  sizeBytes: number
  storagePath: string
}

export type BriefingAssetInventory = {
  brandBook: InventoryAnswerId | null
  icons: InventoryAnswerId | null
  documentedPalette: InventoryAnswerId | null
  otherGuidelines: InventoryAnswerId | null
}

export type BriefingWebsitePayload = {
  logoStatus: LogoStatusId | null
  logos: BriefingAssetRef[]
  brandBook: BriefingAssetRef | null
  iconKit: BriefingAssetRef[]
  assetInventory: BriefingAssetInventory
  assetLinks: string[]
  colorPolicy: ColorPolicyId | null
  likedSites: string[]
  dislikedSites: string[]
  notes: string
}

export function emptyAssetInventory(): BriefingAssetInventory {
  return {
    brandBook: null,
    icons: null,
    documentedPalette: null,
    otherGuidelines: null,
  }
}

export function emptyWebsitePayload(): BriefingWebsitePayload {
  return {
    logoStatus: null,
    logos: [],
    brandBook: null,
    iconKit: [],
    assetInventory: emptyAssetInventory(),
    assetLinks: [],
    colorPolicy: null,
    likedSites: [],
    dislikedSites: [],
    notes: "",
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function isLogoStatusId(value: unknown): value is LogoStatusId {
  return (
    typeof value === "string" &&
    (LOGO_STATUS_IDS as readonly string[]).includes(value)
  )
}

function isColorPolicyId(value: unknown): value is ColorPolicyId {
  return (
    typeof value === "string" &&
    (COLOR_POLICY_IDS as readonly string[]).includes(value)
  )
}

function isInventoryAnswerId(value: unknown): value is InventoryAnswerId {
  return (
    typeof value === "string" &&
    (INVENTORY_ANSWER_IDS as readonly string[]).includes(value)
  )
}

function isAssetKind(value: unknown): value is BriefingAssetKind {
  return (
    typeof value === "string" &&
    (ASSET_KIND_IDS as readonly string[]).includes(value)
  )
}

function isValidAssetRef(
  value: unknown,
  expectedKind?: BriefingAssetKind,
): value is BriefingAssetRef {
  if (!value || typeof value !== "object") return false
  const row = value as Record<string, unknown>
  if (typeof row.id !== "string" || row.id.trim().length === 0) return false
  if (!isAssetKind(row.kind)) return false
  if (expectedKind && row.kind !== expectedKind) return false
  if (typeof row.fileName !== "string" || row.fileName.trim().length === 0) {
    return false
  }
  if (typeof row.mimeType !== "string" || row.mimeType.trim().length === 0) {
    return false
  }
  if (typeof row.sizeBytes !== "number" || !Number.isFinite(row.sizeBytes)) {
    return false
  }
  if (row.sizeBytes < 0) return false
  if (
    typeof row.storagePath !== "string" ||
    row.storagePath.trim().length === 0
  ) {
    return false
  }
  return true
}

function parseAssetRef(
  value: unknown,
  expectedKind?: BriefingAssetKind,
): BriefingAssetRef | null {
  if (!isValidAssetRef(value, expectedKind)) return null
  return {
    id: value.id.trim(),
    kind: value.kind,
    fileName: value.fileName.trim(),
    mimeType: value.mimeType.trim(),
    sizeBytes: value.sizeBytes,
    storagePath: value.storagePath.trim(),
  }
}

function parseAssetList(
  value: unknown,
  expectedKind: BriefingAssetKind,
  max: number,
): BriefingAssetRef[] {
  if (!Array.isArray(value)) return []
  const items: BriefingAssetRef[] = []
  for (const entry of value) {
    if (items.length >= max) break
    const parsed = parseAssetRef(entry, expectedKind)
    if (!parsed) continue
    if (items.some((item) => item.id === parsed.id)) continue
    items.push(parsed)
  }
  return items
}

function normalizeLinkList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  const links: string[] = []
  for (const entry of value) {
    if (typeof entry !== "string") continue
    const trimmed = entry.trim().slice(0, WEBSITE_ASSET_LINK_MAX)
    if (trimmed.length === 0) continue
    if (links.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      continue
    }
    links.push(trimmed)
    if (links.length >= max) break
  }
  return links
}

export function normalizeSiteUrlList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  const sites: string[] = []
  for (const entry of value) {
    if (typeof entry !== "string") continue
    const domain = normalizeWebsiteDomain(entry)
    if (!domain) continue
    const canonical = canonicalWebsiteUrl(domain)
    if (sites.some((item) => item === canonical)) continue
    sites.push(canonical)
    if (sites.length >= max) break
  }
  return sites
}

function parseInventory(value: unknown): BriefingAssetInventory {
  const base = emptyAssetInventory()
  if (!value || typeof value !== "object") return base
  const row = value as Record<string, unknown>
  return {
    brandBook: isInventoryAnswerId(row.brandBook) ? row.brandBook : null,
    icons: isInventoryAnswerId(row.icons) ? row.icons : null,
    documentedPalette: isInventoryAnswerId(row.documentedPalette)
      ? row.documentedPalette
      : null,
    otherGuidelines: isInventoryAnswerId(row.otherGuidelines)
      ? row.otherGuidelines
      : null,
  }
}

export function parseWebsitePayload(value: unknown): BriefingWebsitePayload {
  const base = emptyWebsitePayload()
  if (!value || typeof value !== "object") return base
  const row = value as Record<string, unknown>
  return sanitizeWebsitePayload({
    logoStatus: isLogoStatusId(row.logoStatus) ? row.logoStatus : null,
    logos: parseAssetList(row.logos, "logo", WEBSITE_LOGOS_MAX),
    brandBook: parseAssetRef(row.brandBook, "brand_book"),
    iconKit: parseAssetList(row.iconKit, "icon", WEBSITE_ICONS_MAX),
    assetInventory: parseInventory(row.assetInventory),
    assetLinks: normalizeLinkList(row.assetLinks, WEBSITE_ASSET_LINKS_MAX),
    colorPolicy: isColorPolicyId(row.colorPolicy) ? row.colorPolicy : null,
    likedSites: normalizeSiteUrlList(row.likedSites, WEBSITE_SITES_MAX),
    dislikedSites: normalizeSiteUrlList(row.dislikedSites, WEBSITE_SITES_MAX),
    notes: asString(row.notes).slice(0, WEBSITE_TEXTAREA_MAX),
  })
}

export function sanitizeWebsitePayload(
  payload: BriefingWebsitePayload,
): BriefingWebsitePayload {
  const logoStatus = payload.logoStatus
  const inventory = {
    brandBook: payload.assetInventory.brandBook,
    icons: payload.assetInventory.icons,
    documentedPalette: payload.assetInventory.documentedPalette,
    otherGuidelines: payload.assetInventory.otherGuidelines,
  }

  return {
    logoStatus,
    logos:
      logoStatus === "have_file"
        ? payload.logos.slice(0, WEBSITE_LOGOS_MAX)
        : [],
    brandBook: inventory.brandBook === "yes" ? payload.brandBook : null,
    iconKit:
      inventory.icons === "yes"
        ? payload.iconKit.slice(0, WEBSITE_ICONS_MAX)
        : [],
    assetInventory: inventory,
    assetLinks: normalizeLinkList(payload.assetLinks, WEBSITE_ASSET_LINKS_MAX),
    colorPolicy: payload.colorPolicy,
    likedSites: normalizeSiteUrlList(payload.likedSites, WEBSITE_SITES_MAX),
    dislikedSites: normalizeSiteUrlList(
      payload.dislikedSites,
      WEBSITE_SITES_MAX,
    ),
    notes: payload.notes.trim().slice(0, WEBSITE_TEXTAREA_MAX),
  }
}

export function clearedStoragePaths(
  previous: BriefingWebsitePayload,
  next: BriefingWebsitePayload,
): string[] {
  const prevPaths = new Set<string>()
  for (const logo of previous.logos) prevPaths.add(logo.storagePath)
  if (previous.brandBook) prevPaths.add(previous.brandBook.storagePath)
  for (const icon of previous.iconKit) prevPaths.add(icon.storagePath)

  const nextPaths = new Set<string>()
  for (const logo of next.logos) nextPaths.add(logo.storagePath)
  if (next.brandBook) nextPaths.add(next.brandBook.storagePath)
  for (const icon of next.iconKit) nextPaths.add(icon.storagePath)

  return [...prevPaths].filter((path) => !nextPaths.has(path))
}

function hasAssetOrLink(hasFile: boolean, links: string[]): boolean {
  return hasFile || links.length > 0
}

export type WebsiteMissingGroup =
  | "logoStatus"
  | "logos"
  | "inventoryBrandBook"
  | "inventoryIcons"
  | "inventoryPalette"
  | "inventoryGuidelines"
  | "brandBookAsset"
  | "iconKitAsset"
  | "colorPolicy"
  | "likedSites"
  | "dislikedSites"

export const WEBSITE_MISSING_LABELS: Record<WebsiteMissingGroup, string> = {
  logoStatus: "situação do logo",
  logos: "arquivo de logo",
  inventoryBrandBook: "brand book (tenho/não tenho)",
  inventoryIcons: "ícones (tenho/não tenho)",
  inventoryPalette: "paleta documentada (tenho/não tenho)",
  inventoryGuidelines: "outras guidelines (tenho/não tenho)",
  brandBookAsset: "PDF ou link do brand book",
  iconKitAsset: "ícones ou link do kit",
  colorPolicy: "política de cores",
  likedSites: "site que você gosta",
  dislikedSites: "site que você não gosta",
}

export function getWebsiteMissingGroups(
  payload: BriefingWebsitePayload,
): WebsiteMissingGroup[] {
  const sanitized = sanitizeWebsitePayload(payload)
  const missing: WebsiteMissingGroup[] = []

  if (sanitized.logoStatus === null) {
    missing.push("logoStatus")
  } else if (
    sanitized.logoStatus === "have_file" &&
    sanitized.logos.length === 0
  ) {
    missing.push("logos")
  }

  if (sanitized.assetInventory.brandBook === null) {
    missing.push("inventoryBrandBook")
  } else if (
    sanitized.assetInventory.brandBook === "yes" &&
    !hasAssetOrLink(Boolean(sanitized.brandBook), sanitized.assetLinks)
  ) {
    missing.push("brandBookAsset")
  }

  if (sanitized.assetInventory.icons === null) {
    missing.push("inventoryIcons")
  } else if (
    sanitized.assetInventory.icons === "yes" &&
    !hasAssetOrLink(sanitized.iconKit.length > 0, sanitized.assetLinks)
  ) {
    missing.push("iconKitAsset")
  }

  if (sanitized.assetInventory.documentedPalette === null) {
    missing.push("inventoryPalette")
  }
  if (sanitized.assetInventory.otherGuidelines === null) {
    missing.push("inventoryGuidelines")
  }

  if (sanitized.colorPolicy === null) {
    missing.push("colorPolicy")
  }

  if (sanitized.likedSites.length === 0) {
    missing.push("likedSites")
  }
  if (sanitized.dislikedSites.length === 0) {
    missing.push("dislikedSites")
  }

  return missing
}

export function isWebsiteReadyToComplete(
  payload: BriefingWebsitePayload,
): boolean {
  return getWebsiteMissingGroups(payload).length === 0
}
