import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

/**
 * `SHADCN_PALETTE` é um espelho em TS dos tokens de `app/globals.css`, usado por
 * quem não consegue ler CSS var (metadata, React-PDF, Google Maps). Espelho não
 * avisa quando fica velho — foi assim que `dark.primary` continuou no valor
 * antigo depois de uma correção de contraste. Este teste trava a divergência de
 * *conjunto de tokens*; os valores continuam sendo conferidos no browser.
 */

const CSS = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
  "utf8",
)
const SRC = readFileSync(
  new URL("./shadcn-palette.ts", import.meta.url),
  "utf8",
)

// tokens que existem no CSS mas não fazem parte do espelho (não são cor de tema)
const IGNORED = new Set(["radius"])

function cssTokens(blockSelector) {
  const start = CSS.indexOf(blockSelector)
  assert.notEqual(
    start,
    -1,
    `bloco ${blockSelector} não encontrado em globals.css`,
  )
  const open = CSS.indexOf("{", start)
  const end = CSS.indexOf("\n}", open)
  const body = CSS.slice(open, end)
  const found = new Set()
  for (const m of body.matchAll(/^\s*--([a-z0-9-]+):/gim)) {
    if (!IGNORED.has(m[1])) found.add(m[1])
  }
  return found
}

function mirrorTokens(theme) {
  const start = SRC.indexOf(`${theme}: {`)
  assert.notEqual(start, -1, `tema ${theme} não encontrado no espelho`)
  const end = SRC.indexOf("\n  },", start)
  const body = SRC.slice(start, end)
  const found = new Set()
  for (const m of body.matchAll(/^\s{4}([A-Za-z0-9]+):/gm)) {
    if (m[1] === "chart") {
      for (let i = 1; i <= 5; i += 1) found.add(`chart-${i}`)
      continue
    }
    found.add(m[1].replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`))
  }
  return found
}

for (const [theme, selector] of [
  ["light", "\n:root {"],
  ["dark", "\n.dark {"],
]) {
  test(`espelho cobre exatamente os tokens de ${theme}`, () => {
    const css = cssTokens(selector)
    const mirror = mirrorTokens(theme)
    const faltando = [...css].filter((t) => !mirror.has(t)).sort()
    const sobrando = [...mirror].filter((t) => !css.has(t)).sort()
    assert.deepEqual(
      faltando,
      [],
      `tokens no CSS e ausentes no espelho: ${faltando}`,
    )
    assert.deepEqual(
      sobrando,
      [],
      `tokens no espelho e ausentes no CSS: ${sobrando}`,
    )
  })
}

test("todo valor do espelho é hex", () => {
  for (const m of SRC.matchAll(/: "(#[^"]*)"/g)) {
    assert.match(
      m[1],
      /^#[0-9a-f]{6}([0-9a-f]{2})?$/,
      `valor inválido: ${m[1]}`,
    )
  }
})
