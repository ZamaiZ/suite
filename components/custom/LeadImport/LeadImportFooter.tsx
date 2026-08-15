"use client"

import { RiLoader4Line, RiSendPlaneLine } from "react-icons/ri"
import { Button } from "@/components/ui/Button"

export function LeadImportFooter({
  editing,
  canImport,
  importLabel,
  blockReason,
  importError,
  isImporting,
  isRevalidating,
  onCancel,
  onBack,
  onImport,
  onRevalidate,
}: {
  editing: boolean
  canImport: boolean
  importLabel: string
  blockReason: string | null
  importError: string | null
  isImporting: boolean
  isRevalidating: boolean
  onCancel: () => void
  onBack: () => void
  onImport: () => void
  onRevalidate: () => void
}) {
  return (
    <>
      {editing ? (
        <Button type="button" variant="ghost" onClick={onBack} disabled={isRevalidating}>
          Voltar à visão geral
        </Button>
      ) : (
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isImporting}>
          Cancelar
        </Button>
      )}
      <div className="flex min-w-0 items-center gap-3">
        {importError ? (
          <p role="alert" className="max-w-72 truncate font-sans text-caption text-danger">
            {importError}
          </p>
        ) : null}
        {editing ? (
          <Button
            type="button"
            onClick={onRevalidate}
            disabled={isRevalidating}
            leadingIcon={
              isRevalidating ? (
                <RiLoader4Line size={16} aria-hidden className="animate-spin" />
              ) : undefined
            }
          >
            Reavaliar arquivo
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onImport}
            disabled={!canImport || isImporting}
            leadingIcon={
              isImporting ? (
                <RiLoader4Line size={16} aria-hidden className="animate-spin" />
              ) : (
                <RiSendPlaneLine size={16} aria-hidden />
              )
            }
          >
            {canImport ? importLabel : (blockReason ?? importLabel)}
          </Button>
        )}
      </div>
    </>
  )
}
