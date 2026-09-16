/**
 * Copia o worker do MapLibre para `public/maplibre/`.
 *
 * **Por que isto existe.** O maplibre-gl 6 publica o worker como chunk ESM
 * separado e o procura assim:
 *
 *     new URL(`./${nome}`, import.meta.url)
 *
 * com o nome vindo de variável. Nenhum bundler consegue rastrear isso, então o
 * chunk nunca é emitido: em tempo de execução a URL aponta para dentro de
 * `/_next/static/`, o Next devolve a página de 404, e o navegador recusa
 * executar HTML como módulo. O worker morre **sem disparar evento de erro do
 * mapa** — o mapa simplesmente fica carregando para sempre.
 *
 * A defesa é servir o worker nós mesmos e apontar o `setWorkerUrl` para ele.
 *
 * **E por que num `postinstall`, e não copiado à mão.** Cópia commitada
 * envelhece em silêncio: numa atualização do maplibre, o worker antigo com o
 * bundle novo volta a falhar exatamente do mesmo jeito mudo. Rodando a cada
 * instalação, a cópia nunca diverge da versão instalada.
 */

import { copyFile, mkdir, readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

const ARQUIVOS = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]
const DESTINO = join(process.cwd(), "public", "maplibre")

const require = createRequire(import.meta.url)

async function main() {
  let dist
  try {
    // Resolve pelo package.json porque o pacote só exporta `.` e `./dist/*`,
    // e no pnpm o caminho real fica sob `.pnpm/`.
    dist = join(dirname(require.resolve("maplibre-gl/package.json")), "dist")
  } catch {
    // Instalação sem maplibre não é erro: o `postinstall` roda em qualquer
    // `pnpm install`, inclusive antes de a dependência existir.
    console.log("[maplibre] pacote ausente — nada a copiar")
    return
  }

  await mkdir(DESTINO, { recursive: true })
  for (const arquivo of ARQUIVOS) {
    await copyFile(join(dist, arquivo), join(DESTINO, arquivo))
  }

  const { version } = JSON.parse(
    await readFile(
      join(
        dirname(require.resolve("maplibre-gl/package.json")),
        "package.json",
      ),
      "utf8",
    ),
  )
  console.log(`[maplibre] worker ${version} copiado para public/maplibre/`)
}

await main()
