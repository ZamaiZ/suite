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

/** Keywords que a visibilidade orgânica pede por domínio. */
export const RANKED_KEYWORDS_LIMIT = 100
