import "server-only"

import { spawn } from "node:child_process"
import { appendFileSync, closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import type { CnpjSearchCandidate, LocalCnpjScanEvent, LocalCnpjScanState } from "./contracts"
import type { LocalCnpjPaths } from "./config"

const MAX_INPUT_BYTES = 32 * 1024 * 1024
const MAX_RESULT_BYTES = 32 * 1024 * 1024
const workerFile = path.join(process.cwd(), "scripts", "prospecting-cnpj-local-worker.mjs")
const activeStates = new Set(["scanning", "scan_complete", "staging", "committing", "commit_pending"])
const terminalStates = new Set(["completed", "cancelled", "failed"])

const rootFile = (paths: LocalCnpjPaths, name: string) => path.join(paths.stateDir, name)
const jobDir = (paths: LocalCnpjPaths, executionId: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(executionId)) throw new Error("Identificador de execução inválido.")
  const target = path.resolve(paths.stateDir, executionId)
  if (path.dirname(target) !== path.resolve(paths.stateDir)) throw new Error("Caminho de execução inválido.")
  return target
}

function writeJson(file: string, value: unknown) {
  const temporary = `${file}.${process.pid}.tmp`
  writeFileSync(temporary, JSON.stringify(value), "utf8")
  renameSync(temporary, file)
}

function safeState(raw: unknown, enabled = true): LocalCnpjScanState {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {}
  const statuses = ["idle", "scanning", "scan_complete", "staging", "committing", "commit_pending", "completed", "cancelled", "failed"]
  const phases = ["preparing", "companies", "establishments", "matching", "staging", "committing", "finished"]
  const summaryRaw = value.summary && typeof value.summary === "object" ? value.summary as Record<string, unknown> : null
  const numeric = (key: string) => Number.isFinite(value[key]) ? Number(value[key]) : 0
  const summary = summaryRaw && ["processed", "total", "suggestions", "ambiguous", "notFound", "skipped", "failed", "chunksStaged", "chunksTotal", "elapsedMs"].every((key) => Number.isFinite(summaryRaw[key]))
    ? summaryRaw as unknown as LocalCnpjScanState["summary"] : null
  return {
    enabled,
    executionId: typeof value.executionId === "string" ? value.executionId : null,
    runId: typeof value.runId === "string" ? value.runId : null,
    snapshotKey: typeof value.snapshotKey === "string" && /^[a-f0-9]{64}$/i.test(value.snapshotKey) ? value.snapshotKey : null,
    datasetVersion: typeof value.datasetVersion === "string" ? value.datasetVersion : null,
    status: statuses.includes(String(value.status)) ? value.status as LocalCnpjScanState["status"] : "failed",
    phase: phases.includes(String(value.phase)) ? value.phase as LocalCnpjScanState["phase"] : "finished",
    currentFile: typeof value.currentFile === "string" ? value.currentFile.slice(0, 300) : null,
    bytesRead: numeric("bytesRead"), totalBytes: numeric("totalBytes"), rowsRead: numeric("rowsRead"),
    completedFiles: numeric("completedFiles"), totalFiles: numeric("totalFiles"), candidateTotal: numeric("candidateTotal"), candidatesProcessed: numeric("candidatesProcessed"),
    freeBytes: Number.isFinite(value.freeBytes) ? Number(value.freeBytes) : null,
    rateBytesPerSecond: Number.isFinite(value.rateBytesPerSecond) ? Number(value.rateBytesPerSecond) : null,
    startedAt: typeof value.startedAt === "string" ? value.startedAt : null,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
    finishedAt: typeof value.finishedAt === "string" ? value.finishedAt : null,
    importId: typeof value.importId === "string" ? value.importId : null,
    summary,
    message: typeof value.message === "string" ? value.message.slice(0, 500) : null,
  }
}

function pidAlive(pid: unknown) {
  if (!Number.isInteger(pid) || Number(pid) < 1) return false
  try { process.kill(Number(pid), 0); return true } catch { return false }
}

