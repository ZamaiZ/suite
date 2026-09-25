"use client"

import { useRef, useState } from "react"
import {
  abortProspectingCnpjFileImportAction,
  commitProspectingCnpjFileImportAction,
  stageProspectingCnpjFileChunkAction,
  startProspectingCnpjFileImportAction,
} from "@/app/actions/prospecting"
import { Spinner } from "@/components/ui/spinner"
import { CnpjCsvError, validateCnpjCsvRow, type CnpjCsvRow } from "@/lib/prospecting/cnpj-files"
import { parseCnpjResearchCsv } from "@/lib/prospecting/cnpj-csv"

const CHUNK_SIZE = 50

export function ProspectingCnpjFileTools({
  runId,
  onImported,
}: {
  runId: string
  onImported: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [summary, setSummary] = useState<{
    suggestions: number
    notFound: number
    ambiguous: number
    skipped: number
  } | null>(null)

  async function importFile(file: File) {
    setBusy(true)
    setError("")
    setMessage("")
    setSummary(null)
    setProgress(0)
    let importId: string | null = null
    let rowNumber = 2
    let chunkIndex = 0
    let chunk: Array<CnpjCsvRow & { source_row_number: number }> = []
    const seenCandidateIds = new Set<string>()
    try {
      for await (const row of parseCnpjResearchCsv(file.stream())) {
        const validated = validateCnpjCsvRow(row, rowNumber)
        if (validated.run_id !== runId) {
          throw new CnpjCsvError("A linha pertence a outra execução de prospecção.", rowNumber, "run_id")
        }
        const canonicalCandidateId = validated.candidate_id.toLowerCase()
        if (seenCandidateIds.has(canonicalCandidateId)) {
          throw new CnpjCsvError("O candidate_id aparece mais de uma vez no CSV.", rowNumber, "candidate_id")
        }
        seenCandidateIds.add(canonicalCandidateId)
        chunk.push({ ...row, source_row_number: rowNumber })
        rowNumber += 1
        if (!importId) {
          const started = await startProspectingCnpjFileImportAction({ runId })
          if (started.status !== "success" || !started.importId) throw new Error(started.status === "error" ? started.message : "Não foi possível iniciar a importação.")
          importId = started.importId
        }
        if (chunk.length === CHUNK_SIZE) {
          const stagedCount = chunk.length
          const staged = await stageProspectingCnpjFileChunkAction({ importId, chunkIndex, rows: chunk })
          if (staged.status !== "success") throw new Error(staged.message)
          setProgress((current) => current + stagedCount)
          chunk = []
          chunkIndex += 1
        }
      }
      if (!importId) {
        const started = await startProspectingCnpjFileImportAction({ runId })
        if (started.status !== "success" || !started.importId) throw new Error(started.status === "error" ? started.message : "Não foi possível iniciar a importação.")
        importId = started.importId
      }
      if (chunk.length) {
        const stagedCount = chunk.length
        const staged = await stageProspectingCnpjFileChunkAction({ importId, chunkIndex, rows: chunk })
        if (staged.status !== "success") throw new Error(staged.message)
        setProgress((current) => current + stagedCount)
      }
      const committed = await commitProspectingCnpjFileImportAction({ importId })
      if (committed.status !== "success" || !committed.summary) throw new Error(committed.status === "error" ? committed.message : "A importação não retornou o resumo.")
      setSummary(committed.summary)
      setMessage(`${committed.summary.suggestions} sugestões, ${committed.summary.notFound} sem resultado, ${committed.summary.ambiguous} ambíguos e ${committed.summary.skipped} ignorados por já estarem confirmados.`)
      importId = null
      onImported()
    } catch (cause) {
      if (importId) await abortProspectingCnpjFileImportAction({ importId }).catch(() => undefined)
      if (cause instanceof CnpjCsvError) {
        setError(`Linha ${cause.rowNumber ?? "?"}${cause.column ? ` · ${cause.column}` : ""}: ${cause.message}`)
      } else {
        setError(cause instanceof Error ? cause.message : "Não foi possível importar o CSV.")
      }
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <details className="rounded-lg border border-border bg-card px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Importar CSV de pesquisa existente</summary>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Use um CSV gerado anteriormente. As linhas são validadas e adicionadas como sugestões revisáveis.</p>
          {busy ? <p className="mt-1 text-xs text-muted-foreground" role="status">{progress > 0 ? `${progress} linhas preparadas` : "Lendo e validando o CSV"}</p> : null}
          {message && summary ? <p className="mt-1 text-xs text-success" role="status">{message}</p> : null}
          {error ? <p className="mt-1 text-xs text-destructive" role="alert">{error}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          aria-label="Selecionar CSV com os resultados da pesquisa CNPJ"
          className="max-w-48 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs file:font-medium file:text-secondary-foreground disabled:opacity-50"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            if (file) void importFile(file)
          }}
        />
        {busy ? <Spinner className="size-3 text-primary" aria-label="Importando CSV" /> : null}
        </div>
      </div>
    </details>
  )
}
