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
 * Teto de linhas da checagem de citações.
 *
 * Generoso de propósito. A chamada não filtra por domínio — `domain_from` não
 * aceita `in`, e o casamento com o catálogo é feito do nosso lado — então o
 * teto precisa caber o perfil inteiro de domínios de referência, e não só os
 * vinte e poucos que interessam. Com `one_per_domain` cada domínio de origem
 * ocupa uma linha só, e mil cobre com folga o perfil de um negócio local.
 */
export const BACKLINK_CITATIONS_LIMIT = 1000

/** Keywords que a visibilidade orgânica pede por domínio. */
export const RANKED_KEYWORDS_LIMIT = 100
