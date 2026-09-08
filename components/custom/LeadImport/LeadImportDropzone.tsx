"use client"

import { useRef, useState } from "react"
import { RiUploadCloud2Line } from "react-icons/ri"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/cn"
import { LEAD_SPREADSHEET_ACCEPT } from "@/lib/leads/spreadsheet-model"

export function LeadImportDropzone({
  disabled,
  onFiles,
}: {
  disabled: boolean
  onFiles: (files: File[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  function takeFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    onFiles(Array.from(list))
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault()
        if (disabled) return
        setDragOver(true)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        if (disabled) return
        setDragOver(true)
      }}
      onDragLeave={(event) => {
        event.preventDefault()
        if (event.currentTarget.contains(event.relatedTarget as Node)) return
        setDragOver(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setDragOver(false)
        if (disabled) return
        takeFiles(event.dataTransfer.files)
      }}
      className={cn(
        "rounded-xl border border-dashed px-4 py-8 text-center",
        "transition-[border-color,background-color] duration-150 ease-out",
        dragOver && !disabled
          ? "border-primary bg-primary/10"
          : "border-border bg-canvas",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <span
        aria-hidden
        className="mx-auto mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-muted text-primary"
      >
        <RiUploadCloud2Line size={20} />
      </span>
      <p className="font-sans text-body-sm font-semibold text-fg">
        Arraste arquivos .xlsx aqui ou
      </p>
      <div className="mt-3">
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Selecionar arquivos
        </Button>
      </div>
      <p className="mt-3 font-sans text-caption text-fg-muted">
        Vários arquivos. Máximo 1 MB e 500 linhas por arquivo. Até 5 arquivos.
      </p>
      <input
        ref={inputRef}
        id="lead-spreadsheet-files"
        type="file"
        accept={LEAD_SPREADSHEET_ACCEPT}
        multiple
        disabled={disabled}
        className="sr-only"
        onChange={(event) => takeFiles(event.target.files)}
      />
    </div>
  )
}
