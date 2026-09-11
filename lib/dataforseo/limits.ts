/**
 * Quantos resultados cada coleta paga pede de volta.
 *
 * Puro e sem imports, porque dois lados precisam do mesmo número: os clientes
 * HTTP são `server-only` e a calculadora roda no cliente. Separado justamente
 * para que não existam duas cópias — o preço do DataForSEO tem uma parcela por
 * resultado devolvido, e um teto que só o fetcher conhecesse faria a
 * calculadora subestimar em silêncio.
 */

/** Concorrentes que o benchmark de backlinks traz. Cinco cabem na leitura. */
export const BACKLINK_COMPETITORS_LIMIT = 5

/**
 * Teto de linhas da leitura de rede de links.
 *
 * Generoso de propósito: os três sinais são proporções sobre a amostra, e
 * amostra pequena os distorce. Com `one_per_domain` cada domínio de origem
 * ocupa uma linha só, e mil cobre com folga o perfil de um negócio local — o
 * primeiro perfil real tinha 406 domínios de referência. Quando estourar, a
 * leitura marca `truncated` e passa a calar sobre o que ficou de fora.
 */
export const BACKLINK_SCHEME_LIMIT = 1000

/**
 * Keywords que a visibilidade orgânica pede por domínio.
 *
 * Mil, não cem, e isso **não** encarece o caso comum: o Labs cobra
 * US$ 0,012 por requisição mais US$ 0,00012 por linha **devolvida**, não pedida.
 * Conferido contra a conta em 2026-09-10 — 0,012 + 110 × 0,00012 = 0,0252
 * exato, nas quatro chamadas da medição. O teto de 100 não economizava nada e
 * truncava sempre, e as regras de gap rodavam sobre a amostra truncada.
 */
export const RANKED_KEYWORDS_LIMIT = 1000

/**
 * Medido em 2026-09-10, com duas chamadas idênticas exceto por este campo:
 *
 * - **`metrics.organic` é idêntico** nas duas. Ampliar `item_types` não muda a
 *   semântica dos buckets nem das contagens orgânicas, que é o que importava.
 * - As cinco chaves de `metrics` estão sempre presentes, mas a seção de um tipo
 *   **não pedido volta `null`** — só a pedida vem preenchida. Ou seja,
 *   `local_pack` e `ai_overview_reference` não estavam sendo pagas e
 *   descartadas: elas não vinham. Passam a vir agora.
 * - O custo não mudou (US$ 0,0252 nas duas), porque se paga por linha
 *   devolvida e este domínio não tem resultado nesses dois tipos.
 *
 * E é por isso mesmo que a forma do `serp_item` de `local_pack` e
 * `ai_overview_reference` **continua não observada**: vieram zerados. O
 * mapeador é defensivo neles, e o primeiro lead que os tiver é a validação.
 */
export const VISIBILITY_ITEM_TYPES = [
  "organic",
  "local_pack",
  "ai_overview_reference",
] as const

/**
 * Procedência da coleta de visibilidade, num lugar só.
 *
 * Antes eram literais em dois arquivos — o corpo da requisição e o eco no
 * mapeador. Duas cópias da mesma verdade: mudar uma faria o snapshot mentir
 * sobre a própria origem, e a mentira só apareceria meses depois, num
 * comparativo que não fecha.
 */
export const VISIBILITY_QUERY = {
  locationName: "Brazil",
  languageCode: "pt",
} as const
