/**
 * As duas decisões puras do centroide: o texto que vai ao geocoder e a chave do
 * cache.
 *
 * Separadas de `city-center.ts` porque ele importa o cliente por alias, e um
 * `import` estático é resolvido no carregamento — com ele junto, o teste `.mjs`
 * nem abriria o arquivo.
 */

/** O acento fica: é o nome real do município, e o geocoder prefere assim. */
export function cityCenterQuery(city: string, stateCode: string): string {
  const cidade = city.trim().replace(/\s+/g, " ")
  return `${cidade}, ${stateCode.trim().toUpperCase()}, Brasil`
}

/** A chave dobra acento e caixa, para não pagar duas vezes pelo mesmo lugar. */
export function cityCenterCacheKey(city: string, stateCode: string): string {
  const folded = city
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
  return `${folded}|${stateCode.trim().toUpperCase()}`
}
