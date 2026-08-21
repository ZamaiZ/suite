import type {
  DiagnosisFinding,
  DiagnosisPillar,
} from "./diagnosis-document.ts"

export type DiagnosisThemeMatchInput = {
  opportunityIds: ReadonlySet<string>
}

type ThemeRule = {
  id: string
  title: string
  detail: string
  pillars: DiagnosisPillar[]
  match: (ids: ReadonlySet<string>) => boolean
}

function has(ids: ReadonlySet<string>, id: string): boolean {
  return ids.has(id)
}

function hasPrefix(ids: ReadonlySet<string>, prefix: string): boolean {
  for (const id of ids) {
    if (id.startsWith(prefix)) return true
  }
  return false
}

const THEME_RULES: readonly ThemeRule[] = [
  {
    id: "brand_content_trap",
    title: "Dependência de marca sem páginas de captura",
    detail:
      "O domínio aparece sobretudo por marca, a home concentra o ranking e faltam páginas de serviço — tráfego comercial fica preso à notoriedade.",
    pillars: ["website", "visibility"],
    match: (ids) =>
      has(ids, "brand_only_visibility") &&
      (has(ids, "homepage_only") || has(ids, "no_service_pages")),
  },
  {
    id: "local_seo_gap",
    title: "SEO local fraco no Maps e na busca orgânica",
    detail:
      "Fora do top 3 no Maps e sem keyword local relevante no top 20 orgânico — a descoberta local está comprometida nos dois canais.",
    pillars: ["google", "visibility"],
    match: (ids) => has(ids, "not_in_map_top3") && has(ids, "no_local_top20"),
  },
  {
    id: "nap_consistency",
    title: "Inconsistência de NAP entre site e Google",
    detail:
      "Telefone ou endereço do site não alinham com o perfil no Google — sinal clássico de perda de confiança local.",
    pillars: ["google", "website"],
    match: (ids) => has(ids, "nap_mismatch"),
  },
  {
    id: "content_cadence",
    title: "Cadência de conteúdo parada",
    detail:
      "Postagens do perfil e/ou redes sociais estão estagnadas — a presença deixa de reforçar relevância e prova social.",
    pillars: ["google", "presence"],
    match: (ids) =>
      (has(ids, "stale_posts") || has(ids, "no_posts")) &&
      hasPrefix(ids, "stale_social_posts:"),
  },
  {
    id: "tracking_blind",
    title: "Medição incompleta no site",
    detail:
      "Sem Google Tag/GTM e/ou pixel visível no HTML, fica difícil atribuir leads e otimizar campanhas com segurança.",
    pillars: ["website", "presence"],
    match: (ids) =>
      has(ids, "missing_google_tag") || has(ids, "pixel_not_in_html"),
  },
  {
    id: "trust_and_reviews",
    title: "Prova social insuficiente no Google",
    detail:
      "Nota baixa e/ou poucas avaliações enfraquecem a conversão no Maps mesmo quando há presença de perfil.",
    pillars: ["google"],
    match: (ids) => has(ids, "low_rating") || has(ids, "few_reviews"),
  },
  {
    id: "organic_footprint",
    title: "Pegada orgânica fina",
    detail:
      "Poucas keywords indexadas e/ou tráfego estimado baixo — o site ainda não gera demanda consistente pelo Google.",
    pillars: ["visibility"],
    match: (ids) =>
      has(ids, "not_ranking") ||
      has(ids, "thin_keyword_footprint") ||
      has(ids, "low_organic_traffic"),
  },
]

export function diagnosisFindingsFromThemes(
  input: DiagnosisThemeMatchInput,
): DiagnosisFinding[] {
  const findings: DiagnosisFinding[] = []
  for (const rule of THEME_RULES) {
    if (!rule.match(input.opportunityIds)) continue
    findings.push({
      id: rule.id,
      title: rule.title,
      detail: rule.detail,
      pillars: [...rule.pillars],
    })
  }
  return findings.slice(0, 5)
}
