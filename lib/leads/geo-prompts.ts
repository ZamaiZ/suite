/**
 * Derivação do conjunto de prompts da sondagem. Puro.
 *
 * **O tipo já existe.** `GeoPromptSet` e `readGeoPromptSet` moram em
 * `geo-review.ts`, junto do resto do que `lead_geo_reviews` guarda, e este
 * módulo só **deriva** — não redeclara. Um segundo tipo para a mesma coluna
 * divergiria em silêncio na primeira mudança de forma.
 *
 * **Por que fixar.** Prompt que muda entre coletas transforma taxa de menção em
 * número sem significado: a segunda medição responde a outra pergunta e a série
 * compara coisas diferentes. É a armadilha dos métodos divergentes que já
 * custou o `maps-task.ts`, e o mesmo motivo de `audit_paths` existir.
 */

import {
  GEO_PROMPTS_PER_FAMILY,
  GEO_PROMPTS_PER_FAMILY_MAX,
} from "../dataforseo/limits.ts"
import type { GeoPromptSet, GeoPromptSetItem } from "./geo-review.ts"

/** `user_prompt` tem teto de 500 caracteres na API. */
export const GEO_PROMPT_MAX = 500

export const GEO_PROMPT_FAMILY_LABELS: Record<
  GeoPromptSetItem["family"],
  string
> = {
  discovery: "Descoberta",
  problem: "Problema",
  comparison: "Comparação",
  brand: "Marca",
}

function trimTo(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, " ")
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`
}

/**
 * Quatro famílias, e a quarta sempre roda.
 *
 * A família de marca é a mais barata e a de maior sinal: responde se a LLM
 * **sabe que o lead existe**, que é a pergunta da qual todas as outras
 * dependem. As três primeiras só existem quando há segmento **e** cidade — sem
 * eles o prompt sairia genérico e mediria o mercado, não o lead.
 */
export function deriveGeoPromptSet(input: {
  company: string
  segment: string | null
  city: string | null
  fixedAt: string
  perFamily?: number
}): GeoPromptSet {
  const company = input.company.trim()
  const segment = input.segment?.trim() || null
  const city = input.city?.trim() || null
  const perFamily = Math.min(
    Math.max(input.perFamily ?? GEO_PROMPTS_PER_FAMILY, 1),
    GEO_PROMPTS_PER_FAMILY_MAX,
  )

  const items: GeoPromptSetItem[] = []

  if (segment && city) {
    const porFamilia: Array<[GeoPromptSetItem["family"], string[]]> = [
      [
        "discovery",
        [
          `Quais são as melhores empresas de ${segment} em ${city}?`,
          `Quem você recomenda para ${segment} em ${city}?`,
          `Indique empresas confiáveis de ${segment} em ${city}.`,
        ],
      ],
      [
        "problem",
        [
          `Preciso contratar ${segment} em ${city}. Como escolher e quem procurar?`,
          `Quem resolve ${segment} em ${city} com bom custo-benefício?`,
          `Tive problema com ${segment} em ${city}. Que empresa devo procurar?`,
        ],
      ],
      [
        "comparison",
        [
          `Compare as principais empresas de ${segment} em ${city}.`,
          `Quais empresas de ${segment} em ${city} têm melhor reputação?`,
          `Ranqueie as empresas de ${segment} em ${city}.`,
        ],
      ],
    ]
    for (const [family, textos] of porFamilia) {
      textos.slice(0, perFamily).forEach((text, index) => {
        items.push({
          id: `${family}-${index + 1}`,
          family,
          text: trimTo(text, GEO_PROMPT_MAX),
        })
      })
    }
  }

  // Sempre. Não dependem de segmento nem de cidade.
  const marca = [
    `O que você sabe sobre a empresa ${company}?`,
    `A ${company} é confiável? O que se sabe sobre ela?`,
  ]
  marca.forEach((text, index) => {
    items.push({
      id: `brand-${index + 1}`,
      family: "brand",
      text: trimTo(text, GEO_PROMPT_MAX),
    })
  })

  return { version: 1, fixedAt: input.fixedAt, items }
}

/**
 * Variantes do nome da empresa que contam como a marca no texto.
 *
 * Sem isto, "Busca Orgânica Marketing Digital Ltda." só casaria escrito por
 * extenso, e a LLM escreve "Busca Orgânica". Um falso negativo aqui vira "as
 * IAs não reconhecem a marca" num documento comercial.
 */
export function brandVariants(company: string): string[] {
  const base = company.trim().replace(/\s+/g, " ")
  if (!base) return []
  const semSufixo = base
    .replace(
      /\s+(ltda\.?|me\.?|epp\.?|eireli|s\.?\/?a\.?|sa|s\/s)\s*$/i,
      "",
    )
    .trim()
  const palavras = semSufixo.split(" ")
  const variantes = new Set<string>([base, semSufixo])
  // Duas primeiras palavras: é como quase toda marca é citada de fato.
  if (palavras.length > 2) variantes.add(palavras.slice(0, 2).join(" "))
  return [...variantes].filter((value) => value.length >= 3)
}
