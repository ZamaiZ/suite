import { setWorkerUrl } from "maplibre-gl"

/**
 * Aponta o MapLibre para o worker que servimos de `public/maplibre/`.
 *
 * Sem isto o mapa **fica carregando para sempre**, e em silêncio: o maplibre-gl
 * 6 procura o próprio worker em `new URL(\`./${nome}\`, import.meta.url)` com o
 * nome vindo de variável, o bundler não consegue emitir esse chunk, e o
 * navegador recebe a página de 404 do Next no lugar de um módulo. Falha de
 * worker não vira evento `error` do mapa — só o `load` nunca chega.
 *
 * Os dois arquivos são copiados pelo `postinstall`, em
 * `scripts/copy-maplibre-worker.mjs`. Ficam lado a lado porque o worker importa
 * `./maplibre-gl-shared.mjs` por caminho relativo.
 *
 * Chamada explícita, e não efeito colateral de import: efeito de módulo pode
 * ser removido por *tree shaking*, e o modo de falha seria este mesmo — mapa
 * eterno em carregamento, sem erro.
 */

const WORKER_URL = "/maplibre/maplibre-gl-worker.mjs"

let configurado = false

export function ensureMapWorker(): void {
  if (configurado) return
  setWorkerUrl(WORKER_URL)
  configurado = true
}
