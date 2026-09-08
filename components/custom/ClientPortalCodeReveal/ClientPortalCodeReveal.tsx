"use client"

import { useState } from "react"
import { RiCheckLine, RiFileCopyLine } from "react-icons/ri"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ClientPortalCodeRevealProps } from "./ClientPortalCodeReveal.types"

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

function CopyRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const ok = await copyText(value)
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-sans text-caption font-medium text-fg-secondary">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <p
          className={
            mono
              ? "min-w-0 flex-1 break-all font-sans text-body-sm font-semibold tracking-[0.18em] text-fg"
              : "min-w-0 flex-1 break-all font-sans text-body-sm text-fg"
          }
        >
          {value}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void handleCopy()}
        >
          {copied ? (
            <RiCheckLine size={16} aria-hidden data-icon="inline-start" />
          ) : (
            <RiFileCopyLine size={16} aria-hidden data-icon="inline-start" />
          )}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
    </div>
  )
}

export function ClientPortalCodeReveal({
  open,
  onClose,
  code,
  url,
  title = "Guarde este código",
}: ClientPortalCodeRevealProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            O código não será exibido de novo. Copie agora ou será preciso
            rotacionar.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-1">
          <CopyRow label="Código" value={code} mono />
          <CopyRow label="Link" value={url} />
        </div>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
