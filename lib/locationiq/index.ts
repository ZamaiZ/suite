/**
 * Barril **client-safe**, e só.
 *
 * `client.ts` e `city-center.ts` são `server-only` e ficam de fora de propósito:
 * reexportá-los aqui fazia qualquer componente de tela que importasse este
 * arquivo arrastar o geocoder — com a chave de API junto — para o bundle do
 * navegador, e o build quebrava com uma pilha difícil de ler. Quem é servidor
 * importa o módulo específico.
 */

export {
  LOCATIONIQ_SUGGEST_MIN_CHARS,
  addressFromLocationIq,
  type BriefingAddressCandidate,
  type LocationIqAddress,
} from "./address"
export { cityCenterCacheKey, cityCenterQuery } from "./city-key"
