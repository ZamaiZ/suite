import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, statfsSync, writeFileSync, appendFileSync, rmSync } from "node:fs"
import path from "node:path"
import { createInterface } from "node:readline"
import { createHash } from "node:crypto"
import { performance } from "node:perf_hooks"

const companyFields = 7
const establishmentFields = 30
const officialDataUrl = "https://dadosabertos.rfb.gov.br/CNPJ/"
const MAX_CANDIDATES = 20_000
const MAX_INPUT_BYTES = 32 * 1024 * 1024
const MAX_RESULT_BYTES = 32 * 1024 * 1024
const companyLimit = 80

class CancelledError extends Error {}

function parseCsvLine(line) {
  const fields = []
  let value = ""
  let quoted = false
  let atFieldStart = true
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (quoted) {
      if (character === '"' && line[index + 1] === '"') { value += '"'; index += 1 }
      else if (character === '"') quoted = false
      else value += character
    } else if (character === ";") { fields.push(value); value = ""; atFieldStart = true }
    else if (character === '"' && atFieldStart) { quoted = true; atFieldStart = false }
    else { value += character; atFieldStart = false }
  }
  if (quoted) throw new Error("CSV contém aspas não fechadas")
  fields.push(value)
  return fields
}

async function firstDataLine(filePath) {
  const input = createInterface({ input: createReadStream(filePath, { encoding: "latin1" }), crlfDelay: Infinity })
  try { for await (const line of input) return line } finally { input.close() }
  return ""
}

function snapshotKey(files) {
  return createHash("sha256").update(files.map((file) => `${file.relativePath}:${file.bytes}:${file.modifiedAt}`).join("|")).digest("hex")
}

function competenceFrom(files) {
  const tokens = [...new Set(files.map((file) => file.snapshotToken).filter(Boolean))]
  return tokens.length === 1 ? tokens[0] : null
}

async function inspect(dataDir) {
  const files = []
  const missingFiles = []
  const layoutErrors = []
  for (const [group, expectedFields, expectedSuffix] of [["Empresas", companyFields, ".EMPRECSV"], ["Estabelecimentos", establishmentFields, ".ESTABELE"]]) {
    for (let part = 0; part < 10; part += 1) {
      const directory = path.join(dataDir, `${group}${part}`)
      if (!existsSync(directory) || !statSync(directory).isDirectory()) { missingFiles.push(`${group}${part}`); continue }
      const names = readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name)
      if (names.length !== 1) { layoutErrors.push(`${group}${part}: esperava um arquivo, encontrei ${names.length}.`); continue }
      const filePath = path.join(directory, names[0])
      const details = statSync(filePath)
      if (!names[0].toUpperCase().endsWith(expectedSuffix)) layoutErrors.push(`${group}${part}: arquivo inesperado "${names[0]}"; esperado sufixo ${expectedSuffix}.`)
      const line = await firstDataLine(filePath)
      let fieldCount = null
      try { fieldCount = parseCsvLine(line.replace(/^\uFEFF/, "")).length } catch { layoutErrors.push(`${group}${part}: primeira linha CSV inválida.`) }
      if (fieldCount !== expectedFields) layoutErrors.push(`${group}${part}: esperado ${expectedFields} campos; encontrados ${fieldCount ?? "inválidos"}.`)
      if (line.includes("\uFFFD")) layoutErrors.push(`${group}${part}: encoding incompatível com a leitura Latin-1.`)
      files.push({ group, part, relativePath: path.relative(dataDir, filePath), bytes: details.size, fieldCount, modifiedAt: details.mtime.toISOString(), snapshotToken: names[0].match(/\.D(\d{5})\./i)?.[1] ?? null })
    }
  }
  if (files.length === 20 && competenceFrom(files) === null) layoutErrors.push("Os 20 arquivos não compartilham o mesmo identificador de competência.")
  return { snapshotKey: snapshotKey(files), competence: competenceFrom(files), files, totalBytes: files.reduce((sum, file) => sum + file.bytes, 0), missingFiles, layoutErrors, ready: files.length === 20 && missingFiles.length === 0 && layoutErrors.length === 0 && competenceFrom(files) !== null }
}

