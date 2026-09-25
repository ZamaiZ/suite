import "server-only"

import { existsSync, realpathSync, statSync } from "node:fs"
import path from "node:path"

export type LocalCnpjPaths = { dataDir: string; stateDir: string }

function within(parent: string, child: string) {
  const relative = path.relative(parent, child)
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
}

function canonical(value: string) {
  const absolute = path.resolve(value)
  let ancestor = absolute
  const suffix: string[] = []
  while (!existsSync(ancestor)) {
    const parent = path.dirname(ancestor)
    if (parent === ancestor) return absolute
    suffix.unshift(path.basename(ancestor))
    ancestor = parent
  }
  try { return path.join(realpathSync.native(ancestor), ...suffix) } catch { return absolute }
}

export function resolveLocalCnpjPaths(): LocalCnpjPaths | null {
  const data = process.env.PROSPECTING_CNPJ_DATA_DIR?.trim()
  const state = (process.env.PROSPECTING_CNPJ_STATE_DIR || process.env.PROSPECTING_CNPJ_INDEX_DIR)?.trim()
  if (!data || !state) return null
  const dataDir = canonical(data)
  const stateDir = canonical(state)
  if (within(dataDir, stateDir) || within(stateDir, dataDir)) return null
  return { dataDir, stateDir }
}

export function isReadableDirectory(directory: string) {
  try { return existsSync(directory) && statSync(directory).isDirectory() } catch { return false }
}

export function isLocalCnpjRuntimeAvailable() {
  return process.env.NODE_ENV !== "production" || process.env.PROSPECTING_CNPJ_LOCAL_ENABLED === "true"
}
