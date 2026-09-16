/**
 * Formatação compartilhada da etapa de Presença em IA.
 *
 * Mora fora dos componentes porque tanto o painel de abas quanto os cards
 * extraídos precisam dela: deixá-la em `LeadGeoTabPanels.tsx` faria os cards
 * importarem de quem os importa, que é ciclo.
 */

export const PROVIDER_LABELS: Record<string, string> = {
  chat_gpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  perplexity: "Perplexity",
}

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}
