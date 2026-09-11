// DESCARTAVEL - corta os payloads crus desta evidencia. Nao faz parte do app.
//
// A onda 0 da visibilidade fixou a regra: payload cru grande nao se versiona,
// porque o script o regera. Mas aqui ha uma tensao real que la nao havia -
// `18-llm_mentions-lead.json` e a UNICA observacao da forma do dataset para um
// lead brasileiro, e regera-lo custa US$ 0,107.
//
// Por isso o corte preserva a FORMA e joga fora o VOLUME: mantem o envelope
// inteiro, os tres primeiros itens de cada lista, e grava quantos havia. A
// pergunta que a evidencia responde e "que campos vem e com que conteudo", e
// tres itens respondem isso tao bem quanto duzentos.
//
// Idempotente: rodar duas vezes nao corta o que ja foi cortado.
//
// Uso:
//   node docs/auditoria/evidencias/2026-09-10-presenca-em-ia/cortar-cru.mjs [DIR]

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const DIR = process.argv[2] ?? "."
const MANTER = 3
const PISO_BYTES = 60_000

/** Onde cada payload guarda a lista que pesa. */
const LISTAS = ["items", "result"]

function cortar(node, trilha, cortes) {
  if (Array.isArray(node)) return node.map((n, i) => cortar(n, [...trilha, i], cortes))
  if (!node || typeof node !== "object") return node

  const out = {}
  for (const [k, v] of Object.entries(node)) {
    if (LISTAS.includes(k) && Array.isArray(v) && v.length > MANTER) {
      cortes.push({ caminho: [...trilha, k].join("."), de: v.length, para: MANTER })
      out[k] = v.slice(0, MANTER).map((n, i) => cortar(n, [...trilha, k, i], cortes))
      // O numero original fica ao lado: sem ele, uma lista de tres itens mente
      // sobre quantos vieram, e o proximo leitor conclui errado sobre cobertura.
      out[`_${k}_original_length`] = v.length
    } else {
      out[k] = cortar(v, [...trilha, k], cortes)
    }
  }
  return out
}

const relatorio = []
for (const nome of readdirSync(DIR).filter((f) => f.endsWith(".json"))) {
  const caminho = join(DIR, nome)
  const antes = statSync(caminho).size
  if (antes < PISO_BYTES) continue

  const json = JSON.parse(readFileSync(caminho, "utf8"))
  if (json?._cortado) continue

  const cortes = []
  const podado = cortar(json, [], cortes)
  if (cortes.length === 0) continue

  podado._cortado = {
    em: new Date().toISOString(),
    nota:
      "listas truncadas para os primeiros " +
      MANTER +
      " itens; `_<lista>_original_length` guarda o tamanho real. " +
      "Regenere o cru com probe.mjs / probe-pago.mjs / probe-pago-2.mjs.",
    cortes,
  }
  writeFileSync(caminho, JSON.stringify(podado, null, 2), "utf8")
  const depois = statSync(caminho).size
  relatorio.push({ nome, antes, depois, cortes: cortes.length })
}

for (const r of relatorio) {
  console.log(
    `${r.nome.padEnd(38)} ${String(r.antes).padStart(8)} -> ${String(r.depois).padStart(7)} bytes (${r.cortes} lista(s))`,
  )
}
console.log(
  `\n${relatorio.length} arquivo(s) cortado(s); ` +
    `${(relatorio.reduce((a, r) => a + r.antes - r.depois, 0) / 1024).toFixed(0)} KB a menos.`,
)
