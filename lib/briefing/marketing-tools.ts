export const MARKETING_TOOL_IDS = [
  "google_ads",
  "meta_ads",
  "crm",
  "email_marketing",
  "heatmap",
  "chatbot",
  "whatsapp_business",
  "automation",
  "seo",
  "analytics",
] as const

export type MarketingToolId = (typeof MARKETING_TOOL_IDS)[number]

export const MARKETING_TOOL_LABELS: Record<MarketingToolId, string> = {
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  crm: "CRM",
  email_marketing: "E-mail marketing",
  heatmap: "Heatmap",
  chatbot: "Chatbot",
  whatsapp_business: "WhatsApp Business",
  automation: "Automação",
  seo: "SEO",
  analytics: "Analytics",
}

export function isMarketingToolId(value: unknown): value is MarketingToolId {
  return (
    typeof value === "string" &&
    (MARKETING_TOOL_IDS as readonly string[]).includes(value)
  )
}