function normalizeName(value) { return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim() }
function tokensFor(value, minLength = 3) { return [...new Set(normalizeName(value).split(/\s+/).filter((token) => token.length >= minLength))].slice(0, 8) }
function normalizePhone(value) {
  let phone = String(value ?? "").replace(/\D/g, "")
  if ((phone.length === 12 || phone.length === 13) && phone.startsWith("55")) phone = phone.slice(2)
  return phone
}
function candidateCep(value) { return String(value ?? "").match(/\b\d{5}-?\d{3}\b/)?.[0].replace(/\D/g, "") ?? "" }
function similarity(left, right) {
  const a = new Set(normalizeName(left).split(/\s+/).filter((token) => token.length > 1))
  const b = new Set(normalizeName(right).split(/\s+/).filter((token) => token.length > 1))
  if (!a.size || !b.size) return 0
  let common = 0
  for (const token of a) if (b.has(token)) common += 1
  return common / Math.max(a.size, b.size)
}
function isValidCnpj(value) {
  if (!/^[A-Z0-9]{12}\d{2}$/.test(value) || /^([A-Z0-9])\1{13}$/.test(value)) return false
  const digit = (source) => {
    let total = 0, weight = 2
    for (let index = source.length - 1; index >= 0; index -= 1) { total += (source.charCodeAt(index) - 48) * weight; weight = weight === 9 ? 2 : weight + 1 }
    const remainder = total % 11
    return String(remainder < 2 ? 0 : 11 - remainder)
  }
  const first = digit(value.slice(0, 12))
  const second = digit(`${value.slice(0, 12)}${first}`)
  return value.endsWith(`${first}${second}`)
}

function writeJson(file, value) {
  const temporary = `${file}.${process.pid}.tmp`
  writeFileSync(temporary, JSON.stringify(value), "utf8")
  renameSync(temporary, file)
}
function event(paths, job, type, payload = {}) {
  const events = path.join(paths.jobDir, "events.jsonl")
  const record = { at: new Date().toISOString(), type, phase: job.phase, ...payload }
  appendFileSync(events, `${JSON.stringify(record)}\n`, "utf8")
  try {
    const lines = readFileSync(events, "utf8").trim().split("\n")
    if (lines.length > 500) writeFileSync(events, `${lines.slice(-500).join("\n")}\n`, "utf8")
  } catch {}
}
function writeState(paths, job, type = null, payload = {}) {
  job.updatedAt = new Date().toISOString()
  writeJson(path.join(paths.jobDir, "status.json"), job)
  writeJson(path.join(paths.stateDir, "active.json"), { executionId: job.executionId, runId: job.runId, updatedAt: job.updatedAt })
  if (type) event(paths, job, type, payload)
}
function freeBytes(directory) {
  try { const stats = statfsSync(directory); return Number(stats.bavail) * Number(stats.bsize) } catch { return null }
}
function isCancelled(paths) { return existsSync(path.join(paths.jobDir, "cancel.json")) }

async function readRows(filePath, expected, onRow, onProgress, shouldCancel) {
  let count = 0
  const stream = createReadStream(filePath, { encoding: "latin1" })
  const lines = createInterface({ input: stream, crlfDelay: Infinity })
  let lastProgress = performance.now()
  try {
    for await (const line of lines) {
      if (count % 5000 === 0 && shouldCancel()) throw new CancelledError("Pesquisa cancelada pelo usuário.")
      let fields
      try { fields = parseCsvLine(line.replace(/^\uFEFF/, "")) }
      catch (error) {
        const reason = error instanceof Error ? error.message : "CSV invalido"
        throw new Error(`${reason} na linha ${count + 1} de ${path.basename(filePath)}.`)
      }
      if (fields.length !== expected) throw new Error(`Layout mudou na linha ${count + 1} de ${path.basename(filePath)}.`)
      onRow(fields, count + 1)
      count += 1
      const now = performance.now()
      if (count % 250_000 === 0 || now - lastProgress >= 2000) { onProgress(count, stream.bytesRead); lastProgress = now }
    }
  } finally { lines.close(); stream.destroy() }
  return { rows: count, bytes: stream.bytesRead }
}

function addCapped(rows, row, limit) {
  if (rows.some((item) => item.cnpj === row.cnpj)) return false
  if (rows.length >= limit) return true
  rows.push(row)
  return false
}

