"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  evaluateLeadRows,
  evaluateLeadSpreadsheet,
  importLeads,
} from "@/app/actions/leads"
import {
  applySessionDomainConflicts,
  isSpreadsheetRowClean,
  LEAD_SPREADSHEET_MAX_BYTES,
  LEAD_SPREADSHEET_MAX_FILES,
  preserveExternalConflicts,
  summarizeEvaluatedRows,
  validateRawRows,
} from "@/lib/leads/spreadsheet-model"
import type {
  LeadWritePayload,
  SpreadsheetEvaluatedRow,
  SpreadsheetValueKey,
} from "@/lib/leads/types"
import type {
  ImportFileEntry,
  ImportIssueItem,
  ImportPreviewRow,
  ImportTotals,
  SidebarMode,
} from "./LeadImport.types"

const PREVIEW_LIMIT = 50
const ISSUES_COLLAPSED = 8

function syncSessionConflicts(entries: ImportFileEntry[]): ImportFileEntry[] {
  const ready = entries.filter((entry) => entry.status === "ready")
  const updated = applySessionDomainConflicts(
    ready.map((entry) => ({
      id: entry.id,
      name: entry.name,
      rows: entry.rows,
    })),
  )
  const byId = new Map(updated.map((item) => [item.id, item.rows]))
  return entries.map((entry) => {
    const rows = byId.get(entry.id)
    return rows ? { ...entry, rows } : entry
  })
}

function isXlsxFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".xlsx")
}

function cloneRows(rows: SpreadsheetEvaluatedRow[]): SpreadsheetEvaluatedRow[] {
  return rows.map((row) => ({
    ...row,
    values: { ...row.values },
    issues: [...row.issues],
    payload: row.payload,
  }))
}