function activeLock(paths: LocalCnpjPaths): Record<string, unknown> | null {
  try { return JSON.parse(readFileSync(rootFile(paths, "active.lock"), "utf8")) as Record<string, unknown> } catch { return null }
}

function pruneCnpjScanHistory(paths: LocalCnpjPaths) {
  if (!existsSync(paths.stateDir)) return
  const jobs = readdirSync(paths.stateDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^[0-9a-f-]{36}$/i.test(entry.name) && !entry.isSymbolicLink())
    .map((entry) => {
      const directory = path.join(paths.stateDir, entry.name)
      try {
        const statusFile = path.join(directory, "status.json")
        const value = JSON.parse(readFileSync(statusFile, "utf8")) as Record<string, unknown>
        return { id: entry.name, directory, status: String(value.status), updatedAt: statSync(statusFile).mtimeMs }
      } catch { return { id: entry.name, directory, status: "invalid", updatedAt: statSync(directory).mtimeMs } }
    })
  const lock = activeLock(paths)
  const terminal = jobs.filter((job) => terminalStates.has(job.status) && job.id !== lock?.executionId).sort((left, right) => right.updatedAt - left.updatedAt)
  for (const job of jobs) {
    const expired = Date.now() - job.updatedAt > 24 * 60 * 60 * 1000
    const tooOld = terminalStates.has(job.status) && terminal.indexOf(job) >= 10
    if (job.id !== lock?.executionId && (expired || tooOld)) rmSync(job.directory, { recursive: true, force: true })
  }
}

export async function runLocalCnpjWorker<T>(paths: LocalCnpjPaths, mode: "inspect", stdinInput = ""): Promise<T> {
  const child = spawn(process.execPath, [workerFile, mode, paths.dataDir, paths.stateDir], { cwd: process.cwd(), windowsHide: true, stdio: ["pipe", "pipe", "pipe"] })
  const stdout: Buffer[] = []; const stderr: Buffer[] = []; let bytes = 0
  child.stdout.on("data", (part: Buffer) => { bytes += part.length; if (bytes <= MAX_RESULT_BYTES) stdout.push(part); else child.kill() })
  child.stderr.on("data", (part: Buffer) => { if (Buffer.concat(stderr).length < 12_000) stderr.push(part) })
  child.stdin.end(stdinInput)
  const code = await new Promise<number>((resolve, reject) => { child.once("error", reject); child.once("close", (value) => resolve(value ?? 1)) })
  if (code !== 0 || bytes > MAX_RESULT_BYTES) throw new Error(Buffer.concat(stderr).toString("utf8").slice(0, 500) || "A inspeção local falhou.")
  try { return JSON.parse(Buffer.concat(stdout).toString("utf8")) as T } catch { throw new Error("O worker local retornou uma inspeção inválida.") }
}

