"use client"

import { useState, useTransition } from "react"
import {
  RiCheckLine,
  RiEyeLine,
  RiEyeOffLine,
  RiFileCopyLine,
  RiLoader4Line,
} from "react-icons/ri"
import { revealStaffBriefingSecret } from "@/app/actions/briefing"
import { Button } from "@/components/ui/Button"
import type { BriefingReviewSecretFieldProps } from "./BriefingReviewSecretField.types"

export function BriefingReviewSecretField({
  clientId,
  kind,
  label,
  hasSecret,
}: BriefingReviewSecretFieldProps) {
  const [value, setValue] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function reveal() {
    setError(null)
    startTransition(async () => {
      const result = await revealStaffBriefingSecret(clientId, kind)
      if (result.status === "error") {
        setError(result.message)
        return
      }
      setValue(result.value)
    })
  }

  function hide() {
    setValue(null)
    setError(null)
  }

  async function copy() {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setError("Não foi possível copiar.")
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-sans text-caption font-medium text-fg-muted">{label}</p>
      {!hasSecret ? (
        <p className="font-sans text-body-sm text-fg">—</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 font-mono text-body-sm text-fg">
            {value ?? "••••••••"}
          </p>
          {value ? (
            <>
              <Button
                type="button"
                variant="ghost"
                className="size-8 px-0"
                aria-label="Ocultar"
                onClick={hide}
              >
                <RiEyeOffLine size={16} aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="size-8 px-0"
                aria-label="Copiar"
                onClick={() => void copy()}
              >
                {copied ? (
                  <RiCheckLine size={16} aria-hidden />
                ) : (
                  <RiFileCopyLine size={16} aria-hidden />
                )}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={reveal}
              className="gap-1.5"
            >
              {isPending ? (
                <RiLoader4Line size={16} aria-hidden className="animate-spin" />
              ) : (
                <RiEyeLine size={16} aria-hidden />
              )}
              Mostrar
            </Button>
          )}
        </div>
      )}
      {error ? (
        <p role="alert" className="font-sans text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