async function scan(dataDir, stateDir, executionId, runId, expectedSnapshotKey, candidates) {
  if (!Array.isArray(candidates) || candidates.length < 1 || candidates.length > MAX_CANDIDATES) throw new Error("A lista de candidatos excede o limite de 20.000 ou está inválida.")
  const inputBytes = Buffer.byteLength(JSON.stringify(candidates), "utf8")
  if (inputBytes > MAX_INPUT_BYTES) throw new Error("Os dados desta prospecção excedem o limite seguro de 32 MB.")
  if (candidates.some((item) => !item || typeof item.candidate_id !== "string" || typeof item.company_name !== "string")) throw new Error("Há candidatos inválidos na entrada da varredura.")
  const source = await inspect(dataDir)
  if (!source.ready || source.snapshotKey !== expectedSnapshotKey) throw new Error("A base local mudou ou não passou na validação antes da pesquisa.")

  mkdirSync(stateDir, { recursive: true })
  const jobDir = path.join(stateDir, executionId)
  if (!existsSync(jobDir) || !statSync(jobDir).isDirectory()) throw new Error("A pasta de estado desta execução não foi preparada pelo Suite.")
  const paths = { stateDir, jobDir }
  const startedAt = new Date().toISOString()
  const job = { enabled: true, executionId, runId, snapshotKey: source.snapshotKey, datasetVersion: `D${source.competence}`, status: "scanning", phase: "preparing", currentFile: null, bytesRead: 0, totalBytes: source.totalBytes, rowsRead: 0, completedFiles: 0, totalFiles: 20, candidateTotal: candidates.length, candidatesProcessed: 0, freeBytes: freeBytes(stateDir), rateBytesPerSecond: null, startedAt, updatedAt: startedAt, finishedAt: null, importId: null, summary: null, workerPid: process.pid, message: null }
  writeState(paths, job, "phase", { message: "Validação da base concluída; preparando os candidatos." })

  const phoneIndex = new Map(), zipIndex = new Map(), tokenIndex = new Map()
  const meta = candidates.map((candidate, index) => {
    const phone = normalizePhone(candidate.phone)
    const cep = candidateCep(candidate.address)
    const tokens = tokensFor(candidate.company_name)
    if (phone.length >= 10) { if (!phoneIndex.has(phone)) phoneIndex.set(phone, []); phoneIndex.get(phone).push(index) }
    if (cep.length === 8) { if (!zipIndex.has(cep)) zipIndex.set(cep, []); zipIndex.get(cep).push(index) }
    for (const token of tokens) { if (!tokenIndex.has(token)) tokenIndex.set(token, []); tokenIndex.get(token).push(index) }
    return { candidate, index, phone, cep, tokens, bases: new Set(), companyOverflow: false, phoneRows: [], zipRows: [], nameRows: [], phoneOverflow: false, zipOverflow: false, nameOverflow: false, unsearchable: !(phone.length >= 10 || cep.length === 8 || tokens.some((token) => token.length >= 4)) }
  })
  const baseCandidates = new Map()
  const legalNameByBase = new Map()
  let started = performance.now(), completedBytes = 0
  const progress = (phase, file, rows, fileBytes, rowsBeforeFile) => {
    const bytesRead = Math.min(source.totalBytes, completedBytes + Math.min(file.bytes, fileBytes))
    const elapsed = (performance.now() - started) / 1000
    job.phase = phase; job.currentFile = file.relativePath; job.bytesRead = bytesRead; job.rowsRead = rowsBeforeFile + rows
    job.rateBytesPerSecond = elapsed > 0 ? bytesRead / elapsed : null
    writeState(paths, job, "progress", { bytesRead, rowsRead: job.rowsRead, message: `Lendo ${file.relativePath}.` })
  }
  const files = source.files
  try {
    for (const file of files.filter((item) => item.group === "Empresas")) {
      if (isCancelled(paths)) throw new CancelledError()
      job.phase = "companies"; job.currentFile = file.relativePath
      writeState(paths, job, "phase", { message: `Localizando razões sociais candidatas em ${file.relativePath}.` })
      const rowsBeforeFile = job.rowsRead
      const result = await readRows(path.join(dataDir, file.relativePath), companyFields, (fields) => {
        const base = fields[0], legalName = fields[1]
        const seen = new Set()
        for (const token of tokensFor(legalName)) for (const index of tokenIndex.get(token) ?? []) seen.add(index)
        for (const index of seen) {
          const existing = baseCandidates.get(base)
          if (existing?.includes(index)) continue
          if (meta[index].bases.size >= companyLimit) { meta[index].companyOverflow = true; continue }
          let list = existing
          if (!list) { list = []; baseCandidates.set(base, list) }
          list.push(index); meta[index].bases.add(base)
          legalNameByBase.set(base, legalName)
        }
      }, (rows, bytes) => progress("companies", file, rows, bytes, rowsBeforeFile), () => isCancelled(paths))
      completedBytes += result.bytes; job.completedFiles += 1
      job.bytesRead = completedBytes; job.rowsRead = rowsBeforeFile + result.rows
      writeState(paths, job, "progress", { bytesRead: job.bytesRead, rowsRead: job.rowsRead, message: `Concluído ${file.relativePath}.` })
    }
    for (const file of files.filter((item) => item.group === "Estabelecimentos")) {
      if (isCancelled(paths)) throw new CancelledError()
      job.phase = "establishments"; job.currentFile = file.relativePath
      writeState(paths, job, "phase", { message: `Comparando estabelecimentos em ${file.relativePath}.` })
      const rowsBeforeFile = job.rowsRead
      const result = await readRows(path.join(dataDir, file.relativePath), establishmentFields, (fields, rowNumber) => {
        const base = fields[0], cnpj = `${fields[0]}${fields[1]}${fields[2]}`
        const candidateSet = new Set([...(phoneIndex.get(`${fields[21]}${fields[22]}`) ?? []), ...(phoneIndex.get(`${fields[23]}${fields[24]}`) ?? []), ...(zipIndex.get(fields[17]) ?? []), ...(baseCandidates.get(base) ?? [])])
        const tradeTokens = tokensFor(fields[4])
        for (const token of tradeTokens) for (const index of tokenIndex.get(token) ?? []) candidateSet.add(index)
        if (!candidateSet.size) return
        const row = { cnpj, legal_name: legalNameByBase.get(base) ?? null, trade_name: fields[4] || null, status_code: fields[5], city_code: fields[19], state_code: fields[20], cnae: fields[11], phone1: `${fields[21]}${fields[22]}`, phone2: `${fields[23]}${fields[24]}`, postal_code: fields[17], rowNumber }
        for (const index of candidateSet) {
          const item = meta[index]
          if (item.candidate.existing_cnpj) continue
          const nameScore = Math.max(similarity(item.candidate.company_name, row.legal_name), similarity(item.candidate.company_name, row.trade_name))
          const phoneMatch = item.phone.length >= 10 && (row.phone1 === item.phone || row.phone2 === item.phone)
          const zipMatch = item.cep.length === 8 && row.postal_code === item.cep
          const matchRow = { ...row, phoneMatch, zipMatch, nameScore }
          if (phoneMatch) item.phoneOverflow ||= addCapped(item.phoneRows, matchRow, 30)
          if (zipMatch) item.zipOverflow ||= addCapped(item.zipRows, matchRow, 50)
          if (nameScore > 0) {
            if (item.nameRows.length < 40 || item.nameRows.some((entry) => entry.cnpj === cnpj)) {
              if (!item.nameRows.some((entry) => entry.cnpj === cnpj)) item.nameRows.push(matchRow)
            } else item.nameOverflow = true
          }
        }
      }, (rows, bytes) => progress("establishments", file, rows, bytes, rowsBeforeFile), () => isCancelled(paths))
      completedBytes += result.bytes; job.completedFiles += 1
      job.bytesRead = completedBytes; job.rowsRead = rowsBeforeFile + result.rows
      writeState(paths, job, "progress", { bytesRead: job.bytesRead, rowsRead: job.rowsRead, message: `Concluído ${file.relativePath}.` })
    }
    job.phase = "matching"
    const checkedAt = new Date().toISOString()
    const results = meta.map((item) => {
      const candidate = item.candidate
      if (candidate.existing_cnpj) return { candidate_id: candidate.candidate_id, research_status: "skipped", cnpj: null }
      const matches = new Map()
      for (const row of item.phoneRows) matches.set(row.cnpj, { ...row, phoneMatch: true })
      for (const row of item.zipRows) matches.set(row.cnpj, { ...(matches.get(row.cnpj) ?? row), zipMatch: true })
      for (const row of item.nameRows) matches.set(row.cnpj, { ...(matches.get(row.cnpj) ?? row) })
      const truncated = item.phoneOverflow || item.zipOverflow || item.nameOverflow || item.companyOverflow
      if (truncated) return { candidate_id: candidate.candidate_id, research_status: "ambiguous", cnpj: null }
      if (item.unsearchable) return { candidate_id: candidate.candidate_id, research_status: "ambiguous", cnpj: null }
      const ranked = [...matches.values()].map((row) => {
        const legalScore = similarity(candidate.company_name, row.legal_name)
        const tradeScore = similarity(candidate.company_name, row.trade_name)
        const score = (row.phoneMatch ? 5 : 0) + (row.zipMatch ? 1.5 : 0) + Math.max(legalScore, tradeScore) * 3
        return { row, nameScore: Math.max(legalScore, tradeScore), score }
      }).sort((a, b) => b.score - a.score)
      const best = ranked[0]
      if (!best) return { candidate_id: candidate.candidate_id, research_status: "not_found", cnpj: null }
      const second = ranked[1]
      const clear = (!second || best.score - second.score >= 1.25) && ((best.row.phoneMatch && best.nameScore >= 0.3) || (best.row.zipMatch && best.nameScore >= 0.75))
      if (!clear || !isValidCnpj(best.row.cnpj)) return { candidate_id: candidate.candidate_id, research_status: "ambiguous", cnpj: null }
      return { candidate_id: candidate.candidate_id, research_status: "found", cnpj: best.row.cnpj, legal_name: best.row.legal_name, trade_name: best.row.trade_name, registration_status: best.row.status_code ? `Código de situação cadastral ${best.row.status_code}` : null, matched_city: best.row.city_code ? `Código de município da Receita ${best.row.city_code}` : null, matched_state_code: best.row.state_code || null, primary_cnae: best.row.cnae || null, source_url: officialDataUrl, source_checked_at: checkedAt, source_row_number: best.row.rowNumber + 1 }
    })
    const finalInspection = await inspect(dataDir)
    if (!finalInspection.ready || finalInspection.snapshotKey !== expectedSnapshotKey) throw new Error("Os arquivos da Receita mudaram durante a pesquisa. Nenhum resultado será gravado.")
    if (isCancelled(paths)) throw new CancelledError("Pesquisa cancelada pelo usuário.")
    const resultFile = path.join(jobDir, "result.json")
    const output = JSON.stringify({ snapshotKey: expectedSnapshotKey, results })
    if (Buffer.byteLength(output, "utf8") > MAX_RESULT_BYTES) throw new Error("Os resultados excederam o limite seguro de 32 MB.")
    writeFileSync(resultFile, output, "utf8")
    const counts = results.reduce((summary, result) => { summary[result.research_status] += 1; return summary }, { found: 0, ambiguous: 0, not_found: 0, skipped: 0 })
    job.status = "scan_complete"; job.phase = "staging"; job.candidatesProcessed = results.length; job.summary = { processed: results.length, total: candidates.length, suggestions: counts.found, ambiguous: counts.ambiguous, notFound: counts.not_found, skipped: counts.skipped, failed: 0, chunksStaged: 0, chunksTotal: Math.ceil(results.length / 50), elapsedMs: Math.round(performance.now() - started) }
    if (isCancelled(paths)) throw new CancelledError("Pesquisa cancelada pelo usuário.")
    writeState(paths, job, "phase", { message: "Varredura concluída; resultados locais prontos para gravação por lotes.", suggestions: counts.found, ambiguous: counts.ambiguous, notFound: counts.not_found })
  } catch (error) {
    const cancelled = error instanceof CancelledError || isCancelled(paths)
    try { rmSync(path.join(jobDir, "result.json"), { force: true }) } catch {}
    const workerLocation = error instanceof Error ? error.stack?.split("\n").find((line) => line.includes("prospecting-cnpj-local-worker.mjs"))?.trim() : null
    const failureMessage = error instanceof Error ? error.message : "A varredura local falhou."
    job.status = cancelled ? "cancelled" : "failed"; job.phase = "finished"; job.finishedAt = new Date().toISOString(); job.message = cancelled ? "Pesquisa cancelada. Nenhum resultado parcial foi aplicado." : `${failureMessage}${workerLocation ? ` · ${workerLocation}` : ""}`.slice(0, 500)
    writeState(paths, job, cancelled ? "terminal" : "error", { message: job.message })
  }
}