export async function startCnpjScanWorker(paths: LocalCnpjPaths, executionId: string, runId: string, snapshotKey: string, candidates: CnpjSearchCandidate[]): Promise<boolean> {
  if (candidates.length > 20_000 || Buffer.byteLength(JSON.stringify(candidates), "utf8") > MAX_INPUT_BYTES) return false
  const directory = jobDir(paths, executionId)
  mkdirSync(paths.stateDir, { recursive: true })
  pruneCnpjScanHistory(paths)
  try {
    const lockFd = openSync(rootFile(paths, "active.lock"), "wx")
    writeFileSync(lockFd, JSON.stringify({ executionId, runId, workerPid: null, startedAt: new Date().toISOString() }), "utf8")
    closeSync(lockFd)
  } catch {
    const current = activeLock(paths)
    if (current && !pidAlive(current.workerPid)) {
      const startedAt = typeof current.startedAt === "string" ? Date.parse(current.startedAt) : 0
      if (!current.workerPid && Date.now() - startedAt < 30_000) return false
      const previous = current.executionId ? await readCnpjScanState(paths, String(current.executionId)) : null
      if (!previous || !activeStates.has(previous.status)) {
        try { rmSync(rootFile(paths, "active.lock"), { force: true }) } catch {}
        return startCnpjScanWorker(paths, executionId, runId, snapshotKey, candidates)
      }
    }
    return false
  }
  try {
    mkdirSync(directory, { recursive: false })
    const startedAt = new Date().toISOString()
    writeJson(path.join(directory, "status.json"), {
      enabled: true, executionId, runId, snapshotKey, datasetVersion: null, status: "scanning", phase: "preparing", currentFile: null,
      bytesRead: 0, totalBytes: 0, rowsRead: 0, completedFiles: 0, totalFiles: 20, candidateTotal: candidates.length, candidatesProcessed: 0,
      freeBytes: null, rateBytesPerSecond: null, startedAt, updatedAt: startedAt, finishedAt: null, importId: null, summary: null, workerPid: null, message: "Iniciando worker local.",
    })
    writeFileSync(path.join(directory, "events.jsonl"), `${JSON.stringify({ at: startedAt, type: "phase", phase: "preparing", message: "Worker iniciado." })}\n`, "utf8")
    const child = spawn(process.execPath, [workerFile, "scan", paths.dataDir, paths.stateDir, executionId, runId, snapshotKey], { cwd: process.cwd(), detached: true, windowsHide: true, stdio: ["pipe", "ignore", "pipe"] })
    if (!child.pid) throw new Error("O worker não iniciou.")
    const statusPath = path.join(directory, "status.json")
    const initialState = JSON.parse(readFileSync(statusPath, "utf8")) as Record<string, unknown>
    writeJson(statusPath, { ...initialState, workerPid: child.pid })
    writeJson(rootFile(paths, "active.lock"), { executionId, runId, workerPid: child.pid, startedAt })
    child.stderr.on("data", (part: Buffer) => {
      const message = part.toString("utf8").slice(0, 500)
      const file = path.join(directory, "worker-error.txt")
      try { writeFileSync(file, message, "utf8") } catch {}
    })
    const input = JSON.stringify(candidates)
    const flushed = new Promise<void>((resolve, reject) => {
      child.once("error", reject)
      child.stdin.once("error", reject)
      child.stdin.end(input, resolve)
    })
    await flushed
    child.unref()
    return true
  } catch {
    try { rmSync(directory, { recursive: true, force: true }) } catch {}
    try { rmSync(rootFile(paths, "active.lock"), { force: true }) } catch {}
    return false
  }
}

export async function readCnpjScanState(paths: LocalCnpjPaths, executionId: string): Promise<LocalCnpjScanState> {
  const directory = jobDir(paths, executionId)
  let state: Record<string, unknown>
  try {
    const statusPath = path.join(directory, "status.json")
    const stat = lstatSync(statusPath)
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("invalid status path")
    const real = realpathSync.native(statusPath)
    if (!real.startsWith(`${realpathSync.native(paths.stateDir)}${path.sep}`)) throw new Error("status path escaped state directory")
    state = JSON.parse(readFileSync(statusPath, "utf8")) as Record<string, unknown>
  } catch { return safeState({ status: "failed", executionId, message: "O estado local da execução não está disponível." }) }
  const status = safeState(state)
  if (status.status === "scanning" && !pidAlive(state.workerPid)) {
    const message = "O worker terminou sem concluir a varredura. Nenhum resultado foi aplicado."
    const failed = { ...state, status: "failed", phase: "finished", finishedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), message }
    writeJson(path.join(directory, "status.json"), failed)
    try { rmSync(path.join(directory, "result.json"), { force: true }) } catch {}
    await releaseCnpjScanLock(paths, executionId)
    return safeState(failed)
  }
  if (terminalStates.has(status.status)) await releaseCnpjScanLock(paths, executionId)
  return status
}

export async function waitForCnpjWorkerExit(paths: LocalCnpjPaths, executionId: string, timeoutMs = 5000) {
  const lock = activeLock(paths)
  if (lock?.executionId !== executionId || !pidAlive(lock.workerPid)) return true
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    const current = activeLock(paths)
    if (current?.executionId !== executionId || !pidAlive(current.workerPid)) return true
  }
  return false
}