export function useLeadImportSession() {
  const [files, setFiles] = useState<ImportFileEntry[]>([])
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("hidden")
  const [draftRows, setDraftRows] = useState<SpreadsheetEvaluatedRow[] | null>(
    null,
  )
  const [issuesExpanded, setIssuesExpanded] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isRevalidating, setIsRevalidating] = useState(false)

  const processingIdRef = useRef<string | null>(null)
  const progressTimersRef = useRef<Map<string, number>>(new Map())
  const filesRef = useRef(files)
  filesRef.current = files
  const [queueEpoch, setQueueEpoch] = useState(0)

  const stopProgress = useCallback((id: string) => {
    const timer = progressTimersRef.current.get(id)
    if (timer) {
      window.clearInterval(timer)
      progressTimersRef.current.delete(id)
    }
  }, [])

  const startProgress = useCallback(
    (id: string) => {
      stopProgress(id)
      const timer = window.setInterval(() => {
        setFiles((current) =>
          current.map((entry) => {
            if (entry.id !== id || entry.status !== "analyzing") return entry
            const next = entry.progress + (90 - entry.progress) * 0.12
            return { ...entry, progress: Math.min(90, next) }
          }),
        )
      }, 160)
      progressTimersRef.current.set(id, timer)
    },
    [stopProgress],
  )

  const patchFile = useCallback(
    (id: string, patch: Partial<ImportFileEntry>) => {
      setFiles((current) =>
        current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      )
    },
    [],
  )

  useEffect(() => {
    return () => {
      for (const timer of progressTimersRef.current.values()) {
        window.clearInterval(timer)
      }
      progressTimersRef.current.clear()
    }
  }, [])

  const queuedId = files.find((entry) => entry.status === "queued")?.id ?? null

  useEffect(() => {
    if (!queuedId) return
    if (processingIdRef.current) return
    const next = filesRef.current.find((entry) => entry.id === queuedId)
    if (!next) return

    const requestId = next.id
    processingIdRef.current = requestId

    void (async () => {
      patchFile(requestId, {
        status: "analyzing",
        progress: 12,
        stageLabel: "Lendo linhas da planilha",
        failureMessage: null,
      })
      startProgress(requestId)

      const formData = new FormData()
      formData.set("file", next.file)
      const result = await evaluateLeadSpreadsheet(formData)

      stopProgress(requestId)
      processingIdRef.current = null
      setQueueEpoch((value) => value + 1)

      setFiles((current) => {
        if (!current.some((entry) => entry.id === requestId)) return current
        if (result.status === "error") {
          return current.map((entry) =>
            entry.id === requestId
              ? {
                  ...entry,
                  status: "failed" as const,
                  progress: 100,
                  stageLabel: "",
                  failureMessage: result.message,
                  rows: [],
                }
              : entry,
          )
        }
        return syncSessionConflicts(
          current.map((entry) =>
            entry.id === requestId
              ? {
                  ...entry,
                  status: "ready" as const,
                  progress: 100,
                  stageLabel: "",
                  failureMessage: null,
                  rows: result.rows,
                }
              : entry,
          ),
        )
      })
    })()
  }, [queuedId, queueEpoch, patchFile, startProgress, stopProgress])

  const editingId =
    typeof sidebarMode === "object" ? sidebarMode.editing : null

  const addFiles = useCallback(
    (incoming: File[]) => {
      if (typeof sidebarMode === "object") return
      setNotice(null)
      setImportError(null)

      const remaining = LEAD_SPREADSHEET_MAX_FILES - filesRef.current.length
      if (remaining <= 0) {
        setNotice(`No máximo ${LEAD_SPREADSHEET_MAX_FILES} arquivos por importação.`)
        return
      }

      const accepted: ImportFileEntry[] = []
      let rejected = false

      for (const file of incoming) {
        if (accepted.length >= remaining) {
          rejected = true
          break
        }
        if (!isXlsxFile(file)) {
          rejected = true
          continue
        }
        if (file.size === 0) {
          rejected = true
          continue
        }
        if (file.size > LEAD_SPREADSHEET_MAX_BYTES) {
          rejected = true
          continue
        }
        accepted.push({
          id: crypto.randomUUID(),
          file,
          name: file.name,
          uploadedAt: new Date().toISOString(),
          status: "queued",
          progress: 0,
          stageLabel: "Na fila",
          failureMessage: null,
          rows: [],
        })
      }

      if (accepted.length === 0) {
        setNotice("Envie arquivos .xlsx de até 1 MB.")
        return
      }
      if (rejected) {
        setNotice("Alguns arquivos foram ignorados. Use .xlsx de até 1 MB, no máximo 5.")
      }

      setFiles((current) => [...current, ...accepted])
      setSidebarMode((mode) => (mode === "hidden" ? "overview" : mode))
    },
    [sidebarMode],
  )

  const removeFile = useCallback((id: string) => {
    stopProgress(id)
    if (processingIdRef.current === id) {
      processingIdRef.current = null
      setQueueEpoch((value) => value + 1)
    }
    setImportError(null)
    setFiles((current) => {
      const next = syncSessionConflicts(current.filter((entry) => entry.id !== id))
      return next
    })
    setSidebarMode((mode) => {
      if (typeof mode === "object" && mode.editing === id) return "overview"
      return mode
    })
    setDraftRows((current) => {
      if (typeof sidebarMode === "object" && sidebarMode.editing === id) {
        return null
      }
      return current
    })
  }, [sidebarMode, stopProgress])

  const startEdit = useCallback((id: string) => {
    const entry = filesRef.current.find((item) => item.id === id)
    if (!entry || entry.status !== "ready") return
    setDraftRows(cloneRows(entry.rows))
    setSidebarMode({ editing: id })
    setImportError(null)
  }, [])

  const cancelEdit = useCallback(() => {
    setDraftRows(null)
    setSidebarMode(filesRef.current.length > 0 ? "overview" : "hidden")
  }, [])

  const updateDraftCell = useCallback(
    (rowNumber: number, field: SpreadsheetValueKey, value: string) => {
      setDraftRows((current) => {
        if (!current) return current
        return current.map((row) =>
          row.row === rowNumber
            ? { ...row, values: { ...row.values, [field]: value } }
            : row,
        )
      })
    },
    [],
  )

  const blurDraftRow = useCallback((_rowNumber: number) => {
    setDraftRows((current) => {
      if (!current) return current
      const validated = validateRawRows(
        current.map((row) => ({ row: row.row, values: row.values })),
      )
      return preserveExternalConflicts(current, validated)
    })
  }, [])

  const revalidateEditing = useCallback(async () => {
    if (!editingId || !draftRows) return
    setIsRevalidating(true)
    setImportError(null)
    const result = await evaluateLeadRows(
      draftRows.map((row) => ({ row: row.row, values: row.values })),
    )
    setIsRevalidating(false)
    if (result.status === "error") {
      setImportError(result.message)
      return
    }
    setFiles((current) =>
      syncSessionConflicts(
        current.map((entry) =>
          entry.id === editingId ? { ...entry, rows: result.rows } : entry,
        ),
      ),
    )
    setDraftRows(null)
    setSidebarMode("overview")
  }, [draftRows, editingId])

  const importAll = useCallback(async () => {
    const payloads: LeadWritePayload[] = []
    for (const entry of filesRef.current) {
      if (entry.status !== "ready") return false
      for (const row of entry.rows) {
        if (!isSpreadsheetRowClean(row) || !row.payload) return false
        payloads.push(row.payload)
      }
    }
    if (payloads.length === 0) return false

    setIsImporting(true)
    setImportError(null)
    const result = await importLeads(payloads)
    setIsImporting(false)
    if (result.status === "error") {
      setImportError(result.message)
      return false
    }
    return true
  }, [])

  const reset = useCallback(() => {
    for (const id of progressTimersRef.current.keys()) stopProgress(id)
    processingIdRef.current = null
    setQueueEpoch(0)
    setFiles([])
    setSidebarMode("hidden")
    setDraftRows(null)
    setIssuesExpanded(false)
    setNotice(null)
    setImportError(null)
    setIsImporting(false)
    setIsRevalidating(false)
  }, [stopProgress])

  useEffect(() => {
    if (files.length === 0 && sidebarMode !== "hidden" && !editingId) {
      setSidebarMode("hidden")
    }
  }, [editingId, files.length, sidebarMode])

  const totals = useMemo<ImportTotals>(() => {
    let found = 0
    let valid = 0
    let problems = 0
    for (const entry of files) {
      if (entry.status !== "ready") continue
      const summary = summarizeEvaluatedRows(entry.rows)
      found += summary.found
      valid += summary.valid
      problems += summary.problems
    }
    return { files: files.length, found, valid, problems }
  }, [files])

  const previewRows = useMemo<ImportPreviewRow[]>(() => {
    const rows: ImportPreviewRow[] = []
    for (const entry of files) {
      if (entry.status !== "ready") continue
      for (const row of entry.rows) {
        if (!isSpreadsheetRowClean(row) || !row.payload) continue
        rows.push({
          fileId: entry.id,
          row: row.row,
          company_name: row.payload.company_name,
          website: row.payload.website_domain,
          contact_name: row.payload.contact_name ?? "",
          phone: row.payload.phone ?? "",
          email: row.payload.email ?? "",
        })
        if (rows.length >= PREVIEW_LIMIT) return rows
      }
    }
    return rows
  }, [files])

  const issueItems = useMemo<ImportIssueItem[]>(() => {
    const items: ImportIssueItem[] = []
    for (const entry of files) {
      if (entry.status !== "ready") continue
      for (const row of entry.rows) {
        for (const issue of row.issues) {
          items.push({
            fileId: entry.id,
            fileName: entry.name,
            issue,
          })
        }
      }
    }
    return items
  }, [files])

  const isAnalyzing = files.some(
    (entry) => entry.status === "queued" || entry.status === "analyzing",
  )
  const hasFailed = files.some((entry) => entry.status === "failed")
  const allReady =
    files.length > 0 && files.every((entry) => entry.status === "ready")
  const canImport =
    allReady && totals.problems === 0 && totals.valid > 0 && !isImporting

  let importBlockReason: string | null = null
  if (files.length === 0) importBlockReason = "Envie uma planilha"
  else if (isAnalyzing) importBlockReason = "Aguardando análise"
  else if (hasFailed) importBlockReason = "Remova os arquivos com erro"
  else if (totals.problems > 0) {
    importBlockReason = `Resolver ${totals.problems} ${totals.problems === 1 ? "problema" : "problemas"}`
  } else if (totals.valid === 0) importBlockReason = "Nenhuma linha válida"

  const isBusy = isAnalyzing || isImporting || isRevalidating
  const dropDisabled =
    typeof sidebarMode === "object" || files.length >= LEAD_SPREADSHEET_MAX_FILES
  const visibleIssues = issuesExpanded
    ? issueItems
    : issueItems.slice(0, ISSUES_COLLAPSED)

  return {
    files,
    sidebarMode,
    draftRows,
    editingId,
    totals,
    previewRows,
    issueItems,
    visibleIssues,
    issuesExpanded,
    setIssuesExpanded,
    notice,
    importError,
    isBusy,
    isAnalyzing,
    isImporting,
    isRevalidating,
    canImport,
    importBlockReason,
    dropDisabled,
    addFiles,
    removeFile,
    startEdit,
    cancelEdit,
    updateDraftCell,
    blurDraftRow,
    revalidateEditing,
    importAll,
    reset,
  }
}
