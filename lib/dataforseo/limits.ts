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
 * **A forma de `ai_overview_reference` saiu do escuro em 2026-09-11.** Medida
 * contra `puroclean.com` em US/en, que tem 4.677 linhas desse tipo: dezessete
 * campos, entre eles `text` — o trecho que a visão geral de IA citou — e o par
 * `rank_group` / `rank_absolute`, que **não são equivalentes**. `rank_absolute`
 * vale 1 em 93 de 100 porque é a posição do bloco na SERP; `rank_group` é a
 * posição entre as fontes citadas, e é essa que a tela mostra. Evidência em
 * `docs/auditoria/evidencias/2026-09-10-presenca-em-ia/`.
 *
 * `local_pack` **continua não observado**: veio zerado e nenhum lead medido até
 * hoje o tinha. O mapeador segue defensivo nele.
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

/* -------------------------------------------------------------------------- */
/*  Presença em IA — seção `ai_optimization`                                   */
/*                                                                            */
/*  Preços conferidos contra a tabela da própria conta em 2026-09-10, e os     */
/*  custos reais medidos na onda 0. Evidência em                              */
/*  `docs/auditoria/2026-09-10-onda0-presenca-em-ia.md`.                      */
/* -------------------------------------------------------------------------- */

/**
 * Procedência da coleta de Presença em IA. Mesmo papel de `VISIBILITY_QUERY`.
 *
 * `platform: "google"` é **sempre explícito**. Omitir o campo faz a API
 * devolver as duas plataformas, e `chat_gpt` é EUA/inglês por decisão do
 * provider — dado de outro país entraria na conta de um lead brasileiro sem
 * ninguém pedir.
 */
export const GEO_QUERY = {
  locationName: "Brazil",
  languageCode: "pt",
  platform: "google",
} as const

/**
 * Teto de keywords da demanda em IA.
 *
 * Mil é o teto da própria API. O caso real são as ~110 keywords que a
 * visibilidade já gravou, e a chamada inteira sai por US$ 0,021 — mais barata
 * que o `ranked_keywords` que as produziu (US$ 0,0252). Preço medido:
 * 0,01 + 110 × 0,0001 = 0,021 exato.
 */
export const AI_KEYWORD_VOLUME_LIMIT = 1000

/**
 * Linhas que a leitura de menções em IA pede por chamada.
 *
 * Cinquenta, e o teto existe para a calculadora, não para economizar: a
 * parcela por linha é US$ 0,001 contra US$ 0,10 por requisição. Dobrar o teto
 * custa cinco centavos; fazer uma chamada a mais custa dez.
 */
export const LLM_MENTIONS_LIMIT = 50

/**
 * Concorrentes que a tela mostra na comparação de menções em IA.
 *
 * **Não é teto de API** — a comparação é derivada das fontes que a coleta já
 * trouxe, sem chamada nova. É teto de leitura: cinco linhas mais o lead cabem
 * na tela, no mesmo número que `BACKLINK_COMPETITORS_LIMIT` já usa.
 */
export const GEO_MENTIONS_COMPETITORS_LIMIT = 5

/**
 * Fontes que a IA mais cita, segundo o relatório de referência de GEO.
 *
 * Medido, não suposto: em 2026-09-11, `sources_domain` trouxe `www.youtube.com`
 * e `www.reddit.com` no topo **dos dois mercados** testados — 835 e 506 menções
 * nos EUA, 28 no Brasil. São exatamente as fontes que a via de backlink não
 * encontrava.
 *
 * Casado por sufixo porque o índice guarda o host com `www.` e com subdomínio
 * de idioma (`pt.wikipedia.org`). Igualdade exata contra a forma nua foi o que
 * deu falso zero no filtro de backlinks.
 */
export const GEO_AUTHORITY_DOMAINS = [
  "wikipedia.org",
  "reddit.com",
  "youtube.com",
] as const

/**
 * Modelo padrão por plataforma na sondagem.
 *
 * `llm_responses/live` cobra a mesma taxa nas quatro — não há linha por
 * plataforma na tabela da conta. **Toda a diferença de custo é repasse do
 * modelo**, então escolher o modelo é escolher o custo. Medido em 2026-09-11,
 * mesmo prompt nas quatro:
 *
 *   perplexity/sonar             US$ 0,0057    29 tokens de entrada
 *   chat_gpt/gpt-5-mini          US$ 0,0146  8.818
 *   claude/claude-haiku-4-5      US$ 0,0238 10.797
 *   gemini/gemini-2.5-flash      US$ 0,0368    104
 *
 * `gemini-2.5-flash` e não `gemini-3.x`: os 3.x devolveram
 * `50301 rate_limit_exceeded` em três tentativas seguidas, custo zero, do lado
 * do provider.
 */
export const GEO_PROMPT_MODELS = {
  chat_gpt: "gpt-5-mini",
  claude: "claude-haiku-4-5",
  gemini: "gemini-2.5-flash",
  perplexity: "sonar",
} as const

export type GeoPromptPlatform = keyof typeof GEO_PROMPT_MODELS

export const GEO_PROMPT_PLATFORMS = Object.keys(
  GEO_PROMPT_MODELS,
) as GeoPromptPlatform[]

/**
 * O campo que cada plataforma **recusa** no corpo de `llm_responses/live`.
 *
 * Medido em 2026-09-10/11: três das quatro devolveram `40501 Invalid Field`
 * com o mesmo corpo, cada uma apontando para um campo diferente. O construtor
 * único de requisição — o desenho óbvio para quatro plataformas com o mesmo
 * shape — **falha em três delas**.
 *
 * E `40501` **não cobra nada**: a falha some no custo e aparece meses depois
 * como "essa plataforma nunca traz dado". É por isso que esta tabela existe em
 * vez de um `try/catch`.
 *
 * O `gemini` recusa os **dois** campos de localização, um de cada vez — tirar
 * só o primeiro faz ele reclamar do segundo. Ele mede sem recorte geográfico, e
 * a tela precisa marcar a coluna dele.
 */
export const GEO_PROMPT_OMITTED_FIELDS: Record<GeoPromptPlatform, string[]> = {
  chat_gpt: ["max_output_tokens"],
  claude: [],
  gemini: ["web_search_country_iso_code", "web_search_city"],
  perplexity: ["web_search_city"],
}

/** Plataformas que não aceitam recorte geográfico nenhum. */
export const GEO_PROMPT_NO_GEO: GeoPromptPlatform[] = ["gemini"]

/**
 * Prompts por família nas famílias 1–3. A família 4 (marca) é fixa em dois.
 *
 * Oito prompts × quatro plataformas = 32 execuções. A US$ 0,0808 por prompt
 * nas quatro — medido, não estimado —, a sondagem inteira sai por
 * **≈ US$ 0,65**. A taxa de US$ 0,0006 da tabela é 1/34 disso: o repasse do
 * modelo domina, e a tabela da conta é piso, não orçamento.
 */
export const GEO_PROMPTS_PER_FAMILY = 2
export const GEO_PROMPTS_PER_FAMILY_MAX = 3