export async function readActiveCnpjScanState(paths: LocalCnpjPaths, runId: string) {
  const lock = activeLock(paths)
  if (!lock || lock.runId !== runId || typeof lock.executionId !== "string") return null
  const state = await readCnpjScanState(paths, lock.executionId)
  return activeStates.has(state.status) ? state : null
}

export async function readAnyActiveCnpjScanState(paths: LocalCnpjPaths) {
  const lock = activeLock(paths)
  if (!lock || typeof lock.executionId !== "string") return null
  const state = await readCnpjScanState(paths, lock.executionId)
  return activeStates.has(state.status) ? state : null
}

export function requestCnpjScanCancellation(paths: LocalCnpjPaths, executionId: string) {
  return withCnpjScanTransitionLock(paths, executionId, (directory) => {
    const lock = activeLock(paths)
    if (lock?.executionId !== executionId) return false
    const state = JSON.parse(readFileSync(path.join(directory, "status.json"), "utf8")) as Record<string, unknown>
    if (state.status !== "scanning" && state.status !== "scan_complete" && state.status !== "staging") return false
    writeJson(path.join(directory, "cancel.json"), { at: new Date().toISOString(), executionId })
    return true
  }) ?? false
}

function withCnpjScanTransitionLock<T>(paths: LocalCnpjPaths, executionId: string, operation: (directory: string) => T): T | null {
  const directory = jobDir(paths, executionId)
  const lockPath = path.join(directory, "transition.lock")
  let lockFd: number
  try {
    lockFd = openSync(lockPath, "wx")
  } catch {
    try {
      let lock: Record<string, unknown> | null = null
      try { lock = JSON.parse(readFileSync(lockPath, "utf8")) as Record<string, unknown> } catch {}
      const ageMs = Date.now() - statSync(lockPath).mtimeMs
      if (lock ? pidAlive(lock.pid) || ageMs < 30_000 : ageMs < 30_000) return null
      rmSync(lockPath, { force: true })
      lockFd = openSync(lockPath, "wx")
    } catch { return null }
  }
  try {
    writeFileSync(lockFd, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }), "utf8")
    return operation(directory)
  } finally {
    closeSync(lockFd)
    rmSync(lockPath, { force: true })
  }
}

export function acquireCnpjScanCommitLease(paths: LocalCnpjPaths, executionId: string): (() => void) | null {
  const directory = jobDir(paths, executionId)
  const lockPath = path.join(directory, "commit.lock")
  let lockFd: number
  try {
    lockFd = openSync(lockPath, "wx")
  } catch {
    try {
      let lock: Record<string, unknown> | null = null
      try { lock = JSON.parse(readFileSync(lockPath, "utf8")) as Record<string, unknown> } catch {}
      if (lock ? pidAlive(lock.pid) : Date.now() - statSync(lockPath).mtimeMs < 30_000) return null
      rmSync(lockPath, { force: true })
      lockFd = openSync(lockPath, "wx")
    } catch { return null }
  }
  try { writeFileSync(lockFd, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }), "utf8") }
  finally { closeSync(lockFd) }
  return () => { rmSync(lockPath, { force: true }) }
}

export function claimCnpjScanCommit(paths: LocalCnpjPaths, executionId: string): boolean {
  return withCnpjScanTransitionLock(paths, executionId, (directory) => {
    const statusPath = path.join(directory, "status.json")
    const state = JSON.parse(readFileSync(statusPath, "utf8")) as Record<string, unknown>
    if (existsSync(path.join(directory, "cancel.json")) || !["staging", "committing", "commit_pending"].includes(String(state.status))) return false
    const now = new Date().toISOString()
    writeJson(statusPath, { ...state, status: "committing", phase: "committing", updatedAt: now, message: "Aplicando resultados atomicamente à prospecção." })
    return true
  }) ?? false
}

export function appendCnpjScanEvent(paths: LocalCnpjPaths, executionId: string, event: LocalCnpjScanEvent) {
  const dir = jobDir(paths, executionId)
  const target = path.join(dir, "events.jsonl")
  if (existsSync(target)) appendFileSync(target, `${JSON.stringify(event)}\n`, "utf8")
  else writeFileSync(target, `${JSON.stringify(event)}\n`, "utf8")
  const lines = readFileSync(target, "utf8").trim().split("\n")
  if (lines.length > 500) writeFileSync(target, `${lines.slice(-500).join("\n")}\n`, "utf8")
}