async function main() {
  const [mode, dataDirArg, stateDirArg, executionId, runId, snapshot] = process.argv.slice(2)
  if (!mode || !dataDirArg || !stateDirArg) throw new Error("Uso: worker <inspect|scan|status> <dataDir> <stateDir> [executionId runId snapshotKey]")
  const dataDir = path.resolve(dataDirArg), stateDir = path.resolve(stateDirArg)
  if (mode === "status") {
    const file = path.join(stateDir, String(executionId), "status.json")
    process.stdout.write(existsSync(file) ? readFileSync(file, "utf8") : JSON.stringify({ status: "failed", message: "Execução não encontrada." }))
    return
  }
  if (mode === "inspect") { process.stdout.write(JSON.stringify(await inspect(dataDir))); return }
  if (mode !== "scan" || !/^[0-9a-f-]{36}$/i.test(executionId ?? "") || !/^[0-9a-f-]{36}$/i.test(runId ?? "") || !/^[a-f0-9]{64}$/i.test(snapshot ?? "")) throw new Error("Parâmetros da varredura inválidos.")
  let input = ""
  for await (const chunk of process.stdin) { input += chunk.toString("utf8"); if (Buffer.byteLength(input, "utf8") > MAX_INPUT_BYTES) throw new Error("A entrada excede 32 MB.") }
  await scan(dataDir, stateDir, executionId, runId, snapshot, JSON.parse(input))
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "Falha no worker local."}\n`); process.exitCode = 1 })