export function readCnpjScanEvents(paths: LocalCnpjPaths, executionId: string): LocalCnpjScanEvent[] {
  try {
    return readFileSync(path.join(jobDir(paths, executionId), "events.jsonl"), "utf8").split("\n").filter(Boolean).slice(-200).flatMap((line) => {
      try { const event = JSON.parse(line) as LocalCnpjScanEvent; return event && typeof event.at === "string" && typeof event.type === "string" ? [event] : [] } catch { return [] }
    })
  } catch { return [] }
}

export function readCnpjScanResults(paths: LocalCnpjPaths, executionId: string) {
  const file = path.join(jobDir(paths, executionId), "result.json")
  const stat = lstatSync(file)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_RESULT_BYTES) throw new Error("Arquivo temporário de resultados inválido ou acima do limite.")
  return JSON.parse(readFileSync(file, "utf8")) as { snapshotKey: string; results: import("./contracts").LocalCnpjScanResult }
}

export function writeCnpjScanStatus(paths: LocalCnpjPaths, executionId: string, state: LocalCnpjScanState) {
  writeJson(path.join(jobDir(paths, executionId), "status.json"), state)
}

export async function releaseCnpjScanLock(paths: LocalCnpjPaths, executionId: string) {
  const lock = activeLock(paths)
  if (lock?.executionId !== executionId) return
  try { rmSync(path.join(jobDir(paths, executionId), "result.json"), { force: true }) } catch {}
  try { rmSync(path.join(jobDir(paths, executionId), "cancel.json"), { force: true }) } catch {}
  try { rmSync(rootFile(paths, "active.lock"), { force: true }) } catch {}
}

export function localCnpjArtifacts(paths: LocalCnpjPaths) {
  let bytes = 0, events = 0
  if (!existsSync(paths.stateDir)) return { bytes, events }
  const root = realpathSync.native(paths.stateDir)
  for (const entry of readdirSync(paths.stateDir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue
    const target = path.join(paths.stateDir, entry.name)
    if (entry.isDirectory() && /^[0-9a-f-]{36}$/i.test(entry.name)) {
      for (const item of readdirSync(target, { withFileTypes: true })) {
        const file = path.join(target, item.name)
        if (item.isFile() && !item.isSymbolicLink() && realpathSync.native(file).startsWith(`${root}${path.sep}`)) {
          bytes += statSync(file).size
          if (item.name === "events.jsonl") events += readFileSync(file, "utf8").split("\n").filter(Boolean).length
        }
      }
    } else if (entry.isFile() && realpathSync.native(target).startsWith(`${root}${path.sep}`)) bytes += statSync(target).size
  }
  return { bytes, events }
}

export async function clearLocalCnpjArtifacts(paths: LocalCnpjPaths) {
  const lock = activeLock(paths)
  if (lock && typeof lock.executionId === "string") {
    const state = await readCnpjScanState(paths, lock.executionId)
    if (activeStates.has(state.status)) throw new Error("Encerre a execução ativa antes de limpar os arquivos locais.")
  }
  const before = localCnpjArtifacts(paths)
  if (!existsSync(paths.stateDir)) return { deletedBytes: 0, deletedEvents: 0 }
  const canonicalRoot = realpathSync.native(paths.stateDir)
  for (const entry of readdirSync(paths.stateDir, { withFileTypes: true })) {
    const target = path.join(paths.stateDir, entry.name)
    if (entry.isSymbolicLink()) continue
    const actual = realpathSync.native(target)
    if (!actual.startsWith(`${canonicalRoot}${path.sep}`)) continue
    if (entry.isDirectory() && /^[0-9a-f-]{36}$/i.test(entry.name)) rmSync(target, { recursive: true, force: true })
    else if (entry.isFile() && ["active.lock", "active.json"].includes(entry.name)) rmSync(target, { force: true })
  }
  return { deletedBytes: before.bytes, deletedEvents: before.events }
}
